import { buildMarketingMoneyMap, type MarketingDeskRank } from '../shared/marketingMoneyMap.js';
import type { MarketingRepWorkspacePayload } from './marketingRepWorkspace.js';

type RunSql = (sql: string) => Promise<Record<string, unknown>[]>;

function esc(value: string): string {
  return value.replace(/'/g, "''");
}

function rankDesc(values: Array<{ rep_id: string; value: number }>, repId: string): number {
  const sorted = [...values].sort((a, b) => b.value - a.value);
  const idx = sorted.findIndex((v) => v.rep_id === repId);
  return idx >= 0 ? idx + 1 : sorted.length + 1;
}

export async function fetchMarketingDeskRank(
  runSql: RunSql,
  repId: string,
  periodId: string,
  yourQualifiedRate: number,
  yourPenetration: number,
): Promise<MarketingDeskRank | null> {
  const safeRep = esc(repId);
  const safePeriod = esc(periodId);
  try {
    const rows = await runSql(`
      SELECT p.rep_id, p.qualified_tours, p.tours_shown, p.penetration_pct
      FROM workspace.hgv_comp.fact_marketing_rep_period p
      JOIN workspace.hgv_comp.dim_rep r ON r.rep_id = p.rep_id
      WHERE p.period_id = '${safePeriod}'
        AND r.team_id = (SELECT team_id FROM workspace.hgv_comp.dim_rep WHERE rep_id = '${safeRep}')
        AND r.level_code = 'C2a'
        AND r.is_active = TRUE
    `);
    if (rows.length < 2) return null;

    const qualifiedRates = rows.map((row) => {
      const shown = Number(row.tours_shown ?? 0);
      const qualified = Number(row.qualified_tours ?? 0);
      const rate = shown > 0 ? (qualified / shown) * 100 : 0;
      return { rep_id: String(row.rep_id), value: rate };
    });
    const penetrations = rows.map((row) => ({
      rep_id: String(row.rep_id),
      value: Number(row.penetration_pct ?? 0),
    }));

    const deskQualAvg =
      qualifiedRates.reduce((s, r) => s + r.value, 0) / Math.max(qualifiedRates.length, 1);
    const deskPenAvg =
      penetrations.reduce((s, r) => s + r.value, 0) / Math.max(penetrations.length, 1);

    return {
      team_size: rows.length,
      qualified_rate_rank: rankDesc(qualifiedRates, repId),
      penetration_rank: rankDesc(penetrations, repId),
      desk_qualified_rate_avg: Math.round(deskQualAvg * 10) / 10,
      desk_penetration_avg: Math.round(deskPenAvg * 10) / 10,
      your_qualified_rate_pct: yourQualifiedRate,
      your_penetration_pct: yourPenetration,
    };
  } catch (err) {
    console.warn('Desk rank query failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

export async function attachMoneyMapToWorkspace(
  runSql: RunSql,
  payload: MarketingRepWorkspacePayload,
): Promise<void> {
  const qualifiedRate =
    payload.kpis.tours_shown > 0
      ? Math.round((payload.kpis.qualified_tours / payload.kpis.tours_shown) * 1000) / 10
      : 0;

  const deskRank = await fetchMarketingDeskRank(
    runSql,
    payload.rep_id,
    payload.period_label.includes('Q') ? '2026-Q2' : payload.period_label,
    qualifiedRate,
    payload.kpis.penetration_pct,
  );

  // period_id lives on payload indirectly — use from tours or rep query; pass via caller
  payload.money_map = buildMarketingMoneyMap({
    rep_id: payload.rep_id,
    kpis: payload.kpis,
    plan_metrics: payload.plan_metrics,
    tours: payload.tours,
    upcoming_arrivals: payload.upcoming_arrivals,
    desk_rank: deskRank,
  });
}

export async function attachMoneyMapToWorkspaceWithPeriod(
  runSql: RunSql,
  payload: MarketingRepWorkspacePayload,
  periodId: string,
): Promise<void> {
  const qualifiedRate =
    payload.kpis.tours_shown > 0
      ? Math.round((payload.kpis.qualified_tours / payload.kpis.tours_shown) * 1000) / 10
      : 0;

  const deskRank = await fetchMarketingDeskRank(
    runSql,
    payload.rep_id,
    periodId,
    qualifiedRate,
    payload.kpis.penetration_pct,
  );

  payload.money_map = buildMarketingMoneyMap({
    rep_id: payload.rep_id,
    kpis: payload.kpis,
    plan_metrics: payload.plan_metrics,
    tours: payload.tours,
    upcoming_arrivals: payload.upcoming_arrivals,
    desk_rank: deskRank,
  });
}
