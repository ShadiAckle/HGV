/**
 * Idempotent warehouse seeds aligned to UI question catalogs (persona prompts,
 * admin/finance copilot chips, marketing tour ledger IDs, scenarios, etc.).
 */
import { CURRENT_PERIOD_ID, PRIOR_PERIOD_ID } from '../shared/compPeriods.js';

type RunSql = (sql: string) => Promise<Record<string, unknown>[]>;

async function tableCount(runSql: RunSql, table: string, where: string): Promise<number> {
  try {
    const rows = await runSql(`SELECT COUNT(*) AS cnt FROM workspace.hgv_comp.${table} WHERE ${where}`);
    return Number(rows[0]?.cnt ?? 0);
  } catch {
    return 0;
  }
}

async function rowExists(runSql: RunSql, table: string, where: string): Promise<boolean> {
  return (await tableCount(runSql, table, where)) > 0;
}

async function insertIfMissing(runSql: RunSql, sql: string, label: string): Promise<void> {
  try {
    await runSql(sql);
  } catch (err) {
    console.warn(`catalog seed skipped (${label}):`, err instanceof Error ? err.message : err);
  }
}

/** Master entry — safe to call on every app bootstrap. */
export async function ensureQuestionCatalogSeed(runSql: RunSql): Promise<void> {
  await ensureCatalogTables(runSql);
  await ensureCoreDimensionSeeds(runSql);
  await ensurePlanComponentSeeds(runSql);
  await ensureScenarioSeeds(runSql);
  await ensureSemanticDefinitionSeeds(runSql);
  await ensureAdminEventBackfill(runSql);
  await ensureChargebackBackfill(runSql);
  await ensureSalesTourQualityCorpus(runSql);
  await ensureMarketingCatalogLedger(runSql);
  await ensureCallCenterCreditLedger(runSql);
  await ensureManagerAndPersonaRoster(runSql);
  await ensurePriorPeriodFacts(runSql);
  await ensureTeamEastSnapshot(runSql);
  await ensureDealCreditReferences(runSql);
}

async function ensureCatalogTables(runSql: RunSql): Promise<void> {
  const ddl = [
    `CREATE TABLE IF NOT EXISTS workspace.hgv_comp.dim_plan_component (
      plan_version_id STRING NOT NULL, job_code STRING NOT NULL, location_code STRING,
      component_code STRING NOT NULL, component_name STRING NOT NULL,
      rate_pct DECIMAL(6,2), threshold_pct DECIMAL(6,2), amount_usd DECIMAL(14,2),
      hold_months INT, rule_notes STRING
    ) USING DELTA`,
    `CREATE TABLE IF NOT EXISTS workspace.hgv_comp.fact_call_center_credit (
      credit_id STRING NOT NULL, rep_id STRING NOT NULL, period_id STRING NOT NULL,
      entity_type STRING NOT NULL, entity_id STRING NOT NULL, guest_name STRING,
      credit_status STRING NOT NULL, credit_amount DECIMAL(14,2), reason STRING,
      event_date DATE
    ) USING DELTA`,
    `CREATE TABLE IF NOT EXISTS workspace.hgv_comp.semantic_definitions (
      metric_id STRING NOT NULL, display_name STRING NOT NULL, description STRING NOT NULL,
      category STRING NOT NULL, sql_expression STRING NOT NULL, source_tables STRING NOT NULL,
      owner STRING NOT NULL, created_at TIMESTAMP NOT NULL, updated_at TIMESTAMP NOT NULL,
      is_active BOOLEAN NOT NULL
    ) USING DELTA`,
  ];
  for (const stmt of ddl) {
    try {
      await runSql(stmt);
    } catch (err) {
      console.warn('catalog DDL skipped:', err instanceof Error ? err.message : err);
    }
  }
}

async function ensureCoreDimensionSeeds(runSql: RunSql): Promise<void> {
  const periodId = CURRENT_PERIOD_ID;
  const seeds = [
    `INSERT INTO workspace.hgv_comp.dim_product_line SELECT 'PROD-FFS', 'Fee-for-Service (FFS)', TRUE
     WHERE NOT EXISTS (SELECT 1 FROM workspace.hgv_comp.dim_product_line WHERE product_line_id = 'PROD-FFS')`,
    `INSERT INTO workspace.hgv_comp.dim_product_line SELECT 'PROD-CLUB', 'Club Membership', FALSE
     WHERE NOT EXISTS (SELECT 1 FROM workspace.hgv_comp.dim_product_line WHERE product_line_id = 'PROD-CLUB')`,
    `INSERT INTO workspace.hgv_comp.dim_product_line SELECT 'PROD-UPSELL', 'Premium Upsell Package', FALSE
     WHERE NOT EXISTS (SELECT 1 FROM workspace.hgv_comp.dim_product_line WHERE product_line_id = 'PROD-UPSELL')`,
    `INSERT INTO workspace.hgv_comp.dim_product_line SELECT 'PROD-GWK', 'Grand Waikikian 3PH', FALSE
     WHERE NOT EXISTS (SELECT 1 FROM workspace.hgv_comp.dim_product_line WHERE product_line_id = 'PROD-GWK')`,
    `INSERT INTO workspace.hgv_comp.dim_plan_version SELECT 'PLAN-2026-V1', '2026 Core Sales Plan', DATE '2026-04-01', NULL
     WHERE NOT EXISTS (SELECT 1 FROM workspace.hgv_comp.dim_plan_version WHERE plan_version_id = 'PLAN-2026-V1')`,
    `UPDATE workspace.hgv_comp.dim_rep SET rep_name = 'Jason Morrison' WHERE rep_id = 'REP-JASON' AND rep_name = 'Jason'`,
    `UPDATE workspace.hgv_comp.dim_rep SET rep_name = 'Robert Smith' WHERE rep_id = 'REP-RSMITH' AND rep_name = 'R. Smith'`,
    `INSERT INTO workspace.hgv_comp.fact_rep_product_mix SELECT 'REP-JASON', '${periodId}', 'PROD-FFS', 12
     WHERE NOT EXISTS (SELECT 1 FROM workspace.hgv_comp.fact_rep_product_mix WHERE rep_id = 'REP-JASON' AND period_id = '${periodId}' AND product_line_id = 'PROD-FFS')`,
    `INSERT INTO workspace.hgv_comp.fact_rep_product_mix SELECT 'REP-JASON', '${periodId}', 'PROD-CLUB', 38
     WHERE NOT EXISTS (SELECT 1 FROM workspace.hgv_comp.fact_rep_product_mix WHERE rep_id = 'REP-JASON' AND period_id = '${periodId}' AND product_line_id = 'PROD-CLUB')`,
    `INSERT INTO workspace.hgv_comp.fact_rep_product_mix SELECT 'REP-JASON', '${periodId}', 'PROD-UPSELL', 28
     WHERE NOT EXISTS (SELECT 1 FROM workspace.hgv_comp.fact_rep_product_mix WHERE rep_id = 'REP-JASON' AND period_id = '${periodId}' AND product_line_id = 'PROD-UPSELL')`,
    `INSERT INTO workspace.hgv_comp.fact_rep_product_mix SELECT 'REP-JASON', '${periodId}', 'PROD-GWK', 22
     WHERE NOT EXISTS (SELECT 1 FROM workspace.hgv_comp.fact_rep_product_mix WHERE rep_id = 'REP-JASON' AND period_id = '${periodId}' AND product_line_id = 'PROD-GWK')`,
  ];
  for (const stmt of seeds) {
    await insertIfMissing(runSql, stmt, 'core-dim');
  }
}

async function ensurePlanComponentSeeds(runSql: RunSql): Promise<void> {
  if (await tableCount(runSql, 'dim_plan_component', "plan_version_id = 'PLAN-FT-2026'") > 0) return;
  console.info('Seeding dim_plan_component for UI plan-component questions...');
  const components: Array<[string, string, string, string, string, number | null, number | null, number | null, number | null, string]> = [
    ['PLAN-FT-2026', 'FT-SALES-L6', 'LAS', 'BASE_COMMISSION', 'Base Commission Rate', 6.0, null, null, null, '6.0% on all credited deals'],
    ['PLAN-FT-2026', 'FT-SALES-L6', 'LAS', 'VOLUME_BONUS', 'Volume Bonus', 2.5, 100, null, null, '+2.5% at 100%+ quota attainment'],
    ['PLAN-FT-2026', 'FT-SALES-L6', 'LAS', 'RESERVE_FFS', 'FFS Reserve Hold', 12, null, null, 6, '12% held on FFS sales for 6 months'],
    ['PLAN-FT-2026', 'FT-SALES-L6', 'LAS', 'SPIFF', 'SPIFF Eligibility', null, null, 5000, null, 'Auto-approval under $5K; tiered approval above'],
    ['PLAN-FT-2026', 'FT-SALES-L6', 'LAS', 'QUOTA', 'Quota Target', null, null, 250000, null, 'L6 LAS quota $250,000 (REP-JASON)'],
    ['PLAN-FT-2026', 'FT-SALES-L6', 'LAS', 'PRORATION', 'Proration Rule', null, null, null, null, 'Pro-rated by days in period; LOA suspends eligibility'],
    ['PLAN-FT-2026', 'FT-SALES-L7', 'LAS', 'BASE_COMMISSION', 'Base Commission Rate', 6.0, null, null, null, 'Same plan rate as L6 on PLAN-FT-2026'],
    ['PLAN-FT-2026', 'FT-SALES-L7', 'LAS', 'VOLUME_BONUS', 'Volume Bonus', 2.5, 100, null, null, '+2.5% at 100%+ quota attainment'],
    ['PLAN-FT-2026', 'FT-SALES-L7', 'LAS', 'RESERVE_FFS', 'FFS Reserve Hold', 12, null, null, 6, '12% held on FFS sales for 6 months'],
    ['PLAN-FT-2026', 'FT-SALES-L7', 'LAS', 'ACCELERATOR', 'L7 Accelerator Tier', 1.0, 110, null, null, 'L7-only 110% accelerator threshold (REP-KNGUYEN)'],
    ['PLAN-FT-2026', 'FT-SALES-L7', 'LAS', 'QUOTA', 'Quota Target', null, null, 260000, null, 'L7 LAS quota $260,000 (REP-KNGUYEN)'],
    ['PLAN-FT-2026', 'FT-SALES-L6', 'ORL', 'QUOTA', 'Quota Target', null, null, 300000, null, 'L6 Orlando quota $300,000 (REP-RSMITH)'],
    ['PLAN-FT-2026', 'FT-SALES-L5', 'ORL', 'QUOTA', 'Quota Target', null, null, 220000, null, 'L5 Orlando quota $220,000 (REP-ECARTER)'],
    ['PLAN-FT-2026', 'FT-SALES-L6', 'SDG', 'PRORATION', 'New Hire Proration', null, null, null, null, '58.33% proration for mid-period hire (REP-DLEE)'],
  ];
  for (const [plan, job, loc, code, name, rate, thresh, amt, hold, notes] of components) {
    const rateSql = rate == null ? 'NULL' : String(rate);
    const threshSql = thresh == null ? 'NULL' : String(thresh);
    const amtSql = amt == null ? 'NULL' : String(amt);
    const holdSql = hold == null ? 'NULL' : String(hold);
    await insertIfMissing(
      runSql,
      `INSERT INTO workspace.hgv_comp.dim_plan_component VALUES (
        '${plan}', '${job}', '${loc}', '${code}', '${name.replace(/'/g, "''")}',
        ${rateSql}, ${threshSql}, ${amtSql}, ${holdSql}, '${notes.replace(/'/g, "''")}'
      )`,
      `plan-component-${code}-${job}`,
    );
  }
}

async function ensureScenarioSeeds(runSql: RunSql): Promise<void> {
  if (await rowExists(runSql, 'scenario_run', "scenario_id = 'SCN-BASELINE'")) return;
  console.info('Seeding scenario_run / scenario_result for comp analysis & finance prompts...');
  const periodId = CURRENT_PERIOD_ID;
  const runs = [
    ['SCN-BASELINE', 'Q1 Baseline', 0, 6, 0, 0, 0],
    ['SCN-SIM-01', 'Q2 Incentive Plan - Simulated', 5, 6.5, -5, 20, 10],
    ['SCN-PLAN-A', 'Scenario A - Plan Designer', 15, 6.5, -5, 20, 15],
    ['SCN-SPIFF-Q1', 'Ocean Breeze Q2 SPIFF', 0, 6, 0, 0, 0],
    ['SCN-LOA-ADJ', 'LOA Compensation Shield', 0, 6, 0, 0, 0],
    ['SCN-HIGH-RAMP', 'New Hire Action Line Ramp', -10, 6, 5, 15, -5],
    ['SCN-NOI-PROT', 'Margin Protection Plan', 5, 6, 10, 25, 0],
  ] as const;
  for (const [id, name, quota, comm, bonus, accel, tour] of runs) {
    await insertIfMissing(
      runSql,
      `INSERT INTO workspace.hgv_comp.scenario_run VALUES (
        '${id}', '${name}', '${periodId}', ${quota}, ${comm}, ${bonus}, ${accel}, ${tour}, 'comp_ops'
      )`,
      id,
    );
  }
  const results: Array<[string, number, number, number, number]> = [
    ['SCN-BASELINE', 14200000, 0, 14200000, 82],
    ['SCN-SIM-01', 14800000, 600000, 14800000, 87],
    ['SCN-PLAN-A', 15200000, 1000000, 15000000, 90],
    ['SCN-SPIFF-Q1', 14215000, 15000, 14215000, 84.5],
    ['SCN-LOA-ADJ', 14202000, 2000, 14202000, 82.2],
    ['SCN-HIGH-RAMP', 13800000, -400000, 13800000, 89],
    ['SCN-NOI-PROT', 15600000, 1400000, 15300000, 93.5],
  ];
  for (const [id, payout, impact, cost, perf] of results) {
    await insertIfMissing(
      runSql,
      `INSERT INTO workspace.hgv_comp.scenario_result VALUES ('${id}', ${payout}, ${impact}, ${cost}, ${perf})`,
      `result-${id}`,
    );
  }
  const series = [
    ['SCN-SIM-01', 'Current', 1, 'Apr', 1180000],
    ['SCN-SIM-01', 'Current', 2, 'May', 1210000],
    ['SCN-SIM-01', 'Current', 3, 'Jun', 1190000],
    ['SCN-SIM-01', 'Simulated', 1, 'Apr', 1230000],
    ['SCN-SIM-01', 'Simulated', 2, 'May', 1265000],
    ['SCN-SIM-01', 'Simulated', 3, 'Jun', 1245000],
  ];
  for (const [scn, seriesName, month, label, amt] of series) {
    await insertIfMissing(
      runSql,
      `INSERT INTO workspace.hgv_comp.scenario_payout_series VALUES ('${scn}', '${seriesName}', ${month}, '${label}', ${amt})`,
      `series-${scn}-${seriesName}-${month}`,
    );
  }
}

async function ensureSemanticDefinitionSeeds(runSql: RunSql): Promise<void> {
  if (await tableCount(runSql, 'semantic_definitions', 'is_active = true') > 0) return;
  console.info('Seeding semantic_definitions for governed metric grounding...');
  const metrics = [
    ['REP_EARNINGS', 'Total Earnings', 'Cumulative rep earnings for the active period.', 'KPI', 'SUM(total_earnings)', 'workspace.hgv_comp.fact_payout'],
    ['COMMISSION_EARNED', 'Commission Earned', 'Commission from completed deals.', 'KPI', 'SUM(commission)', 'workspace.hgv_comp.fact_payout'],
    ['REP_ATTAINMENT', 'Quota Attainment', 'Average quota attainment percentage.', 'Measure', 'AVG(attainment_pct)', 'workspace.hgv_comp.fact_quota_attainment'],
    ['NEXT_TIER_GAP', 'Gap to Next Tier', 'Remaining volume to next accelerator tier.', 'Calculated', 'SUM(next_tier_gap_amount)', 'workspace.hgv_comp.fact_quota_attainment'],
    ['VPG', 'Volume Per Guest', 'Net sales volume divided by showed tours.', 'Measure', 'AVG(vpg)', 'workspace.hgv_comp.fact_tour_quality'],
    ['SPIFF_ROI', 'SPIFF ROI', 'Attributed NSV divided by SPIFF spend.', 'Calculated', 'attributed_nsv / amount', 'workspace.hgv_comp.fact_comp_admin_log'],
  ];
  for (const [id, name, desc, cat, expr, tables] of metrics) {
    await insertIfMissing(
      runSql,
      `INSERT INTO workspace.hgv_comp.semantic_definitions VALUES (
        '${id}', '${name}', '${desc.replace(/'/g, "''")}', '${cat}',
        '${expr}', '${tables}', 'comp-ops@hgv.com', current_timestamp(), current_timestamp(), true
      )`,
      id,
    );
  }
}

async function ensureAdminEventBackfill(runSql: RunSql): Promise<void> {
  const periodId = CURRENT_PERIOD_ID;
  const events: Array<[string, string, string, number | null, string, string | null, string]> = [
    ['ADMEVT-0008', 'REP-ECARTER', 'MANUAL_PAY', 2000, 'Guaranteed draw payment during LOA period per company LOA compensation policy', 'VP Compensation', '2026-05-07 09:00:00'],
    ['ADMEVT-0009', 'REP-RSMITH', 'TRANSFER', null, 'Rep transferred from Las Vegas team to Orlando team effective 2026-01-10; quota reallocated', null, '2026-01-10 08:30:00'],
    ['ADMEVT-0010', 'REP-ECARTER', 'ADJUSTMENT', 650, 'Retroactive commission correction for DEAL-005; upgrade product classification corrected from L2 to L3', 'VP Compensation', '2026-05-18 13:15:00'],
    ['ADMEVT-0011', 'REP-DLEE', 'DATA_QUALITY_FIX', null, '3 tour records (TOUR-Q1-036, TOUR-Q1-037, TOUR-Q1-038) had missing payee_id; corrected in source system', null, '2026-05-03 15:45:00'],
    ['ADMEVT-0012', 'REP-MGR-01', 'SPIFF_APPROVAL', 15000, 'Q2 Ocean Breeze SPIFF contest approved: $15,000 total budget, all LAS reps eligible for Discovery tour volume', 'EVP Ops', '2026-04-06 10:00:00'],
    ['ADMEVT-0013', 'REP-RSMITH', 'CHARGEBACK', -2200, 'Chargeback for DEAL-002 cancellation post-rescission window; financed contract defaulted', 'VP Compensation', '2026-06-14 11:00:00'],
    ['ADMEVT-0014', 'REP-KNGUYEN', 'ADJUSTMENT', -400, 'Reversal of duplicate commission payment processed in May 28 pay cycle for DEAL-006', 'VP Compensation', '2026-06-03 09:30:00'],
  ];
  for (const [id, rep, type, amt, reason, approver, ts] of events) {
    if (await rowExists(runSql, 'fact_comp_admin_log', `event_id = '${id}'`)) continue;
    const amtSql = amt == null ? 'NULL' : String(amt);
    const approverSql = approver == null ? 'NULL' : `'${approver}'`;
    await insertIfMissing(
      runSql,
      `INSERT INTO workspace.hgv_comp.fact_comp_admin_log VALUES (
        '${id}', '${rep}', '${periodId}', '${type}', ${amtSql},
        '${reason.replace(/'/g, "''")}', ${approverSql}, TIMESTAMP '${ts}'
      )`,
      id,
    );
  }
  try {
    await runSql(`UPDATE workspace.hgv_comp.fact_comp_admin_log SET attributed_nsv = 42750 WHERE event_id = 'ADMEVT-0012' AND attributed_nsv IS NULL`);
    await runSql(`UPDATE workspace.hgv_comp.fact_comp_admin_log SET attributed_nsv = 2400 WHERE event_id = 'ADMEVT-0005' AND attributed_nsv IS NULL`);
    await runSql(`UPDATE workspace.hgv_comp.fact_comp_admin_log SET attributed_nsv = 3600 WHERE event_id = 'ADMEVT-0006' AND attributed_nsv IS NULL`);
  } catch {
    /* column may not exist yet */
  }
}

async function ensureChargebackBackfill(runSql: RunSql): Promise<void> {
  const periodId = CURRENT_PERIOD_ID;
  const rows: Array<[string, string, string, number, number, number, number, string, string]> = [
    ['CB-003', 'DEAL-002', 'REP-RSMITH', 2200, 2200, 1320, 1320, 'CANCEL', 'CLOSED'],
    ['CB-004', 'DEAL-005', 'REP-ECARTER', 875, 437.5, 262.5, 262.5, 'DATA_ERROR', 'CLOSED'],
    ['CB-007', 'DEAL-010', 'REP-DLEE', 2800, 2100, 1120, 0, 'RESCISSION', 'PENDING'],
  ];
  for (const [cbId, deal, rep, orig, cb, held, rel, reason, status] of rows) {
    if (await rowExists(runSql, 'fact_chargeback', `chargeback_id = '${cbId}'`)) continue;
    await insertIfMissing(
      runSql,
      `INSERT INTO workspace.hgv_comp.fact_chargeback VALUES (
        '${cbId}', '${deal}', '${rep}', '${periodId}',
        ${orig}, ${cb}, ${held}, ${rel}, '${reason}', '${status}'
      )`,
      cbId,
    );
  }
}

type TourRow = [string, string, string, string, string, boolean, boolean, string, boolean, number, number, number];

async function ensureSalesTourQualityCorpus(runSql: RunSql): Promise<void> {
  if (await tableCount(runSql, 'fact_tour_quality', "tour_id = 'TOUR-Q1-001'") > 0) return;
  console.info('Seeding sales fact_tour_quality corpus for finance & manager prompts...');
  const periodId = CURRENT_PERIOD_ID;
  const tours: TourRow[] = [
    ['TOUR-Q1-001', 'REP-JASON', 'OPC', 'A', 'Flex', true, true, 'ACTIVE', false, 3200, 1600, 640],
    ['TOUR-Q1-002', 'REP-JASON', 'Owner', 'B', 'Preview', true, true, 'ACTIVE', false, 2400, 1200, 480],
    ['TOUR-Q1-003', 'REP-JASON', 'Referral', 'A', 'Flex', true, true, 'RESCINDED', true, 3500, 1750, 700],
    ['TOUR-Q1-004', 'REP-JASON', 'OPC', 'C', 'Discovery', true, false, 'NONE', false, 0, 0, 0],
    ['TOUR-Q1-005', 'REP-JASON', 'Internet', 'B', 'Preview', true, true, 'ACTIVE', false, 2200, 1100, 440],
    ['TOUR-Q1-011', 'REP-RSMITH', 'OPC', 'B', 'Preview', true, true, 'ACTIVE', false, 1800, 900, 360],
    ['TOUR-Q1-012', 'REP-RSMITH', 'Referral', 'A', 'Flex', true, true, 'ACTIVE', false, 3200, 1600, 640],
    ['TOUR-Q1-014', 'REP-RSMITH', 'Mail', 'B', 'Discovery', true, true, 'RESCINDED', true, 2000, 1000, 400],
    ['TOUR-Q1-021', 'REP-ECARTER', 'OPC', 'C', 'Discovery', true, false, 'NONE', false, 0, 0, 0],
    ['TOUR-Q1-022', 'REP-ECARTER', 'Internet', 'B', 'Preview', true, true, 'ACTIVE', false, 1900, 950, 380],
    ['TOUR-Q1-031', 'REP-DLEE', 'OPC', 'D', 'Discovery', false, false, 'NONE', false, 0, 0, 0],
    ['TOUR-Q1-032', 'REP-DLEE', 'Referral', 'C', 'Preview', true, false, 'NONE', false, 0, 0, 0],
    ['TOUR-Q1-041', 'REP-KNGUYEN', 'OPC', 'A', 'Flex', true, true, 'ACTIVE', false, 3400, 1700, 680],
    ['TOUR-Q1-042', 'REP-KNGUYEN', 'Referral', 'A', 'Flex', true, true, 'ACTIVE', false, 3600, 1800, 720],
    ['TOUR-Q1-043', 'REP-KNGUYEN', 'OPC', 'B', 'Preview', true, true, 'ACTIVE', false, 2800, 1400, 560],
    ['TOUR-Q1-045', 'REP-KNGUYEN', 'OPC', 'C', 'Discovery', true, false, 'NONE', false, 0, 0, 0],
  ];
  for (const [tid, rep, lead, abc, pkg, showed, closed, status, resc, nsv, vpg, ebitda] of tours) {
    await insertIfMissing(
      runSql,
      `INSERT INTO workspace.hgv_comp.fact_tour_quality VALUES (
        '${tid}', '${rep}', '${periodId}', '${lead}', '${abc}', '${pkg}',
        ${showed}, ${closed}, '${status}', ${resc}, ${nsv}, ${vpg}, ${ebitda}
      )`,
      tid,
    );
  }
}

/** Marketing tour ledger IDs referenced in personaQuestionInventory (C2a). */
async function ensureMarketingCatalogLedger(runSql: RunSql): Promise<void> {
  const periodId = CURRENT_PERIOD_ID;
  const repIds = ['PERSONA-MKT-REP', 'MKT-REP-001'];
  for (const repId of repIds) {
    if (await rowExists(runSql, 'fact_marketing_tour_payout', `tour_id = 'T-55204' AND rep_id = '${repId}'`)) continue;
    if (!(await rowExists(runSql, 'dim_rep', `rep_id = '${repId}'`))) continue;
    console.info(`Seeding marketing tour ledger for ${repId}...`);
    const tours = [
      ['T-55122', 'Bruce Wayne', 'New Buyer', '2026-05-10', 'SHOWN', 'Q', 75, true, 420, 'Qualified NB — guest type: New Buyer (not owner/VIP/courtesy)'],
      ['T-55204', 'Peter Parker', 'Non-Owner', '2026-05-15', 'SHOWN', 'NQ', 20, false, 0, 'Courtesy rate — marked non-qualified (household income below threshold)'],
      ['T-55180', 'Clark Kent', 'Owner', '2026-05-12', 'NO_SHOW', '—', 0, true, 380, 'Owner no-show — $0 payout on booked tour'],
    ];
    for (const [tid, guest, gtype, dt, status, code, pay, fps, pot, notes] of tours) {
      await insertIfMissing(
        runSql,
        `INSERT INTO workspace.hgv_comp.fact_marketing_tour_payout VALUES (
          '${tid}', '${repId}', '${periodId}', '${guest}', '${gtype}', DATE '${dt}',
          '${status}', '${code}', ${pay}, ${fps}, ${pot}, '${String(notes).replace(/'/g, "''")}'
        )`,
        `${repId}-${tid}`,
      );
    }
    await insertIfMissing(
      runSql,
      `INSERT INTO workspace.hgv_comp.fact_marketing_chargeback
       SELECT 'CB-44102', '${repId}', '${periodId}', 'Lex Luthor', 'T-55219', '2× Vegas Show Tickets', 50, 'Premium gift chargeback — guest credit validation failure'
       WHERE NOT EXISTS (SELECT 1 FROM workspace.hgv_comp.fact_marketing_chargeback WHERE chargeback_id = 'CB-44102' AND rep_id = '${repId}')`,
      `${repId}-CB-44102`,
    );
    await insertIfMissing(
      runSql,
      `INSERT INTO workspace.hgv_comp.fact_marketing_arrival VALUES (
        'ARR-90112', '${repId}', '${periodId}', 'Diana Prince', 'New Buyer',
        '2026-05-24 09:30', 'Strip South', 100, 480, 580
      )`,
      `${repId}-ARR-90112`,
    );
    await insertIfMissing(
      runSql,
      `INSERT INTO workspace.hgv_comp.fact_marketing_arrival
       SELECT 'ARR-90412', '${repId}', '${periodId}', 'Tony Stark', 'Owner', '2026-05-24 10:00', 'Strip South', 75, 520, 595
       WHERE NOT EXISTS (SELECT 1 FROM workspace.hgv_comp.fact_marketing_arrival WHERE arrival_id = 'ARR-90412' AND rep_id = '${repId}')`,
      `${repId}-ARR-90412`,
    );
  }
  await insertIfMissing(
    runSql,
    `UPDATE workspace.hgv_comp.fact_marketing_tour_payout
     SET notes = 'Linked to arrival ARR-90112 — qualified Owner/NB tour'
     WHERE tour_id = 'T-55122' AND guest_name = 'Bruce Wayne'`,
    'arr-link',
  );
}

async function ensureCallCenterCreditLedger(runSql: RunSql): Promise<void> {
  const periodId = CURRENT_PERIOD_ID;
  await insertIfMissing(
    runSql,
    `INSERT INTO workspace.hgv_comp.dim_rep SELECT 'PERSONA-CC-REP', 'A. Martinez', 'C1', 'TEAM-MKT-LAS', 'PERSONA-MKT-MGR', 'West', TRUE
     WHERE NOT EXISTS (SELECT 1 FROM workspace.hgv_comp.dim_rep WHERE rep_id = 'PERSONA-CC-REP')`,
    'cc-rep',
  );
  if (await rowExists(runSql, 'fact_call_center_credit', "entity_id = 'PKG-89211'")) return;
  console.info('Seeding call-center credit ledger for C1 persona questions...');
  const credits: Array<[string, string, string, string, string, number, string, string]> = [
    ['CC-001', 'PACKAGE', 'PKG-89211', 'PKG Buyer', 'CREDITED', 125, 'Package sale PKG-89211 credited to telemarketing rep', '2026-05-08'],
    ['CC-002', 'PACKAGE', 'PKG-89104', 'Pending Guest', 'PENDING', 0, 'Package sale PKG-89104 not credited — missing activation date', '2026-05-11'],
    ['CC-003', 'ACTIVATION', 'BK-77211', 'Activation Guest', 'CREDITED', 40, 'Guest activation BK-77211 credited', '2026-05-09'],
    ['CC-004', 'ACTIVATION', 'BK-77344', 'Cancelled Guest', 'CLAWBACK', -40, 'Activation BK-77344 SPIFF clawed back — guest cancelled within 72h', '2026-05-14'],
    ['CC-005', 'TOUR', 'T-55104', 'Alex Chen', 'CREDITED', 25, 'Package buyer Alex Chen showed for tour T-55104', '2026-05-12'],
    ['CC-006', 'TOUR', 'T-55200', 'Robert Chen', 'PENDING', 0, 'Tour T-55200 for Robert Chen — booked, not yet shown', '2026-05-16'],
    ['CC-007', 'CONTRACT', 'CON-90184', 'Referral Guest', 'CREDITED', 180, 'Downstream referral credit for package holder contract CON-90184', '2026-05-18'],
  ];
  for (const [id, type, entity, guest, status, amt, reason, dt] of credits) {
    await insertIfMissing(
      runSql,
      `INSERT INTO workspace.hgv_comp.fact_call_center_credit VALUES (
        '${id}', 'PERSONA-CC-REP', '${periodId}', '${type}', '${entity}',
        '${guest.replace(/'/g, "''")}', '${status}', ${amt}, '${reason.replace(/'/g, "''")}', DATE '${dt}'
      )`,
      id,
    );
  }
}

async function ensureManagerAndPersonaRoster(runSql: RunSql): Promise<void> {
  const periodId = CURRENT_PERIOD_ID;
  const personas = [
    ['PERSONA-MKT-MGR', 'R. Castillo', 'C2b', 'TEAM-MKT-LAS'],
    ['PERSONA-MKT-DIR', 'D. Whitfield', 'C2c', 'TEAM-MKT-REG'],
  ];
  for (const [id, name, level, team] of personas) {
    await insertIfMissing(
      runSql,
      `INSERT INTO workspace.hgv_comp.dim_rep SELECT '${id}', '${name}', '${level}', '${team}', NULL, 'West', TRUE
       WHERE NOT EXISTS (SELECT 1 FROM workspace.hgv_comp.dim_rep WHERE rep_id = '${id}')`,
      id,
    );
  }
  if (!(await rowExists(runSql, 'fact_payout', `rep_id = 'REP-MGR-01' AND period_id = '${periodId}'`))) {
    await insertIfMissing(
      runSql,
      `INSERT INTO workspace.hgv_comp.fact_payout VALUES ('REP-MGR-01', '${periodId}', 12000, 8500, 3200, 23700, 23500)`,
      'mgr-payout',
    );
    await insertIfMissing(
      runSql,
      `INSERT INTO workspace.hgv_comp.fact_quota_attainment VALUES (
        'REP-MGR-01', '${periodId}', 'PLAN-MGR-2025', 800000, 720000, 90, 42, 100, 80000
      )`,
      'mgr-quota',
    );
  }
}

async function ensurePriorPeriodFacts(runSql: RunSql): Promise<void> {
  const prior = PRIOR_PERIOD_ID;
  if (await rowExists(runSql, 'fact_payout', `period_id = '${prior}' AND rep_id = 'REP-JASON'`)) return;
  console.info('Seeding prior-period facts for quarter-over-quarter copilot prompts...');
  const reps: Array<[string, number, number, number, number, number, number, number, number]> = [
    ['REP-JASON', 4800, 9800, 2800, 17400, 17000, 240000, 218000, 91],
    ['REP-RSMITH', 5000, 12800, 3600, 21400, 21000, 280000, 294000, 105],
    ['REP-KNGUYEN', 4900, 11200, 2500, 18600, 18200, 250000, 238000, 95],
  ];
  for (const [rep, base, comm, bonus, earn, paid, quota, credited, att] of reps) {
    await insertIfMissing(
      runSql,
      `INSERT INTO workspace.hgv_comp.fact_payout SELECT '${rep}', '${prior}', ${base}, ${comm}, ${bonus}, ${earn}, ${paid}
       WHERE NOT EXISTS (SELECT 1 FROM workspace.hgv_comp.fact_payout WHERE rep_id = '${rep}' AND period_id = '${prior}')`,
      `prior-payout-${rep}`,
    );
    await insertIfMissing(
      runSql,
      `INSERT INTO workspace.hgv_comp.fact_quota_attainment SELECT '${rep}', '${prior}', 'PLAN-2026-V1', ${quota}, ${credited}, ${att}, 16, 100, ${quota - credited}
       WHERE NOT EXISTS (SELECT 1 FROM workspace.hgv_comp.fact_quota_attainment WHERE rep_id = '${rep}' AND period_id = '${prior}')`,
      `prior-quota-${rep}`,
    );
  }
}

async function ensureTeamEastSnapshot(runSql: RunSql): Promise<void> {
  const periodId = CURRENT_PERIOD_ID;
  await insertIfMissing(
    runSql,
    `INSERT INTO workspace.hgv_comp.fact_team_snapshot SELECT 'TEAM-EAST', '${periodId}', 78.5, 1, 1, 12, 20
     WHERE NOT EXISTS (SELECT 1 FROM workspace.hgv_comp.fact_team_snapshot WHERE team_id = 'TEAM-EAST' AND period_id = '${periodId}')`,
    'team-east',
  );
}

async function ensureDealCreditReferences(runSql: RunSql): Promise<void> {
  const periodId = CURRENT_PERIOD_ID;
  const deals: Array<[string, string, string, string, string, number, string, string]> = [
    ['DEAL-002', 'REP-RSMITH', 'PROD-CLUB', 'ORL-CLUB', 'Orlando Club Rescission Risk', 22000, 'RESCINDED', '2026-04-18'],
    ['DEAL-003', 'REP-JASON', 'PROD-GWK', 'GWK-002', 'Grand Waikikian Rescission Pending', 17500, 'PENDING', '2026-05-02'],
    ['DEAL-005', 'REP-ECARTER', 'PROD-UPSELL', 'ORL-UPG', 'Orlando Upgrade Package', 8750, 'CREDITED', '2026-05-10'],
    ['DEAL-006', 'REP-KNGUYEN', 'PROD-CLUB', 'LV-CLUB', 'Las Vegas Club Sale', 5000, 'CANCELLED', '2026-05-20'],
    ['DEAL-007', 'REP-RSMITH', 'PROD-FFS', 'FFS-007', 'FFS Rescission Deal', 8400, 'RESCINDED', '2026-04-28'],
    ['DEAL-009', 'REP-DLEE', 'PROD-FFS', 'FFS-009', 'FFS Open Chargeback Deal', 11000, 'RESCINDED', '2026-05-01'],
    ['DEAL-010', 'REP-DLEE', 'PROD-GWK', 'GWK-010', 'GWK Pending Chargeback', 28000, 'PENDING', '2026-06-05'],
  ];
  for (const [id, rep, prod, sku, name, amt, status, dt] of deals) {
    if (await rowExists(runSql, 'fact_deal_credit', `deal_id = '${id}'`)) continue;
    await insertIfMissing(
      runSql,
      `INSERT INTO workspace.hgv_comp.fact_deal_credit VALUES (
        '${id}', '${rep}', '${periodId}', '${prod}', '${sku}', '${name.replace(/'/g, "''")}',
        ${amt}, '${status}', DATE '${dt}'
      )`,
      id,
    );
  }
}

/** Plan roster + components for admin copilot grounding. */
export async function fetchPlanCatalogContext(
  runSql: RunSql,
  periodId: string,
): Promise<{ roster: Record<string, unknown>[]; components: Record<string, unknown>[] }> {
  const safePeriod = periodId.replace(/'/g, "''");
  let roster: Record<string, unknown>[] = [];
  let components: Record<string, unknown>[] = [];
  try {
    roster = await runSql(`
      SELECT r.rep_name, r.level_code, pe.job_code, pe.location_code, pe.plan_version_id,
             COALESCE(pv.plan_name, pe.plan_version_id) AS plan_name, pe.proration_pct, pe.eligibility_flag
      FROM workspace.hgv_comp.fact_plan_eligibility pe
      JOIN workspace.hgv_comp.dim_rep r ON r.rep_id = pe.rep_id
      LEFT JOIN workspace.hgv_comp.dim_plan_version pv ON pv.plan_version_id = pe.plan_version_id
      WHERE pe.period_id = '${safePeriod}'
      ORDER BY pe.location_code, pe.job_code
    `);
  } catch {
    /* tables may not exist */
  }
  try {
    components = await runSql(`
      SELECT plan_version_id, job_code, location_code, component_code, component_name,
             rate_pct, threshold_pct, amount_usd, hold_months, rule_notes
      FROM workspace.hgv_comp.dim_plan_component
      ORDER BY job_code, location_code, component_code
    `);
  } catch {
    /* table may not exist yet */
  }
  return { roster, components };
}
