import {
  effectiveAttainmentSql,
  quotaShieldJoinSql,
} from './managerInterventions.js';

type MarketingPersonaId = 'marketing_rep' | 'marketing_manager' | 'marketing_director';

export interface DirectReportRow {
  rep_id: string;
  rep_name: string;
  level_code: string;
  quota_attainment_pct: number;
  total_earnings: number;
  ffs_sales_pct: number;
  performance_band: string;
  deals_closed_count?: number;
  credited_amount?: number;
  tours_booked?: number;
  tours_showed?: number;
  tour_close_rate_pct?: number;
  total_nsv?: number;
}

export interface MetricAttainmentRow {
  metric: string;
  weight_pct: number;
  target: number | string;
  actual: number | string;
  attainment_pct: number;
  payout_pct: number;
  status: string;
}

export interface ActionItem {
  priority: 'high' | 'medium' | 'low';
  metric: string;
  recommendation: string;
  evidence: string;
}

export interface UpcomingTour {
  tour_id: string;
  rep_id: string;
  rep_name: string;
  lead_source: string;
  abc_score: string;
  showed_flag: boolean;
  closed_flag: boolean;
  net_sales_volume: number;
  vpg: number;
}

export interface ManagerWorkspacePayload {
  manager_rep_id: string;
  manager_name: string;
  role_title: string;
  plan_id: string;
  persona_id: MarketingPersonaId | null;
  period_id: string;
  direct_reports: DirectReportRow[];
  team_rollup: {
    report_count: number;
    team_attainment_pct: number;
    at_risk_count: number;
    top_performer_count: number;
    total_team_nsv: number;
    total_team_earnings: number;
    ffs_sales_pct: number;
    ffs_target_pct: number;
  };
  metric_attainment: MetricAttainmentRow[];
  upcoming_tours: UpcomingTour[];
  action_items: ActionItem[];
}

type RunSql = (sql: string) => Promise<Record<string, unknown>[]>;

function n(v: unknown): number {
  return Number(v ?? 0);
}

function pct(actual: number, target: number): number {
  if (target <= 0) return 0;
  return Math.round((actual / target) * 1000) / 10;
}

function payoutFromAttainment(att: number): number {
  if (att < 75) return Math.round(att * 0.6);
  if (att < 100) return Math.round(60 + (att - 75) * 1.6);
  if (att <= 125) return Math.round(100 + (att - 100) * 3);
  return 175;
}

function fmtCompactUsd(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) return `$${(amount / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `$${Math.round(amount / 1_000)}K`;
  return `$${Math.round(amount).toLocaleString()}`;
}

export interface TeamTourAggregates {
  avg_vpg: number;
  total_ebitda: number;
  total_nsv: number;
  owner_nsv: number;
}

async function fetchTeamTourAggregates(
  runSql: RunSql,
  repIds: string[],
  periodId: string,
): Promise<TeamTourAggregates> {
  if (repIds.length === 0) {
    return { avg_vpg: 0, total_ebitda: 0, total_nsv: 0, owner_nsv: 0 };
  }
  const safePeriod = periodId.replace(/'/g, "''");
  const idList = repIds.slice(0, 50).map((id) => `'${id.replace(/'/g, "''")}'`).join(',');
  const rows = await runSql(`
    SELECT AVG(CASE WHEN vpg > 0 THEN vpg END) AS avg_vpg,
           SUM(COALESCE(ebitda, 0)) AS total_ebitda,
           SUM(COALESCE(net_sales_volume, 0)) AS total_nsv,
           SUM(CASE WHEN lead_source = 'Owner' THEN COALESCE(net_sales_volume, 0) ELSE 0 END) AS owner_nsv
    FROM workspace.hgv_comp.fact_tour_quality
    WHERE period_id = '${safePeriod}' AND rep_id IN (${idList})
  `).catch(() => []);
  const row = rows[0] ?? {};
  return {
    avg_vpg: Math.round(n(row.avg_vpg) * 100) / 100,
    total_ebitda: n(row.total_ebitda),
    total_nsv: n(row.total_nsv),
    owner_nsv: n(row.owner_nsv),
  };
}

export function isMarketingPersona(repId: string): MarketingPersonaId | null {
  // Synthesized marketing hierarchy ids: 'MGR-<office_code>' (manager) and
  // 'DIR-<region>' (director). Without this they fall through to the sales path
  // (fetchSalesDirectReports), which queries sales-only tables like
  // fact_rep_product_mix that don't exist in the marketing deploy.
  if (repId === 'PERSONA-MKT-MGR' || repId.startsWith('MGR-')) return 'marketing_manager';
  if (repId === 'PERSONA-MKT-DIR' || repId.startsWith('DIR-')) return 'marketing_director';
  if (repId === 'PERSONA-MKT-REP') return 'marketing_rep';
  return null;
}

export function resolveManagerMeta(_repId: string, personaId: MarketingPersonaId | null) {
  if (personaId === 'marketing_manager') {
    return { name: 'R. Castillo', role: 'Marketing Manager', plan: 'PLAN-MKT-MGR-2026' };
  }
  if (personaId === 'marketing_director') {
    return { name: 'D. Whitfield', role: 'Marketing Director', plan: 'PLAN-MKT-DIR-2026' };
  }
  return { name: 'Sales Manager', role: 'Sales Manager', plan: 'PLAN-MGR-2025' };
}

async function fetchSalesDirectReports(runSql: RunSql, managerRepId: string, periodId: string): Promise<DirectReportRow[]> {
  const rows = await runSql(`
    WITH rep_ffs AS (
      SELECT mix.rep_id, mix.period_id, MAX(CASE WHEN pl.is_ffs THEN mix.mix_pct END) AS ffs_sales_pct
      FROM workspace.hgv_comp.fact_rep_product_mix mix
      JOIN workspace.hgv_comp.dim_product_line pl ON pl.product_line_id = mix.product_line_id
      GROUP BY mix.rep_id, mix.period_id
    )
    SELECT r.rep_id, r.rep_name, r.level_code,
           ${effectiveAttainmentSql('qa', 'qs')} AS quota_attainment_pct,
           pay.total_earnings,
           qa.credited_amount,
           COALESCE(ffs.ffs_sales_pct, 0) AS ffs_sales_pct,
           qa.deals_closed_count,
           qs.quota_relief_pct,
           CASE WHEN ${effectiveAttainmentSql('qa', 'qs')} >= 100 THEN 'TOP'
                WHEN ${effectiveAttainmentSql('qa', 'qs')} < 70 THEN 'AT_RISK'
                ELSE 'ON_TRACK' END AS performance_band
    FROM workspace.hgv_comp.dim_rep r
    JOIN workspace.hgv_comp.fact_quota_attainment qa ON qa.rep_id = r.rep_id AND qa.period_id = '${periodId.replace(/'/g, "''")}'
    JOIN workspace.hgv_comp.fact_payout pay ON pay.rep_id = r.rep_id AND pay.period_id = qa.period_id
    LEFT JOIN rep_ffs ffs ON ffs.rep_id = r.rep_id AND ffs.period_id = qa.period_id
    ${quotaShieldJoinSql('r.rep_id', `'${periodId.replace(/'/g, "''")}'`, 'qs')}
    WHERE r.manager_rep_id = '${managerRepId.replace(/'/g, "''")}'
    ORDER BY qa.attainment_pct DESC
  `);
  return rows.map((r) => ({
    rep_id: String(r.rep_id),
    rep_name: String(r.rep_name),
    level_code: String(r.level_code),
    quota_attainment_pct: n(r.quota_attainment_pct),
    total_earnings: n(r.total_earnings),
    ffs_sales_pct: n(r.ffs_sales_pct),
    performance_band: String(r.performance_band),
    deals_closed_count: n(r.deals_closed_count),
    credited_amount: n(r.credited_amount),
  }));
}

async function fetchMarketingDirectReports(
  runSql: RunSql,
  periodId: string,
  managerRepId: string,
  regional: boolean,
): Promise<DirectReportRow[]> {
  const safeManager = managerRepId.replace(/'/g, "''");
  const safePeriod = periodId.replace(/'/g, "''");
  let rows: Record<string, unknown>[] = [];
  try {
    rows = await runSql(`
    SELECT r.rep_id, r.rep_name, r.level_code,
           COALESCE(p.qtd_earnings, 0) AS qtd_earnings,
           COALESCE(mp.quota_attainment_pct, 0) AS quota_attainment_pct,
           COALESCE(p.qualified_tours, 0) AS qualified_tours,
           COALESCE(p.tours_shown, 0) AS period_tours_shown,
           COALESCE(t.tours_booked, 0) AS tours_booked,
           COALESCE(t.tours_showed, 0) AS tours_showed,
           COALESCE(t.tours_closed, 0) AS tours_closed,
           COALESCE(t.total_nsv, 0) AS total_nsv,
           qs.quota_relief_pct
    FROM workspace.hgv_comp.dim_rep r
    LEFT JOIN workspace.hgv_comp.fact_marketing_rep_period p
      ON p.rep_id = r.rep_id AND p.period_id = '${safePeriod}'
    LEFT JOIN (
      SELECT rep_id, MAX(quota_attainment_pct) AS quota_attainment_pct
      FROM workspace.hgv_comp.fact_rep_market_position
      WHERE period_id = '${safePeriod}'
      GROUP BY rep_id
    ) mp ON mp.rep_id = r.rep_id
    ${quotaShieldJoinSql('r.rep_id', `'${safePeriod}'`, 'qs')}
    LEFT JOIN (
      SELECT rep_id,
             COUNT(tour_id) AS tours_booked,
             SUM(CASE WHEN showed_flag THEN 1 ELSE 0 END) AS tours_showed,
             SUM(CASE WHEN closed_flag THEN 1 ELSE 0 END) AS tours_closed,
             SUM(net_sales_volume) AS total_nsv
      FROM workspace.hgv_comp.fact_tour_quality
      WHERE period_id = '${safePeriod}'
      GROUP BY rep_id
    ) t ON t.rep_id = r.rep_id
    WHERE r.manager_rep_id = '${safeManager}'
      AND r.rep_id NOT LIKE 'PERSONA-%'
    ORDER BY COALESCE(p.qtd_earnings, t.total_nsv) DESC
    LIMIT ${regional ? 50 : 20}
  `);
  } catch (err) {
    console.warn('marketing direct-reports query failed (returning empty):', err instanceof Error ? err.message : err);
    return [];
  }

  return rows.map((r) => {
    const booked = n(r.tours_booked);
    const showed = n(r.tours_showed) || n(r.period_tours_shown);
    const closed = n(r.tours_closed);
    const closeRate = showed > 0 ? Math.round((closed / showed) * 1000) / 10 : 0;
    const marketAttainment = n(r.quota_attainment_pct);
    const reliefPct = n(r.quota_relief_pct);
    let attainment =
      marketAttainment > 0
        ? marketAttainment
        : Math.min(130, Math.round(closeRate * 1.4 + showed * 2));
    if (reliefPct > 0 && attainment > 0) {
      attainment = Math.min(130, Math.round((attainment / (1 - reliefPct / 100)) * 10) / 10);
    }
    return {
      rep_id: String(r.rep_id),
      rep_name: String(r.rep_name),
      level_code: String(r.level_code),
      quota_attainment_pct: attainment,
      total_earnings: n(r.qtd_earnings),
      ffs_sales_pct: 0,
      performance_band: attainment >= 100 ? 'TOP' : attainment < 70 ? 'AT_RISK' : 'ON_TRACK',
      tours_booked: booked,
      tours_showed: showed,
      tour_close_rate_pct: closeRate,
      total_nsv: n(r.total_nsv),
    };
  });
}

async function fetchUpcomingTours(runSql: RunSql, periodId: string, repIds: string[]): Promise<UpcomingTour[]> {
  if (repIds.length === 0) return [];
  const idList = repIds.slice(0, 30).map((id) => `'${id.replace(/'/g, "''")}'`).join(',');
  let rows: Record<string, unknown>[] = [];
  try {
    rows = await runSql(`
    SELECT t.tour_id, t.rep_id, r.rep_name, t.lead_source, t.abc_score,
           t.showed_flag, t.closed_flag, t.net_sales_volume, t.vpg
    FROM workspace.hgv_comp.fact_tour_quality t
    JOIN workspace.hgv_comp.dim_rep r ON r.rep_id = t.rep_id
    WHERE t.period_id = '${periodId.replace(/'/g, "''")}'
      AND t.rep_id IN (${idList})
      AND (t.showed_flag = false OR (t.showed_flag = true AND t.closed_flag = false))
    ORDER BY t.abc_score ASC, t.net_sales_volume DESC
    LIMIT 15
  `);
  } catch (err) {
    console.warn('upcoming tours query failed (returning empty):', err instanceof Error ? err.message : err);
    return [];
  }
  return rows.map((t) => ({
    tour_id: String(t.tour_id),
    rep_id: String(t.rep_id),
    rep_name: String(t.rep_name),
    lead_source: String(t.lead_source),
    abc_score: String(t.abc_score),
    showed_flag: Boolean(t.showed_flag),
    closed_flag: Boolean(t.closed_flag),
    net_sales_volume: n(t.net_sales_volume),
    vpg: n(t.vpg),
  }));
}

function buildSalesMetrics(
  reports: DirectReportRow[],
  teamSnap: Record<string, unknown> | null,
  tourAgg: TeamTourAggregates,
): MetricAttainmentRow[] {
  const teamNsv = reports.reduce((s, r) => s + (r.credited_amount ?? 0), 0);
  const teamAtt = reports.length ? reports.reduce((s, r) => s + r.quota_attainment_pct, 0) / reports.length : 0;
  const ffsActual = teamSnap ? n(teamSnap.ffs_sales_pct) : reports.reduce((s, r) => s + r.ffs_sales_pct, 0) / Math.max(reports.length, 1);
  const ffsTarget = teamSnap ? n(teamSnap.ffs_target_pct) : 35;
  const atRisk = reports.filter((r) => r.performance_band === 'AT_RISK').length;
  const vpgTarget = 1200;
  const avgVpg = tourAgg.avg_vpg;
  const vpgAtt = pct(avgVpg, vpgTarget);

  return [
    { metric: 'Team Net Sales Volume', weight_pct: 35, target: '$1.5M', actual: fmtCompactUsd(teamNsv), attainment_pct: pct(teamNsv, 1500000), payout_pct: payoutFromAttainment(pct(teamNsv, 1500000)), status: 'Monthly' },
    { metric: 'Direct Report Quota Attainment', weight_pct: 25, target: '100% avg', actual: `${Math.round(teamAtt)}% avg`, attainment_pct: teamAtt, payout_pct: payoutFromAttainment(teamAtt), status: 'Monthly' },
    { metric: 'FFS Mix vs Target', weight_pct: 15, target: `${ffsTarget}%`, actual: `${Math.round(ffsActual)}%`, attainment_pct: pct(ffsActual, ffsTarget), payout_pct: payoutFromAttainment(pct(ffsActual, ffsTarget)), status: 'Monthly' },
    { metric: 'Team VPG Quality', weight_pct: 10, target: '$1,200 VPG', actual: `${fmtCompactUsd(avgVpg)} VPG`, attainment_pct: vpgAtt, payout_pct: payoutFromAttainment(vpgAtt), status: 'Monthly' },
    { metric: 'Manager Override / TO Credit', weight_pct: 15, target: '4 TO events', actual: `${Math.max(1, atRisk)} interventions`, attainment_pct: atRisk > 2 ? 72 : 105, payout_pct: atRisk > 2 ? 68 : 108, status: 'Quarterly' },
  ];
}

function buildMarketingManagerMetrics(reports: DirectReportRow[], tourAgg: TeamTourAggregates): MetricAttainmentRow[] {
  const tours = reports.reduce((s, r) => s + (r.tours_showed ?? 0), 0);
  const nsv = reports.reduce((s, r) => s + (r.total_nsv ?? 0), 0);
  const pen = reports.length ? reports.filter((r) => (r.tour_close_rate_pct ?? 0) >= 15).length / reports.length * 100 : 0;
  const contributionTarget = 300_000;
  const contributionActual = tourAgg.total_ebitda;
  const contributionAtt = pct(contributionActual, contributionTarget);

  return [
    { metric: 'LM Tours', weight_pct: 25, target: 120, actual: tours, attainment_pct: pct(tours, 120), payout_pct: payoutFromAttainment(pct(tours, 120)), status: 'Monthly' },
    { metric: 'LM Net Sales Volume', weight_pct: 20, target: '$1.5M', actual: fmtCompactUsd(nsv), attainment_pct: pct(nsv, 1500000), payout_pct: payoutFromAttainment(pct(nsv, 1500000)), status: 'Monthly' },
    { metric: 'Club Penetration Rate', weight_pct: 35, target: '20%', actual: `${Math.round(pen)}%`, attainment_pct: pct(pen, 20), payout_pct: payoutFromAttainment(pct(pen, 20)), status: 'Monthly' },
    { metric: 'Contribution Margin', weight_pct: 20, target: fmtCompactUsd(contributionTarget), actual: fmtCompactUsd(contributionActual), attainment_pct: contributionAtt, payout_pct: payoutFromAttainment(contributionAtt), status: 'Quarterly' },
  ];
}

function buildMarketingDirectorMetrics(reports: DirectReportRow[], tourAgg: TeamTourAggregates): MetricAttainmentRow[] {
  const totalNsv = reports.reduce((s, r) => s + (r.total_nsv ?? 0), 0);
  const newOwnerNsv = tourAgg.owner_nsv > 0 ? tourAgg.owner_nsv : totalNsv * 0.32;
  const regionalNsv = totalNsv * 1.15;
  const dcTarget = 1_800_000;
  const dcActual = tourAgg.total_ebitda;
  const dcAtt = pct(dcActual, dcTarget);

  return [
    { metric: 'Total Net Sales Volume (NSV)', weight_pct: 40, target: '$8.5M', actual: fmtCompactUsd(totalNsv), attainment_pct: pct(totalNsv, 8500000), payout_pct: payoutFromAttainment(pct(totalNsv, 8500000)), status: 'Monthly' },
    { metric: 'New Owner NSV', weight_pct: 20, target: '$3.0M', actual: fmtCompactUsd(newOwnerNsv), attainment_pct: pct(newOwnerNsv, 3000000), payout_pct: payoutFromAttainment(pct(newOwnerNsv, 3000000)), status: 'Monthly' },
    { metric: 'Regional NSV', weight_pct: 10, target: '$12.0M', actual: fmtCompactUsd(regionalNsv), attainment_pct: pct(regionalNsv, 12000000), payout_pct: payoutFromAttainment(pct(regionalNsv, 12000000)), status: 'Monthly' },
    { metric: 'DC Contribution', weight_pct: 30, target: fmtCompactUsd(dcTarget), actual: fmtCompactUsd(dcActual), attainment_pct: dcAtt, payout_pct: payoutFromAttainment(dcAtt), status: 'Quarterly' },
  ];
}

export function buildActionItems(
  _personaId: MarketingPersonaId | null,
  reports: DirectReportRow[],
  tours: UpcomingTour[],
  metrics: MetricAttainmentRow[],
): ActionItem[] {
  const items: ActionItem[] = [];
  const atRisk = reports.filter((r) => r.performance_band === 'AT_RISK');

  for (const rep of atRisk.slice(0, 3)) {
    items.push({
      priority: 'high',
      metric: 'Direct Report Quota Attainment',
      recommendation: `Coach ${rep.rep_name} on closing the ${Math.round(100 - rep.quota_attainment_pct)}% attainment gap — focus on pending deal credits and FFS package mix.`,
      evidence: `${rep.rep_name} at ${rep.quota_attainment_pct}% quota (${rep.performance_band}).`,
    });
  }

  const aLeadTours = tours.filter((t) => t.abc_score === 'A' && !t.closed_flag);
  for (const tour of aLeadTours.slice(0, 3)) {
    items.push({
      priority: 'high',
      metric: 'Qualified Tours / FPS Conversion',
      recommendation: `Prioritize tour ${tour.tour_id} (${tour.rep_name}, ${tour.lead_source} A-lead) — convert to FPS sale to add ~$${Math.round(tour.net_sales_volume / 1000)}K NSV toward LM NSV and penetration targets.`,
      evidence: `A-lead tour, VPG $${Math.round(tour.vpg)}, not yet closed.`,
    });
  }

  const lowMetric = metrics.find((m) => m.attainment_pct < 85);
  if (lowMetric) {
    items.push({
      priority: 'medium',
      metric: lowMetric.metric,
      recommendation: `Launch a 2-week SPIFF on ${lowMetric.metric} — current ${lowMetric.attainment_pct}% attainment is below the 85% accelerator gate; a focused STI can close the gap before quarterly true-up.`,
      evidence: `${lowMetric.metric}: ${lowMetric.actual} vs ${lowMetric.target} target (${lowMetric.attainment_pct}%).`,
    });
  }

  const notShown = tours.filter((t) => !t.showed_flag);
  for (const tour of notShown.slice(0, 2)) {
    items.push({
      priority: 'medium',
      metric: 'LM Tours / Show Rate',
      recommendation: `Confirm show for upcoming tour ${tour.tour_id} (${tour.rep_name}) — each qualified show adds ~$75–$150 toward tour volume metrics.`,
      evidence: `${tour.abc_score}-lead from ${tour.lead_source}, show not yet recorded.`,
    });
  }

  if (items.length === 0 && reports.length > 0) {
    const sorted = [...reports].sort((a, b) => b.quota_attainment_pct - a.quota_attainment_pct);
    const top = sorted[0];
    const bottom = sorted[sorted.length - 1];
    items.push({
      priority: 'medium',
      metric: 'Top Performer Leverage',
      recommendation: `Double-down with ${top.rep_name} (${top.rep_id}) — ${top.quota_attainment_pct}% attainment${top.tours_showed != null ? `, ${top.tours_showed} tours showed` : ''}. Pair with A-lead tour coverage to pull LM NSV and penetration metrics higher.`,
      evidence: `Highest attainment on the team; ${top.performance_band} band.`,
    });
    if (bottom.rep_id !== top.rep_id) {
      items.push({
        priority: 'medium',
        metric: 'Attainment Gap',
        recommendation: `Coach ${bottom.rep_name} (${bottom.rep_id}) on the ${Math.round(100 - bottom.quota_attainment_pct)}pt gap to plan — focus on show rate and close conversion on pending tours.`,
        evidence: `${bottom.quota_attainment_pct}% attainment (${bottom.performance_band}).`,
      });
    }
  }

  const nearThreshold = [...metrics]
    .filter((m) => m.attainment_pct >= 85 && m.attainment_pct < 115)
    .sort((a, b) => a.attainment_pct - b.attainment_pct)[0];
  if (nearThreshold) {
    items.push({
      priority: 'medium',
      metric: nearThreshold.metric,
      recommendation: `Run a short SPIFF on ${nearThreshold.metric} (${nearThreshold.weight_pct}% weight) — at ${nearThreshold.attainment_pct}% attainment you are ${Math.round(115 - nearThreshold.attainment_pct)}pts from the 115% accelerator gate worth ~${nearThreshold.payout_pct}% payout today.`,
      evidence: `${nearThreshold.actual} vs ${nearThreshold.target} target.`,
    });
  }

  const bestTour = tours
    .filter((t) => !t.closed_flag)
    .sort((a, b) => b.net_sales_volume - a.net_sales_volume)[0];
  if (bestTour) {
    items.push({
      priority: 'high',
      metric: 'Open Tour Conversion',
      recommendation: `Prioritize tour ${bestTour.tour_id} with ${bestTour.rep_name} (${bestTour.abc_score}-lead, ${bestTour.lead_source}) — ~$${Math.round(bestTour.net_sales_volume / 1000)}K NSV still open.`,
      evidence: bestTour.showed_flag ? 'Shown — needs close' : 'Pending show confirmation.',
    });
  }

  if (items.length === 0) {
    items.push({
      priority: 'low',
      metric: 'Team Performance',
      recommendation: 'No direct-report or tour signals in the current period — refresh period selection or verify manager hierarchy in dim_rep.',
      evidence: 'Empty direct-report and tour dataset for this manager/period.',
    });
  }

  return items.slice(0, 5);
}

export async function buildManagerWorkspace(
  runSql: RunSql,
  managerRepId: string,
  periodId: string,
  managerName?: string,
): Promise<ManagerWorkspacePayload> {
  const personaId = isMarketingPersona(managerRepId);
  const meta = resolveManagerMeta(managerRepId, personaId);

  let directReports: DirectReportRow[];
  if (personaId === 'marketing_director') {
    directReports = await fetchMarketingDirectReports(runSql, periodId, managerRepId, true);
  } else if (personaId === 'marketing_manager') {
    directReports = await fetchMarketingDirectReports(runSql, periodId, managerRepId, false);
  } else {
    directReports = await fetchSalesDirectReports(runSql, managerRepId, periodId);
  }

  const teamSnapRows = await runSql(`
    SELECT ts.*, t.team_name FROM workspace.hgv_comp.fact_team_snapshot ts
    JOIN workspace.hgv_comp.dim_team t ON t.team_id = ts.team_id
    JOIN workspace.hgv_comp.dim_rep m ON m.team_id = ts.team_id
    WHERE m.rep_id = '${managerRepId.replace(/'/g, "''")}' AND ts.period_id = '${periodId.replace(/'/g, "''")}'
    LIMIT 1
  `).catch(() => []);
  const teamSnap = teamSnapRows[0] ?? null;

  const teamAtt = directReports.length
    ? directReports.reduce((s, r) => s + r.quota_attainment_pct, 0) / directReports.length
    : teamSnap ? n(teamSnap.team_attainment_pct) : 0;

  const repIds = directReports.map((r) => r.rep_id);
  const tourAgg = await fetchTeamTourAggregates(runSql, repIds, periodId);

  const metricAttainment =
    personaId === 'marketing_director'
      ? buildMarketingDirectorMetrics(directReports, tourAgg)
      : personaId === 'marketing_manager'
        ? buildMarketingManagerMetrics(directReports, tourAgg)
        : buildSalesMetrics(directReports, teamSnap, tourAgg);

  const upcomingTours = await fetchUpcomingTours(runSql, periodId, repIds);
  const actionItems = buildActionItems(personaId, directReports, upcomingTours, metricAttainment);

  const mgrRow = await runSql(`
    SELECT rep_name FROM workspace.hgv_comp.dim_rep WHERE rep_id = '${managerRepId.replace(/'/g, "''")}' LIMIT 1
  `).catch(() => []);

  return {
    manager_rep_id: managerRepId,
    manager_name: managerName ?? (mgrRow[0] ? String(mgrRow[0].rep_name) : meta.name),
    role_title: meta.role,
    plan_id: meta.plan,
    persona_id: personaId,
    period_id: periodId,
    direct_reports: directReports,
    team_rollup: {
      report_count: directReports.length,
      team_attainment_pct: Math.round(teamAtt * 10) / 10,
      at_risk_count: directReports.filter((r) => r.performance_band === 'AT_RISK').length,
      top_performer_count: directReports.filter((r) => r.performance_band === 'TOP').length,
      total_team_nsv: directReports.reduce((s, r) => {
        if (personaId) return s + (r.total_nsv ?? 0);
        return s + (r.credited_amount ?? 0);
      }, 0),
      total_team_earnings: directReports.reduce((s, r) => s + r.total_earnings, 0),
      ffs_sales_pct: teamSnap ? n(teamSnap.ffs_sales_pct) : 0,
      ffs_target_pct: teamSnap ? n(teamSnap.ffs_target_pct) : 35,
    },
    metric_attainment: metricAttainment,
    upcoming_tours: upcomingTours,
    action_items: actionItems,
  };
}

export function formatCompactManagerInsightContext(
  payload: ManagerWorkspacePayload,
  planRows: { attribute: string; hgvPlan: string }[],
): string {
  const topReports = [...payload.direct_reports]
    .sort((a, b) => b.quota_attainment_pct - a.quota_attainment_pct)
    .slice(0, 6);
  const atRiskReports = payload.direct_reports
    .filter((r) => r.performance_band === 'AT_RISK')
    .slice(0, 4);
  const focusReports = [...new Map([...topReports, ...atRiskReports].map((r) => [r.rep_id, r])).values()];

  return [
    `## Manager: ${payload.manager_name} (${payload.role_title})`,
    `Plan: ${payload.plan_id} | Period: ${payload.period_id}`,
    '',
    '## Plan Assessment Summary',
    ...planRows.map((r) => `- **${r.attribute}**: ${r.hgvPlan}`),
    '',
    '## Team Rollup',
    JSON.stringify(payload.team_rollup, null, 2),
    '',
    '## Metric Attainment (weights → payout %)',
    JSON.stringify(payload.metric_attainment, null, 2),
    '',
    `## Direct Reports (top performers + at-risk, ${focusReports.length} of ${payload.direct_reports.length})`,
    JSON.stringify(focusReports, null, 2),
    '',
    `## Upcoming / Open Tours (top ${Math.min(payload.upcoming_tours.length, 10)})`,
    JSON.stringify(payload.upcoming_tours.slice(0, 10), null, 2),
    '',
    '## Recommended Actions (data-mined)',
    JSON.stringify(payload.action_items, null, 2),
  ].join('\n');
}

export function formatManagerCoachingSignalsContext(payload: ManagerWorkspacePayload): string {
  return [
    `## Manager: ${payload.manager_name} (${payload.role_title}) | Period: ${payload.period_id}`,
    '',
    '## Team Rollup',
    JSON.stringify(payload.team_rollup, null, 2),
    '',
    '## Metric Attainment (weights → payout %)',
    JSON.stringify(payload.metric_attainment, null, 2),
    '',
    '## Direct Reports',
    JSON.stringify(payload.direct_reports, null, 2),
    '',
    '## Open / Upcoming Tours',
    JSON.stringify(payload.upcoming_tours, null, 2),
    '',
    '## Deterministic Seed Signals (SQL-heuristic flags — refine into coaching priorities)',
    JSON.stringify(payload.action_items, null, 2),
  ].join('\n');
}

export function formatManagerGroundingContext(payload: ManagerWorkspacePayload, planRows: { attribute: string; hgvPlan: string }[]): string {
  return [
    `## Manager: ${payload.manager_name} (${payload.role_title})`,
    `Plan: ${payload.plan_id} | Period: ${payload.period_id}`,
    '',
    '## Plan Assessment Summary',
    ...planRows.map((r) => `- **${r.attribute}**: ${r.hgvPlan}`),
    '',
    '## Team Rollup',
    JSON.stringify(payload.team_rollup, null, 2),
    '',
    '## Metric Attainment (weights → payout %)',
    JSON.stringify(payload.metric_attainment, null, 2),
    '',
    '## Direct Reports',
    JSON.stringify(payload.direct_reports, null, 2),
    '',
    '## Upcoming / Open Tours',
    JSON.stringify(payload.upcoming_tours, null, 2),
    '',
    '## Recommended Actions (data-mined)',
    JSON.stringify(payload.action_items, null, 2),
    '',
    'When advising, tie recommendations to specific metrics, weights, payout curve gates, and named tours/reps from the data above.',
  ].join('\n');
}
