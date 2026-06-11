import { extractAssistantContent } from './managerInsights.js';
import type { InsightGroundingOptions } from './managerInsights.js';
import { appendInsightGrounding } from '../shared/insightGrounding.js';
import { withHgvRepBrandFraming } from '../shared/hgvRepBrandFraming.js';

export { extractAssistantContent };

type RunSql = (sql: string) => Promise<Record<string, unknown>[]>;

export interface RepInsightPayload {
  rep_id: string;
  rep_name: string;
  role_title: string;
  period_id: string;
  region: string;
  kpi: Record<string, unknown> | null;
  breakdown: Record<string, unknown> | null;
  deals: Record<string, unknown>[];
}

function esc(value: string): string {
  return value.replace(/'/g, "''");
}

export async function buildRepInsightPayload(
  runSql: RunSql,
  repId: string,
  periodId: string,
): Promise<RepInsightPayload> {
  const safeRep = esc(repId);
  const safePeriod = esc(periodId);

  const [repRows, kpiRows, breakdownRows, dealRows] = await Promise.all([
    runSql(`
      SELECT rep_id, rep_name, level_code, region, team_id
      FROM workspace.hgv_comp.dim_rep
      WHERE rep_id = '${safeRep}'
    `),
    runSql(`
      SELECT
        r.rep_id,
        r.rep_name,
        p.period_label,
        pay.total_earnings AS current_earnings,
        pay.total_paid AS paid_to_date,
        qa.attainment_pct AS quota_attainment_pct,
        qa.credited_amount AS credited_amount,
        qa.quota_amount AS quota_amount,
        qa.deals_closed_count AS deals_closed_count,
        qa.next_tier_threshold_pct AS next_tier_threshold_pct,
        qa.next_tier_gap_amount AS next_tier_gap_amount
      FROM workspace.hgv_comp.dim_rep r
      JOIN workspace.hgv_comp.fact_payout pay ON pay.rep_id = r.rep_id
      JOIN workspace.hgv_comp.fact_quota_attainment qa
        ON qa.rep_id = r.rep_id AND qa.period_id = pay.period_id
      JOIN workspace.hgv_comp.dim_period p ON p.period_id = pay.period_id
      WHERE r.rep_id = '${safeRep}' AND pay.period_id = '${safePeriod}'
    `),
    runSql(`
      SELECT
        r.rep_name,
        p.period_label,
        pay.base_pay,
        pay.commission,
        pay.bonus,
        pay.total_earnings,
        pay.total_paid
      FROM workspace.hgv_comp.dim_rep r
      JOIN workspace.hgv_comp.fact_payout pay ON pay.rep_id = r.rep_id
      JOIN workspace.hgv_comp.dim_period p ON p.period_id = pay.period_id
      WHERE r.rep_id = '${safeRep}' AND pay.period_id = '${safePeriod}'
    `),
    runSql(`
      SELECT
        deal_id,
        credit_date AS close_date,
        property_display_name AS description,
        credit_amount AS contract_volume,
        credit_amount AS commission_earned,
        credit_status AS status
      FROM workspace.hgv_comp.fact_deal_credit
      WHERE rep_id = '${safeRep}' AND period_id = '${safePeriod}'
      ORDER BY close_date DESC
      LIMIT 10
    `),
  ]);

  const rep = repRows[0] ?? {};
  const isManager = String(rep.rep_id ?? repId).includes('MGR') || String(rep.level_code) === 'L9';

  return {
    rep_id: String(rep.rep_id ?? repId),
    rep_name: String(rep.rep_name ?? repId),
    role_title: isManager ? 'Sales Manager' : 'Sales Executive',
    period_id: periodId,
    region: String(rep.region ?? 'West'),
    kpi: kpiRows[0] ?? null,
    breakdown: breakdownRows[0] ?? null,
    deals: dealRows,
  };
}

export function formatCompactRepInsightContext(payload: RepInsightPayload): string {
  return [
    `## Rep: ${payload.rep_name} (${payload.role_title})`,
    `Period: ${payload.period_id} | Region: ${payload.region}`,
    '',
    '## KPI Summary',
    JSON.stringify(payload.kpi, null, 2),
    '',
    '## Earnings Breakdown',
    JSON.stringify(payload.breakdown, null, 2),
    '',
    `## Recent Deals (${payload.deals.length})`,
    JSON.stringify(payload.deals, null, 2),
  ].join('\n');
}

export function buildSalesRepInsightPrompt(
  context: string,
  roleTitle: string,
  grounding?: InsightGroundingOptions,
): string {
  const grounded = appendInsightGrounding(context, {
    includeSlide16: false,
    includeTeamMarket: false,
    industryBenchmarks: grounding?.industryBenchmarks,
  });
  return [
    `You are the HGV IGNITE Compensation Agent advising a ${roleTitle} on PERSONAL PAYOUT and quota progression.`,
    'You have governed warehouse data below — KPIs, earnings breakdown, recent deals, and industry compensation benchmarks.',
    '',
    'CRITICAL RULES:',
    '1. Answer ONLY from the context. Name specific deal_id, dollar amounts, attainment %, and tier thresholds.',
    '2. NEVER tell the rep to "check another system" — the data is already here.',
    '3. Tie every action to commission economics and reference industry benchmark areas where pay mix or TCC gaps apply — always frame HGV favorably (see brand rules).',
    '4. Format as a concise personal payout brief (150–250 words):',
    '   - Open with one bold sentence on current earnings posture and attainment vs quota (no section label)',
    '   - **Priority actions** (3 numbered items): each names a deal gap, product focus, or pipeline action with specific $ impact toward the next rate tier',
    '   - **Watch item** (1 bullet): the single metric or pending deal most likely to block the next commission tier',
    '',
    ...withHgvRepBrandFraming([]),
    '=== LIVE REP CONTEXT ===',
    grounded,
    '=== END CONTEXT ===',
    '',
    'Produce the personal payout brief now.',
  ].join('\n');
}

export function buildMarketingRepInsightPrompt(
  context: string,
  roleTitle: string,
  grounding?: InsightGroundingOptions,
): string {
  const grounded = appendInsightGrounding(context, {
    includeTeamMarket: false,
    industryBenchmarks: grounding?.industryBenchmarks,
  });
  return [
    `You are the HGV IGNITE Compensation Agent advising a ${roleTitle} on tour-based marketing compensation.`,
    'You have governed context below — qualified tours (Owner vs New Buyer), FPS packages, plan metric weights, upcoming arrivals with projected payout, and industry compensation benchmarks.',
    '',
    'CRITICAL RULES:',
    '1. Answer ONLY from the context. Name specific tour_id, guest names, Owner/NB type, and dollar amounts.',
    '2. NEVER tell the rep to "check another system" — the data is already here.',
    '3. Speak in DOLLARS first. Use the Money Map: recovery_usd, fps_leakage_usd, arrivals_pipeline, plan_progress opportunity_usd, tour_chips.',
    '4. Tie actions to plan metrics: Qualified Tours 45%, FPS Packages 35%, Sales Transactions 20%.',
    '5. For upcoming arrivals and open FPS tours, name the guest and $ upside (e.g. "Clark Kent no-show = $455 recovery; Bruce Wayne = $420 FPS open").',
    '6. Format as a concise earnings brief (150–250 words):',
    '   - Open with one bold sentence: biggest dollar gap (tier, FPS leakage, or no-show recovery)',
    '   - **Plan actions** (3 numbered): each names tour/arrival ID + $ impact toward plan metrics',
    '   - **Watch item**: one controllable metric (no-show, FPS unsold, chargeback) — never HGV plan deficiency',
    '',
    ...withHgvRepBrandFraming([]),
    '=== LIVE MARKETING REP CONTEXT ===',
    grounded,
    '=== END CONTEXT ===',
    '',
    'Produce the earnings brief now.',
  ].join('\n');
}

export function isMarketingRepId(repId: string): boolean {
  return repId === 'PERSONA-MKT-REP';
}

export type RepInsightFocus = 'full' | 'next_step' | 'qtd_earnings';

export function buildMarketingRepCompactInsightPrompt(
  context: string,
  roleTitle: string,
  focus: RepInsightFocus,
  grounding?: InsightGroundingOptions,
): string {
  const grounded = appendInsightGrounding(context, {
    includeTeamMarket: false,
    industryBenchmarks: grounding?.industryBenchmarks,
  });

  const focusRule =
    focus === 'next_step'
      ? 'Write EXACTLY 2 short sentences (max 50 words total). Sentence 1: biggest dollar gap from Money Map (recovery_usd, fps_leakage_usd, or plan opportunity). Sentence 2: one named tour_id or arrival_id and specific $ if they act. No headings, bullets, or markdown.'
      : focus === 'qtd_earnings'
        ? 'Write EXACTLY 2 short sentences (max 50 words total). Sentence 1: what drove QTD earnings in plain dollars. Sentence 2: single biggest money left on table (FPS leakage, no-show recovery, or tier gap). No headings, bullets, or markdown.'
        : '';

  if (focus !== 'full') {
    return [
      `You are the HGV IGNITE Compensation Agent advising a ${roleTitle} on tour-based marketing compensation.`,
      focusRule,
      'Answer ONLY from the context. Speak in DOLLARS first — name a specific tour_id, guest_name, or arrival_id and the $ impact.',
      'Use the Money Map block when present: recovery_usd (no-show $ at risk), fps_leakage_usd (FPS left on table), arrivals_pipeline.projected_total_usd, plan_progress.opportunity_usd.',
      'Do NOT mention market pay comparisons, TCC gaps, or director-level benchmarks.',
      ...withHgvRepBrandFraming([]),
      '=== LIVE MARKETING REP CONTEXT ===',
      grounded,
      '=== END CONTEXT ===',
    ].join('\n');
  }

  return buildMarketingRepInsightPrompt(context, roleTitle, grounding);
}
