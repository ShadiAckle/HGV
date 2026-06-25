import type { RunSql } from './planAssessment.js';

/** Idempotent DDL + seeds for ICM plan model (dim_plan, fact_plan, dim_payee, fact_payee_plan). */
export async function ensureIcmPlanTables(runSql: RunSql): Promise<void> {
  const ddl = [
    `CREATE TABLE IF NOT EXISTS workspace.hgv_comp.dim_plan (
      row_uuid STRING NOT NULL, plan_id STRING NOT NULL,
      plan_name STRING NOT NULL, icm_role STRING NOT NULL
    ) USING DELTA`,
    `CREATE TABLE IF NOT EXISTS workspace.hgv_comp.fact_plan (
      row_uuid STRING NOT NULL, plan_id STRING NOT NULL, component STRING NOT NULL,
      component_type STRING NOT NULL, plan_name STRING, icm_role STRING NOT NULL,
      period_id STRING NOT NULL, tier_seq INT, min_qualified_tours INT,
      payout_per_unit DECIMAL(10, 2), tier_label STRING, is_active BOOLEAN NOT NULL
    ) USING DELTA`,
    `CREATE TABLE IF NOT EXISTS workspace.hgv_comp.dim_payee (
      row_uuid STRING NOT NULL, payee_id STRING NOT NULL,
      employee_id STRING NOT NULL, employee_name STRING NOT NULL
    ) USING DELTA`,
    `CREATE TABLE IF NOT EXISTS workspace.hgv_comp.fact_payee_plan (
      row_uuid STRING NOT NULL, payee_id STRING NOT NULL, plan_id STRING NOT NULL,
      employee_id STRING NOT NULL, icm_role STRING NOT NULL, period_id STRING NOT NULL
    ) USING DELTA`,
  ];
  for (const stmt of ddl) {
    try {
      await runSql(stmt);
    } catch (err) {
      console.warn('ICM plan DDL skipped:', err instanceof Error ? err.message : err);
    }
  }
}

export async function ensureIcmPlanMarketingSeeds(runSql: RunSql): Promise<void> {
  const seeds = [
    `INSERT INTO workspace.hgv_comp.dim_plan SELECT 'DP-MKT-REP-2026', 'PLAN-MKT-REP-2026', 'Marketing Plan', 'marketing'
     WHERE NOT EXISTS (SELECT 1 FROM workspace.hgv_comp.dim_plan WHERE plan_id = 'PLAN-MKT-REP-2026')`,
    `INSERT INTO workspace.hgv_comp.dim_plan SELECT 'DP-MKT-MGR-2026', 'PLAN-MKT-MGR-2026', 'Marketing Manager Plan', 'marketing_manager'
     WHERE NOT EXISTS (SELECT 1 FROM workspace.hgv_comp.dim_plan WHERE plan_id = 'PLAN-MKT-MGR-2026')`,
    `INSERT INTO workspace.hgv_comp.dim_plan SELECT 'DP-MKT-DIR-2026', 'PLAN-MKT-DIR-2026', 'Marketing Director Plan', 'marketing_director'
     WHERE NOT EXISTS (SELECT 1 FROM workspace.hgv_comp.dim_plan WHERE plan_id = 'PLAN-MKT-DIR-2026')`,
    `INSERT INTO workspace.hgv_comp.fact_plan
       SELECT 'FP-MKT-M1', 'PLAN-MKT-REP-2026', 'qualified tours', 'METRIC', 'Marketing Plan', 'marketing', '*',
              NULL, NULL, NULL, NULL, TRUE
       WHERE NOT EXISTS (SELECT 1 FROM workspace.hgv_comp.fact_plan WHERE plan_id = 'PLAN-MKT-REP-2026' AND component = 'qualified tours' AND component_type = 'METRIC')`,
    `INSERT INTO workspace.hgv_comp.fact_plan
       SELECT 'FP-MKT-M2', 'PLAN-MKT-REP-2026', 'individual fps packages', 'METRIC', 'Marketing Plan', 'marketing', '*',
              NULL, NULL, NULL, NULL, TRUE
       WHERE NOT EXISTS (SELECT 1 FROM workspace.hgv_comp.fact_plan WHERE plan_id = 'PLAN-MKT-REP-2026' AND component = 'individual fps packages' AND component_type = 'METRIC')`,
    `INSERT INTO workspace.hgv_comp.fact_plan
       SELECT 'FP-MKT-M3', 'PLAN-MKT-REP-2026', 'individual sales transactions', 'METRIC', 'Marketing Plan', 'marketing', '*',
              NULL, NULL, NULL, NULL, TRUE
       WHERE NOT EXISTS (SELECT 1 FROM workspace.hgv_comp.fact_plan WHERE plan_id = 'PLAN-MKT-REP-2026' AND component = 'individual sales transactions' AND component_type = 'METRIC')`,
    `INSERT INTO workspace.hgv_comp.fact_plan
       SELECT 'FP-MKT-T1', 'PLAN-MKT-REP-2026', 'qualified tour tier 1', 'TIER', 'Marketing Plan', 'marketing', '*',
              1, 0, 50.00, 'Tier 1', TRUE
       WHERE NOT EXISTS (SELECT 1 FROM workspace.hgv_comp.fact_plan WHERE plan_id = 'PLAN-MKT-REP-2026' AND component_type = 'TIER' AND tier_seq = 1)`,
    `INSERT INTO workspace.hgv_comp.fact_plan
       SELECT 'FP-MKT-T2', 'PLAN-MKT-REP-2026', 'qualified tour tier 2', 'TIER', 'Marketing Plan', 'marketing', '*',
              2, 3, 75.00, 'Tier 2', TRUE
       WHERE NOT EXISTS (SELECT 1 FROM workspace.hgv_comp.fact_plan WHERE plan_id = 'PLAN-MKT-REP-2026' AND component_type = 'TIER' AND tier_seq = 2)`,
    `INSERT INTO workspace.hgv_comp.fact_plan
       SELECT 'FP-MKT-T3', 'PLAN-MKT-REP-2026', 'qualified tour tier 3', 'TIER', 'Marketing Plan', 'marketing', '*',
              3, 6, 100.00, 'Tier 3', TRUE
       WHERE NOT EXISTS (SELECT 1 FROM workspace.hgv_comp.fact_plan WHERE plan_id = 'PLAN-MKT-REP-2026' AND component_type = 'TIER' AND tier_seq = 3)`,
    `INSERT INTO workspace.hgv_comp.fact_plan
       SELECT 'FP-MKT-T4', 'PLAN-MKT-REP-2026', 'qualified tour tier max', 'TIER', 'Marketing Plan', 'marketing', '*',
              4, 10, 100.00, 'Top Tier', TRUE
       WHERE NOT EXISTS (SELECT 1 FROM workspace.hgv_comp.fact_plan WHERE plan_id = 'PLAN-MKT-REP-2026' AND component_type = 'TIER' AND tier_seq = 4)`,
  ];
  for (const stmt of seeds) {
    try {
      await runSql(stmt);
    } catch (err) {
      console.warn('ICM plan seed skipped:', err instanceof Error ? err.message : err);
    }
  }
}
