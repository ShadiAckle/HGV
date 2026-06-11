import { formatMarketingBenchmarkFacts } from '../shared/compStatementImpact.js';
import {
  derivePlanMetricEarnings,
  earningsForMetricName,
  netStatementPayout,
} from '../shared/marketingEarningsAlign.js';
import { formatTourCode, normalizeDisplayText } from '../shared/normalizeText.js';
import { enrichMarketingTours } from './marketingTourContext.js';
import { fetchMarketingDeskRank } from './marketingMoneyMap.js';
import { buildMarketingMoneyMap, type MarketingMoneyMap } from '../shared/marketingMoneyMap.js';
import { getPlanAssessmentFallback } from '../shared/planAssessmentCatalog.js';
import { getBonusArea } from '../shared/bonusLevelsJan2025.js';
import { CURRENT_PERIOD_ID } from '../shared/compPeriods.js';

type RunSql = (sql: string) => Promise<Record<string, unknown>[]>;

function esc(value: string): string {
  return value.replace(/'/g, "''");
}

export interface MarketingRepWorkspacePayload {
  rep_id: string;
  rep_name: string;
  plan_id: string;
  period_label: string;
  assigned_area: string;
  bonus_area_id: string;
  kpis: {
    qtd_earnings: number;
    paid_to_date: number;
    qualified_tours: number;
    tours_shown: number;
    show_rate_pct: number;
    penetration_pct: number;
    penetration_target_pct: number;
    spiff_active: boolean;
    next_tier_label: string;
    next_tier_gap_tours: number;
  };
  plan_metrics: Array<{
    metric: string;
    weight_pct: number;
    earnings: number;
    attainment_pct: number;
    target_label: string;
    opportunity_usd: number | null;
  }>;
  earnings_breakdown: {
    qualified_tour_pay: number;
    courtesy_tour_pay: number;
    penetration_spiff: number;
    chargebacks: number;
    total_payout: number;
    net_payout: number;
  };
  pay_mix: { base_pct: number; variable_pct: number };
  market_position: { tcc_gap_vs_market_pct: number; at_risk_market: boolean };
  tours: Array<Record<string, unknown>>;
  chargebacks: Array<Record<string, unknown>>;
  upcoming_arrivals: Array<Record<string, unknown>>;
  money_map?: MarketingMoneyMap;
  insights_context: string;
  grounding_context: string;
}

function n(v: unknown): number {
  return Number(v ?? 0);
}

function b(v: unknown): boolean {
  return v === true || v === 'true' || v === 1;
}

async function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

export async function buildMarketingRepWorkspace(
  runSql: RunSql,
  repId: string,
  periodId: string,
): Promise<MarketingRepWorkspacePayload> {
  const safeRep = esc(repId);
  const safePeriod = esc(periodId);

  const [periodRows, metricRows, cbRows, arrivalRows, periodLabelRows] = await Promise.all([
    runSql(`
      SELECT p.*, d.period_label
      FROM workspace.hgv_comp.fact_marketing_rep_period p
      LEFT JOIN workspace.hgv_comp.dim_period d ON d.period_id = p.period_id
      WHERE p.rep_id = '${safeRep}' AND p.period_id = '${safePeriod}'
    `),
    runSql(`
      SELECT metric_name, weight_pct, earnings, attainment_pct, target_label, opportunity_usd
      FROM workspace.hgv_comp.fact_marketing_rep_metric
      WHERE rep_id = '${safeRep}' AND period_id = '${safePeriod}'
      ORDER BY weight_pct DESC
    `),
    runSql(`
      SELECT chargeback_id, guest_name, tour_id, premium_gift, chargeback_amount, notes
      FROM workspace.hgv_comp.fact_marketing_chargeback
      WHERE rep_id = '${safeRep}' AND period_id = '${safePeriod}'
    `),
    runSql(`
      SELECT arrival_id, guest_name, guest_type, arrival_datetime, desk,
             potential_qualified_tour, potential_fps_payout, projected_total_payout
      FROM workspace.hgv_comp.fact_marketing_arrival
      WHERE rep_id = '${safeRep}' AND period_id = '${safePeriod}'
      ORDER BY arrival_datetime
    `),
    runSql(`SELECT period_label FROM workspace.hgv_comp.dim_period WHERE period_id = '${safePeriod}'`),
  ]);

  if (!periodRows.length) {
    throw new Error(`No marketing rep comp data for ${repId} / ${periodId}. Run comp schema bootstrap.`);
  }

  const p = periodRows[0];
  const periodLabel = String(p.period_label ?? periodLabelRows[0]?.period_label ?? periodId);

  const earningsParts = {
    qualified_tour_pay: n(p.qualified_tour_pay),
    courtesy_tour_pay: n(p.courtesy_tour_pay),
    penetration_spiff: n(p.penetration_spiff),
    chargebacks: n(p.chargebacks),
    total_payout: n(p.total_payout),
  };
  const alignedEarnings = derivePlanMetricEarnings(earningsParts, n(p.qtd_earnings));
  const netPayout = netStatementPayout(earningsParts, alignedEarnings.grossTotal);

  const planMetrics = metricRows.map((m) => {
    const metricName = String(m.metric_name);
    const alignedEarned = earningsForMetricName(metricName, alignedEarnings);
    return {
      metric: metricName,
      weight_pct: n(m.weight_pct),
      earnings: alignedEarned ?? n(m.earnings),
      attainment_pct: n(m.attainment_pct),
      target_label: String(m.target_label ?? ''),
      opportunity_usd: m.opportunity_usd != null ? n(m.opportunity_usd) : null,
    };
  });

  const payload: MarketingRepWorkspacePayload = {
    rep_id: repId,
    rep_name: String(p.rep_name ?? repId),
    plan_id: String(p.plan_id ?? ''),
    period_label: periodLabel,
    assigned_area: String(p.assigned_area ?? ''),
    bonus_area_id: String(p.bonus_area_id ?? ''),
    kpis: {
      qtd_earnings: alignedEarnings.grossTotal,
      paid_to_date: n(p.paid_to_date),
      qualified_tours: n(p.qualified_tours),
      tours_shown: n(p.tours_shown),
      show_rate_pct: n(p.show_rate_pct),
      penetration_pct: n(p.penetration_pct),
      penetration_target_pct: n(p.penetration_target_pct),
      spiff_active: b(p.spiff_active),
      next_tier_label: String(p.next_tier_label ?? ''),
      next_tier_gap_tours: n(p.next_tier_gap_tours),
    },
    plan_metrics: planMetrics,
    earnings_breakdown: { ...earningsParts, net_payout: netPayout },
    pay_mix: { base_pct: n(p.base_pct), variable_pct: n(p.variable_pct) },
    market_position: {
      tcc_gap_vs_market_pct: n(p.tcc_gap_vs_market_pct),
      at_risk_market: n(p.tcc_gap_vs_market_pct) <= -10,
    },
    tours: [],
    chargebacks: cbRows.map((row) => ({
      ...row,
      guest_name: normalizeDisplayText(String(row.guest_name ?? '')),
      notes: row.notes != null ? normalizeDisplayText(String(row.notes)) : row.notes,
    })),
    upcoming_arrivals: arrivalRows,
    insights_context: '',
    grounding_context: '',
  };

  try {
    payload.tours = await enrichMarketingTours(runSql, repId, periodId);
  } catch (err) {
    console.warn('Guest-enriched tour query failed — falling back to base ledger:', err instanceof Error ? err.message : err);
    const tourRows = await runSql(`
      SELECT tour_id, guest_name, guest_type, arrival_date, tour_status, code, payout, fps_eligible, fps_potential, notes
      FROM workspace.hgv_comp.fact_marketing_tour_payout
      WHERE rep_id = '${safeRep}' AND period_id = '${safePeriod}'
      ORDER BY arrival_date DESC
    `);
    payload.tours = tourRows.map((row) => ({
      ...row,
      guest_name: normalizeDisplayText(String(row.guest_name ?? '')),
      code: formatTourCode(row.code),
      notes: row.notes != null ? normalizeDisplayText(String(row.notes)) : row.notes,
    }));
  }

  payload.insights_context = formatMarketingInsightContext(payload);
  payload.grounding_context = payload.insights_context;

  const qualifiedRate =
    payload.kpis.tours_shown > 0
      ? Math.round((payload.kpis.qualified_tours / payload.kpis.tours_shown) * 1000) / 10
      : 0;

  payload.money_map = buildMarketingMoneyMap({
    rep_id: payload.rep_id,
    kpis: payload.kpis,
    plan_metrics: payload.plan_metrics,
    tours: payload.tours,
    upcoming_arrivals: payload.upcoming_arrivals,
    desk_rank: null,
  });

  try {
    const deskRank = await withTimeout(
      fetchMarketingDeskRank(runSql, payload.rep_id, periodId, qualifiedRate, payload.kpis.penetration_pct),
      8_000,
      null,
    );
    if (deskRank && payload.money_map) {
      payload.money_map = { ...payload.money_map, desk_rank: deskRank };
    }
    payload.insights_context = formatMarketingInsightContext(payload);
    payload.grounding_context = payload.insights_context;
  } catch (err) {
    console.warn('Desk rank / money map enrich failed:', err instanceof Error ? err.message : err);
  }

  return payload;
}

export function formatMarketingInsightContext(payload: MarketingRepWorkspacePayload): string {
  const planMetricOpportunity = payload.plan_metrics.reduce((s, m) => s + (m.opportunity_usd ?? 0), 0);
  const projectedArrival = payload.upcoming_arrivals.reduce(
    (s, a) => s + Number(a.projected_total_payout ?? 0),
    0,
  );
  const impactFacts = formatMarketingBenchmarkFacts({
    qtdEarnings: payload.kpis.qtd_earnings,
    paidToDate: payload.kpis.paid_to_date,
    basePct: payload.pay_mix.base_pct,
    variablePct: payload.pay_mix.variable_pct,
    tccGapPct: payload.market_position.tcc_gap_vs_market_pct,
    totalPayout: payload.earnings_breakdown.net_payout,
    nextTierLabel: payload.kpis.next_tier_label,
    nextTierGapTours: payload.kpis.next_tier_gap_tours,
    assignedArea: payload.assigned_area,
    planMetricOpportunityUsd: planMetricOpportunity,
    projectedArrivalUsd: projectedArrival,
  });

  const planAssessment = getPlanAssessmentFallback('marketing_rep');
  const keyFindingsBlock = planAssessment?.keyFindings.length
    ? ['', '## Plan Assessment Key Findings', ...planAssessment.keyFindings.map((f) => `- ${f}`)]
    : [];

  return [
    `## Marketing Rep: ${payload.rep_name} (${payload.rep_id})`,
    `Plan: ${payload.plan_id} | Period: ${payload.period_label} | Desk: ${payload.assigned_area}`,
    `Bonus area: ${payload.bonus_area_id}`,
    '',
    '## Plan Metrics (aligned to Metrics/Weights)',
    JSON.stringify(payload.plan_metrics, null, 2),
    '',
    '## KPI Summary',
    JSON.stringify(payload.kpis, null, 2),
    '',
    '## Pay Mix & Market Position',
    JSON.stringify({ ...payload.pay_mix, ...payload.market_position }, null, 2),
    '',
    impactFacts,
    ...keyFindingsBlock,
    '',
    '## Tour Activity (Owner vs NB)',
    JSON.stringify(payload.tours, null, 2),
    '',
    '## Upcoming Arrivals (projected payout)',
    JSON.stringify(payload.upcoming_arrivals, null, 2),
    '',
    '## Chargebacks',
    JSON.stringify(payload.chargebacks, null, 2),
    ...(payload.money_map
      ? [
          '',
          '## Money Map (comp-first insights — use for dollar-focused answers)',
          JSON.stringify(payload.money_map, null, 2),
        ]
      : []),
  ].join('\n');
}

export async function fetchIndustryBenchmarks(
  runSql: RunSql,
  roleKey?: string,
  periodId = CURRENT_PERIOD_ID,
): Promise<Record<string, unknown>[]> {
  const safePeriod = esc(periodId);
  const roleFilter = roleKey ? `AND role_key = '${esc(roleKey)}'` : '';
  return runSql(`
    SELECT benchmark_id, role_key, role_label, metric_code, market_value, hgv_typical_value,
           unit, benchmark_source, effective_period, notes
    FROM workspace.hgv_comp.industry_comp_benchmark
    WHERE effective_period = '${safePeriod}' ${roleFilter}
    ORDER BY role_key, metric_code
  `);
}

export async function fetchRepMarketPositions(
  runSql: RunSql,
  periodId = CURRENT_PERIOD_ID,
): Promise<Record<string, unknown>[]> {
  return runSql(`
    SELECT rep_id,
           MAX(rep_name) AS rep_name,
           MAX(role_key) AS role_key,
           MAX(tcc_gap_vs_market_pct) AS tcc_gap_vs_market_pct,
           MAX(base_pct) AS base_pct,
           MAX(variable_pct) AS variable_pct,
           MAX(quota_attainment_pct) AS quota_attainment_pct
    FROM workspace.hgv_comp.fact_rep_market_position
    WHERE period_id = '${esc(periodId)}'
    GROUP BY rep_id
    ORDER BY rep_name
  `);
}

export interface RegionalBonusPayload {
  area_id: string;
  period_id: string;
  site_line: string;
  smt_volume: number;
  budget_volume: number;
  volume_var_pct: number;
  tiers: Array<{
    level: number;
    salespeople_count: number;
    avg_tier_volume: number;
    total_tier_volume: number;
    total_cmi: number;
    cost_pct: number;
  }>;
}

export function regionalBonusFromCatalog(
  areaId: string,
  periodId = CURRENT_PERIOD_ID,
): RegionalBonusPayload | null {
  const area = getBonusArea(areaId);
  if (!area) return null;
  return {
    area_id: area.areaId,
    period_id: periodId,
    site_line: area.siteLine,
    smt_volume: area.smtVolume,
    budget_volume: area.budgetVolume,
    volume_var_pct: area.volumeVarPct,
    tiers: area.tiers.map((t) => ({
      level: t.level,
      salespeople_count: t.salespeopleCount,
      avg_tier_volume: t.avgTierVolume,
      total_tier_volume: t.totalTierVolume,
      total_cmi: t.totalCmi,
      cost_pct: t.costPct,
    })),
  };
}

export async function fetchRegionalBonusArea(
  runSql: RunSql,
  areaId: string,
  periodId = CURRENT_PERIOD_ID,
): Promise<RegionalBonusPayload | null> {
  const catalog = regionalBonusFromCatalog(areaId, periodId);
  try {
    const safeArea = esc(areaId);
    const safePeriod = esc(periodId);
    const areaRows = await runSql(`
      SELECT area_id, period_id, site_line, smt_volume, budget_volume, volume_var_pct
      FROM workspace.hgv_comp.fact_regional_bonus_area
      WHERE area_id = '${safeArea}' AND period_id = '${safePeriod}'
    `);
    if (!areaRows.length) return catalog;

    const tierRows = await runSql(`
      SELECT level, salespeople_count, avg_tier_volume, total_tier_volume, total_cmi, cost_pct
      FROM workspace.hgv_comp.fact_regional_bonus_tier
      WHERE area_id = '${safeArea}' AND period_id = '${safePeriod}'
      ORDER BY level
    `);

    if (!tierRows.length) return catalog;

    const area = areaRows[0];
    return {
      area_id: String(area.area_id),
      period_id: String(area.period_id),
      site_line: String(area.site_line),
      smt_volume: Number(area.smt_volume ?? 0),
      budget_volume: Number(area.budget_volume ?? 0),
      volume_var_pct: Number(area.volume_var_pct ?? 0),
      tiers: tierRows.map((t) => ({
        level: Number(t.level ?? 0),
        salespeople_count: Number(t.salespeople_count ?? 0),
        avg_tier_volume: Number(t.avg_tier_volume ?? 0),
        total_tier_volume: Number(t.total_tier_volume ?? 0),
        total_cmi: Number(t.total_cmi ?? 0),
        cost_pct: Number(t.cost_pct ?? 0),
      })),
    };
  } catch (err) {
    console.warn(
      'Regional bonus warehouse query failed — using PDF catalog fallback:',
      err instanceof Error ? err.message : err,
    );
    return catalog;
  }
}
