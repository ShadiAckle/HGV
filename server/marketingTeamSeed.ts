import {
  ALL_MARKETING_TEAM_MEMBERS,
  MARKETING_PERIOD_ID,
} from '../shared/marketingTeamRoster.js';
import { derivePlanMetricEarnings, netStatementPayout } from '../shared/marketingEarningsAlign.js';
import { CURRENT_PERIOD_ID } from '../shared/compPeriods.js';

type RunSql = (sql: string) => Promise<Record<string, unknown>[]>;

function esc(value: string): string {
  return value.replace(/'/g, "''");
}

async function tableCount(runSql: RunSql, table: string, where: string): Promise<number> {
  try {
    const rows = await runSql(`SELECT COUNT(*) AS cnt FROM workspace.hgv_comp.${table} WHERE ${where}`);
    return Number(rows[0]?.cnt ?? 0);
  } catch {
    return 0;
  }
}

/** Collapse duplicate fact_rep_market_position rows (bootstrap + seed double-insert). */
export async function dedupeRepMarketPositions(runSql: RunSql, periodId: string): Promise<void> {
  const safePeriod = periodId.replace(/'/g, "''");
  try {
    const dupRows = await runSql(`
      SELECT COUNT(*) AS dup_reps FROM (
        SELECT rep_id FROM workspace.hgv_comp.fact_rep_market_position
        WHERE period_id = '${safePeriod}'
        GROUP BY rep_id HAVING COUNT(*) > 1
      )
    `);
    if (Number(dupRows[0]?.dup_reps ?? 0) === 0) return;

    console.info(`Deduping fact_rep_market_position for ${periodId}...`);
    await runSql(`
      CREATE OR REPLACE TEMP VIEW _mp_keep AS
      SELECT rep_id, period_id,
             MAX(rep_name) AS rep_name,
             MAX(role_key) AS role_key,
             MAX(tcc_gap_vs_market_pct) AS tcc_gap_vs_market_pct,
             MAX(base_pct) AS base_pct,
             MAX(variable_pct) AS variable_pct,
             MAX(quota_attainment_pct) AS quota_attainment_pct
      FROM workspace.hgv_comp.fact_rep_market_position
      WHERE period_id = '${safePeriod}'
      GROUP BY rep_id, period_id
    `);
    await runSql(`DELETE FROM workspace.hgv_comp.fact_rep_market_position WHERE period_id = '${safePeriod}'`);
    await runSql(`
      INSERT INTO workspace.hgv_comp.fact_rep_market_position
      SELECT rep_id, period_id, rep_name, role_key, tcc_gap_vs_market_pct, base_pct, variable_pct, quota_attainment_pct
      FROM _mp_keep
    `);
  } catch (err) {
    console.warn('fact_rep_market_position dedupe skipped:', err instanceof Error ? err.message : err);
  }
}

/** Idempotent — seeds diverse marketing field roster when MKT-REP-001 is absent. */
export async function ensureMarketingTeamRoster(runSql: RunSql): Promise<void> {
  const periodId = MARKETING_PERIOD_ID || CURRENT_PERIOD_ID;
  const exists = await tableCount(runSql, 'dim_rep', "rep_id = 'MKT-REP-001'");
  if (exists > 0) return;

  console.info('Seeding marketing team roster (at-risk, top, ramp, regional mix)...');

  const mgrUpdates = [
    `UPDATE workspace.hgv_comp.dim_rep SET manager_rep_id = 'PERSONA-MKT-DIR' WHERE rep_id = 'PERSONA-MKT-MGR' AND manager_rep_id IS NULL`,
  ];
  for (const stmt of mgrUpdates) {
    try {
      await runSql(stmt);
    } catch (err) {
      console.warn('manager hierarchy update skipped:', err instanceof Error ? err.message : err);
    }
  }

  try {
    await runSql(`DELETE FROM workspace.hgv_comp.fact_rep_market_position WHERE period_id = '${periodId}' AND rep_id LIKE 'DR-%'`);
  } catch {
    /* table may be empty */
  }

  await dedupeRepMarketPositions(runSql, periodId);

  for (const member of ALL_MARKETING_TEAM_MEMBERS) {
    const p = member.period;
    const m = member.market;
    const aligned = derivePlanMetricEarnings(
      {
        qualified_tour_pay: p.qualified_tour_pay,
        courtesy_tour_pay: p.courtesy_tour_pay,
        penetration_spiff: p.penetration_spiff,
        chargebacks: p.chargebacks,
        total_payout: p.total_payout,
      },
      p.qtd_earnings,
    );
    const netPayout = netStatementPayout(
      {
        qualified_tour_pay: p.qualified_tour_pay,
        courtesy_tour_pay: p.courtesy_tour_pay,
        penetration_spiff: p.penetration_spiff,
        chargebacks: p.chargebacks,
        total_payout: p.total_payout,
      },
      aligned.grossTotal,
    );

    try {
      await runSql(`
        INSERT INTO workspace.hgv_comp.dim_rep (rep_id, rep_name, level_code, team_id, manager_rep_id, region, is_active)
        SELECT '${member.rep_id}', '${esc(member.rep_name)}', '${member.level_code}', '${member.team_id}',
               '${member.manager_rep_id}', '${member.region}', TRUE
        WHERE NOT EXISTS (SELECT 1 FROM workspace.hgv_comp.dim_rep WHERE rep_id = '${member.rep_id}')
      `);

      await runSql(`
        INSERT INTO workspace.hgv_comp.fact_marketing_rep_period VALUES (
          '${member.rep_id}', '${periodId}', '${esc(member.rep_name)}', 'PLAN-MKT-REP-2026',
          '${esc(p.assigned_area)}', 'LV-HGV-AL',
          ${p.qtd_earnings}, ${p.paid_to_date}, ${p.qualified_tours}, ${p.tours_shown},
          ${p.show_rate_pct}, ${p.penetration_pct}, ${p.penetration_target_pct}, ${p.spiff_active},
          '${esc(p.next_tier_label)}', ${p.next_tier_gap_tours},
          ${p.qualified_tour_pay}, ${p.courtesy_tour_pay}, ${p.penetration_spiff},
          ${p.chargebacks}, ${netPayout}, ${p.base_pct}, ${p.variable_pct}, ${p.tcc_gap_vs_market_pct}
        )
      `);

      await runSql(`
        INSERT INTO workspace.hgv_comp.fact_marketing_rep_metric VALUES
          ('${member.rep_id}', '${periodId}', 'Qualified Tours (Owner, New Buyer)', 45, ${aligned.qualifiedTours}, ${Math.round((p.qualified_tours / Math.max(p.tours_shown, 1)) * 100)}, '${p.qualified_tours} qualified tours', ${Math.max(0, (5 - p.qualified_tours) * 75)}),
          ('${member.rep_id}', '${periodId}', 'Individual FPS Packages', 35, ${aligned.fps}, ${p.penetration_pct}, 'Penetration ${p.penetration_pct}% vs ${p.penetration_target_pct}% target', ${Math.max(0, (p.penetration_target_pct - p.penetration_pct) * 40)}),
          ('${member.rep_id}', '${periodId}', 'Individual Sales Transactions', 20, ${aligned.sales}, ${Math.min(100, m.quota_attainment_pct)}, 'QTD variable ${p.qtd_earnings}', ${Math.max(0, 100 - m.quota_attainment_pct) * 25})
      `);

      await runSql(`
        INSERT INTO workspace.hgv_comp.fact_rep_market_position
          (rep_id, period_id, rep_name, role_key, tcc_gap_vs_market_pct, base_pct, variable_pct, quota_attainment_pct)
        SELECT '${member.rep_id}', '${periodId}', '${esc(member.rep_name)}', 'marketing_rep',
          ${m.tcc_gap_vs_market_pct}, ${m.base_pct}, ${m.variable_pct}, ${m.quota_attainment_pct}
        WHERE NOT EXISTS (
          SELECT 1 FROM workspace.hgv_comp.fact_rep_market_position
          WHERE rep_id = '${member.rep_id}' AND period_id = '${periodId}'
        )
      `);

      for (const tour of member.tours) {
        const ebitda = tour.net_sales_volume > 0 ? Math.round(tour.net_sales_volume * 0.2 * 100) / 100 : 0;
        await runSql(`
          INSERT INTO workspace.hgv_comp.fact_tour_quality VALUES (
            '${tour.tour_id}', '${member.rep_id}', '${periodId}',
            '${esc(tour.lead_source)}', '${tour.abc_score}', '${esc(tour.package_type)}',
            ${tour.showed_flag}, ${tour.closed_flag}, '${tour.contract_status}', ${tour.rescission_flag},
            ${tour.net_sales_volume}, ${tour.vpg}, ${ebitda}
          )
        `);
      }
    } catch (err) {
      console.warn(`marketing roster seed skipped for ${member.rep_id}:`, err instanceof Error ? err.message : err);
    }
  }
}

/** Refresh market position rows to align rep_ids with roster (fixes legacy DR-* ids). */
export async function refreshMarketingMarketPositions(runSql: RunSql): Promise<void> {
  const periodId = MARKETING_PERIOD_ID || CURRENT_PERIOD_ID;
  const legacy = await tableCount(runSql, 'fact_rep_market_position', `period_id = '${periodId}' AND rep_id LIKE 'DR-%'`);
  const modern = await tableCount(runSql, 'fact_rep_market_position', `period_id = '${periodId}' AND rep_id = 'MKT-REP-001'`);
  if (legacy === 0 || modern > 0) return;

  console.info('Migrating fact_rep_market_position from DR-* to MKT-REP-* ids...');
  try {
    await runSql(`DELETE FROM workspace.hgv_comp.fact_rep_market_position WHERE period_id = '${periodId}' AND rep_id LIKE 'DR-%'`);
  } catch {
    return;
  }

  for (const member of ALL_MARKETING_TEAM_MEMBERS.filter((m) => m.team_id === 'TEAM-MKT-LAS')) {
    const m = member.market;
    try {
      await runSql(`
        INSERT INTO workspace.hgv_comp.fact_rep_market_position
          (rep_id, period_id, rep_name, role_key, tcc_gap_vs_market_pct, base_pct, variable_pct, quota_attainment_pct)
        SELECT '${member.rep_id}', '${periodId}', '${esc(member.rep_name)}', 'marketing_rep',
          ${m.tcc_gap_vs_market_pct}, ${m.base_pct}, ${m.variable_pct}, ${m.quota_attainment_pct}
        WHERE NOT EXISTS (
          SELECT 1 FROM workspace.hgv_comp.fact_rep_market_position
          WHERE rep_id = '${member.rep_id}' AND period_id = '${periodId}'
        )
      `);
    } catch (err) {
      console.warn(`market position migrate skipped for ${member.rep_id}:`, err instanceof Error ? err.message : err);
    }
  }
}

/** Idempotent — adds at-risk sales rep + FFS mix when REP-VTESTER is absent. */
export async function ensureSalesDiversitySeed(runSql: RunSql): Promise<void> {
  const exists = await tableCount(runSql, 'dim_rep', "rep_id = 'REP-VTESTER'");
  if (exists > 0) return;

  console.info('Seeding sales diversity (at-risk rep, FFS mix, open tours)...');
  const periodId = CURRENT_PERIOD_ID;
  const stmts = [
    `INSERT INTO workspace.hgv_comp.dim_rep VALUES ('REP-VTESTER', 'V. Tester', 'L4', 'TEAM-WEST', 'REP-MGR-01', 'West', TRUE)`,
    `INSERT INTO workspace.hgv_comp.fact_quota_attainment VALUES ('REP-VTESTER', '${periodId}', 'PLAN-2026-V1', 50000, 20000, 40, 2, 75, 30000)`,
    `INSERT INTO workspace.hgv_comp.fact_payout VALUES ('REP-VTESTER', '${periodId}', 5000, 1800, 500, 7300, 7300)`,
    `INSERT INTO workspace.hgv_comp.fact_rep_product_mix VALUES ('REP-RSMITH', '${periodId}', 'PROD-FFS', 28)`,
    `INSERT INTO workspace.hgv_comp.fact_rep_product_mix VALUES ('REP-ECARTER', '${periodId}', 'PROD-FFS', 9)`,
    `INSERT INTO workspace.hgv_comp.fact_rep_product_mix VALUES ('REP-DLEE', '${periodId}', 'PROD-FFS', 6)`,
    `INSERT INTO workspace.hgv_comp.fact_rep_product_mix VALUES ('REP-KNGUYEN', '${periodId}', 'PROD-FFS', 31)`,
    `INSERT INTO workspace.hgv_comp.fact_rep_product_mix VALUES ('REP-VTESTER', '${periodId}', 'PROD-FFS', 4)`,
    `INSERT INTO workspace.hgv_comp.fact_tour_quality VALUES ('TOUR-Q1-051', 'REP-VTESTER', '${periodId}', 'OPC', 'D', 'Discovery', FALSE, FALSE, 'NONE', FALSE, 0, 0, 0)`,
    `INSERT INTO workspace.hgv_comp.fact_tour_quality VALUES ('TOUR-Q1-052', 'REP-VTESTER', '${periodId}', 'Mail', 'D', 'Discovery', TRUE, FALSE, 'NONE', FALSE, 0, 0, 0)`,
    `INSERT INTO workspace.hgv_comp.fact_tour_quality VALUES ('TOUR-Q1-053', 'REP-VTESTER', '${periodId}', 'Internet', 'C', 'Preview', TRUE, TRUE, 'ACTIVE', FALSE, 1800, 900, 360)`,
    `INSERT INTO workspace.hgv_comp.fact_tour_quality VALUES ('TOUR-Q1-054', 'REP-JASON', '${periodId}', 'Referral', 'A', 'Flex', TRUE, FALSE, 'NONE', FALSE, 0, 0, 0)`,
    `UPDATE workspace.hgv_comp.fact_team_snapshot SET team_attainment_pct = 82.5, at_risk_count = 2, top_performer_count = 2, ffs_sales_pct = 14, ffs_target_pct = 20 WHERE team_id = 'TEAM-WEST' AND period_id = '${periodId}'`,
  ];

  for (const stmt of stmts) {
    try {
      await runSql(stmt);
    } catch (err) {
      console.warn('sales diversity seed skipped:', err instanceof Error ? err.message : err);
    }
  }
}
