import { CURRENT_PERIOD_ID } from '../shared/compPeriods.js';

type RunSql = (sql: string) => Promise<Record<string, unknown>[]>;

const ADMIN_DDL = [
  `CREATE TABLE IF NOT EXISTS workspace.hgv_comp.fact_plan_eligibility (
    rep_id STRING NOT NULL, period_id STRING NOT NULL, plan_version_id STRING NOT NULL,
    job_code STRING NOT NULL, location_code STRING NOT NULL, brand STRING NOT NULL,
    effective_start DATE NOT NULL, effective_end DATE, proration_pct DECIMAL(5,2) NOT NULL,
    eligibility_flag BOOLEAN NOT NULL, exclusion_reason STRING
  ) USING DELTA`,
  `CREATE TABLE IF NOT EXISTS workspace.hgv_comp.fact_comp_admin_log (
    event_id STRING NOT NULL, rep_id STRING NOT NULL, period_id STRING NOT NULL,
    event_type STRING NOT NULL, amount DECIMAL(14,2), reason STRING NOT NULL,
    approved_by STRING, created_at TIMESTAMP NOT NULL
  ) USING DELTA`,
  `CREATE TABLE IF NOT EXISTS workspace.hgv_comp.fact_chargeback (
    chargeback_id STRING NOT NULL, deal_id STRING NOT NULL, rep_id STRING NOT NULL,
    period_id STRING NOT NULL, original_commission DECIMAL(14,2) NOT NULL,
    chargeback_amount DECIMAL(14,2) NOT NULL, reserve_held DECIMAL(14,2) NOT NULL,
    reserve_released DECIMAL(14,2) NOT NULL, reason STRING NOT NULL, status STRING NOT NULL
  ) USING DELTA`,
];

export async function ensureAdminFinanceTables(runSql: RunSql): Promise<void> {
  for (const stmt of ADMIN_DDL) {
    try {
      await runSql(stmt);
    } catch (err) {
      console.warn('admin finance DDL skipped:', err instanceof Error ? err.message : err);
    }
  }

  const periodId = CURRENT_PERIOD_ID;
  try {
    await runSql(`
      INSERT INTO workspace.hgv_comp.dim_plan_version (plan_version_id, plan_name, effective_start, effective_end)
      SELECT 'PLAN-FT-2026', 'Full-Time 2026 Commission Plan', DATE '2026-04-01', NULL
      WHERE NOT EXISTS (
        SELECT 1 FROM workspace.hgv_comp.dim_plan_version WHERE plan_version_id = 'PLAN-FT-2026'
      )
    `);
    await runSql(`
      INSERT INTO workspace.hgv_comp.dim_plan_version (plan_version_id, plan_name, effective_start, effective_end)
      SELECT 'PLAN-MGR-2025', 'Manager Override Plan 2025', DATE '2026-04-01', NULL
      WHERE NOT EXISTS (
        SELECT 1 FROM workspace.hgv_comp.dim_plan_version WHERE plan_version_id = 'PLAN-MGR-2025'
      )
    `);
  } catch (err) {
    console.warn('admin plan version seed skipped:', err instanceof Error ? err.message : err);
  }

  let eligCnt = 0;
  try {
    const rows = await runSql(
      `SELECT COUNT(*) AS cnt FROM workspace.hgv_comp.fact_plan_eligibility WHERE period_id = '${periodId}'`,
    );
    eligCnt = Number(rows[0]?.cnt ?? 0);
  } catch {
    return;
  }
  if (eligCnt > 0) return;

  console.info('Seeding comp admin finance tables...');
  const inserts = [
    `INSERT INTO workspace.hgv_comp.fact_plan_eligibility VALUES
      ('REP-JASON', '${periodId}', 'PLAN-FT-2026', 'FT-SALES-L6', 'LAS', 'HGV', DATE '2026-04-01', NULL, 100.00, TRUE, NULL),
      ('REP-RSMITH', '${periodId}', 'PLAN-FT-2026', 'FT-SALES-L6', 'ORL', 'HGV', DATE '2026-04-01', NULL, 100.00, TRUE, NULL),
      ('REP-ECARTER', '${periodId}', 'PLAN-FT-2026', 'FT-SALES-L5', 'ORL', 'Diamond', DATE '2026-04-01', NULL, 100.00, TRUE, NULL),
      ('REP-DLEE', '${periodId}', 'PLAN-FT-2026', 'FT-SALES-L6', 'SDG', 'HGV', DATE '2025-01-15', NULL, 58.33, TRUE, NULL),
      ('REP-KNGUYEN', '${periodId}', 'PLAN-FT-2026', 'FT-SALES-L7', 'LAS', 'HGV', DATE '2026-04-01', NULL, 100.00, TRUE, NULL),
      ('REP-MGR-01', '${periodId}', 'PLAN-MGR-2025', 'FT-MGR-L9', 'LAS', 'HGV', DATE '2026-04-01', NULL, 100.00, TRUE, NULL)`,
    `INSERT INTO workspace.hgv_comp.fact_comp_admin_log VALUES
      ('ADMEVT-0001', 'REP-JASON', '${periodId}', 'ADJUSTMENT', 1250.00, 'Deal correction on DEAL-003 after contract amendment', 'VP Compensation', TIMESTAMP '2026-05-22 09:14:00'),
      ('ADMEVT-0002', 'REP-ECARTER', '${periodId}', 'LOA_START', NULL, 'Medical leave effective 2026-05-01; quota relief applied', NULL, TIMESTAMP '2026-05-01 08:00:00'),
      ('ADMEVT-0003', 'REP-ECARTER', '${periodId}', 'LOA_END', NULL, 'Return from medical leave; active status restored', NULL, TIMESTAMP '2026-05-15 08:00:00'),
      ('ADMEVT-0004', 'REP-RSMITH', '${periodId}', 'RESCISSION', -875.00, 'Commission clawback for DEAL-007 rescission', 'VP Compensation', TIMESTAMP '2026-05-29 11:45:00'),
      ('ADMEVT-0005', 'REP-JASON', '${periodId}', 'SPIFF', 500.00, 'Q2 FFS product push SPIFF', 'Regional Dir', TIMESTAMP '2026-05-05 14:30:00'),
      ('ADMEVT-0006', 'REP-KNGUYEN', '${periodId}', 'SPIFF', 750.00, 'Discovery tour target SPIFF', 'Regional Dir', TIMESTAMP '2026-06-28 16:00:00'),
      ('ADMEVT-0007', 'REP-DLEE', '${periodId}', 'CHARGEBACK', -1100.00, 'Chargeback for DEAL-009 rescission', 'VP Compensation', TIMESTAMP '2026-05-12 10:20:00'),
      ('ADMEVT-0015', 'REP-JASON', '${periodId}', 'MANUAL_PAY', 3000.00, 'VIP owner referral bonus', 'Regional Dir', TIMESTAMP '2026-06-20 14:00:00')`,
    `INSERT INTO workspace.hgv_comp.fact_chargeback VALUES
      ('CB-001', 'DEAL-007', 'REP-RSMITH', '${periodId}', 1400.00, 1400.00, 840.00, 840.00, 'RESCISSION', 'CLOSED'),
      ('CB-002', 'DEAL-009', 'REP-DLEE', '${periodId}', 1100.00, 1100.00, 660.00, 0.00, 'RESCISSION', 'OPEN'),
      ('CB-005', 'DEAL-003', 'REP-JASON', '${periodId}', 1750.00, 1750.00, 1050.00, 0.00, 'RESCISSION', 'PENDING'),
      ('CB-006', 'DEAL-006', 'REP-KNGUYEN', '${periodId}', 500.00, 500.00, 300.00, 0.00, 'CANCEL', 'OPEN'),
      ('CB-008', 'DEAL-008', 'REP-ECARTER', '${periodId}', 650.00, 650.00, 390.00, 0.00, 'DATA_ERROR', 'OPEN')`,
  ];

  for (const stmt of inserts) {
    try {
      await runSql(stmt);
    } catch (err) {
      console.warn('admin finance seed row skipped:', err instanceof Error ? err.message : err);
    }
  }
}
