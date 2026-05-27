import { CURRENT_PERIOD_ID, PRIOR_PERIOD_ID } from '../shared/compPeriods.js';

type RunSql = (sql: string) => Promise<Record<string, unknown>[]>;

const FINANCE_PERIOD_DDL = `
  CREATE TABLE IF NOT EXISTS workspace.hgv_comp.dim_finance_period (
    period_id STRING NOT NULL,
    budget_comp DECIMAL(14,2) NOT NULL,
    payroll_lock_date DATE NOT NULL,
    accrual_basis STRING NOT NULL,
    var_comp_target_min_pct DECIMAL(5,2) NOT NULL,
    var_comp_target_max_pct DECIMAL(5,2) NOT NULL,
    spiff_roi_threshold DECIMAL(5,2) NOT NULL,
    rescission_target_pct DECIMAL(5,2) NOT NULL,
    ebitda_margin_pct DECIMAL(5,2) NOT NULL,
    ffs_reserve_pct DECIMAL(5,2) NOT NULL,
    accrual_policy_notes STRING
  ) USING DELTA
`;

const FINANCE_PERIOD_SEEDS: Array<{
  periodId: string;
  budget: number;
  lockDate: string;
  notes: string;
}> = [
  {
    periodId: CURRENT_PERIOD_ID,
    budget: 14_500_000,
    lockDate: '2026-07-15',
    notes: 'FFS reserve held 12% for 6-month rescission window; chargebacks netted in period of recognition',
  },
  {
    periodId: PRIOR_PERIOD_ID,
    budget: 13_800_000,
    lockDate: '2026-01-15',
    notes: 'Prior-period finance control baseline',
  },
];

const SPIFF_ATTRIBUTION: Array<{ eventId: string; attributedNsv: number }> = [
  { eventId: 'ADMEVT-0005', attributedNsv: 2400 },
  { eventId: 'ADMEVT-0006', attributedNsv: 3600 },
  { eventId: 'ADMEVT-0012', attributedNsv: 42750 },
];

/** Idempotent finance reference layer — period config + SPIFF NSV attribution column. */
export async function ensureFinanceReferenceTables(runSql: RunSql): Promise<void> {
  try {
    await runSql(FINANCE_PERIOD_DDL);
  } catch (err) {
    console.warn('dim_finance_period DDL skipped:', err instanceof Error ? err.message : err);
  }

  try {
    await runSql(
      'ALTER TABLE workspace.hgv_comp.fact_comp_admin_log ADD COLUMN attributed_nsv DECIMAL(14,2)',
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!/already exists|FIELD_ALREADY_EXISTS|DUPLICATE_COLUMN/i.test(msg)) {
      console.warn('fact_comp_admin_log attributed_nsv migration skipped:', msg);
    }
  }

  for (const seed of FINANCE_PERIOD_SEEDS) {
    try {
      await runSql(`
        INSERT INTO workspace.hgv_comp.dim_finance_period
          (period_id, budget_comp, payroll_lock_date, accrual_basis,
           var_comp_target_min_pct, var_comp_target_max_pct, spiff_roi_threshold,
           rescission_target_pct, ebitda_margin_pct, ffs_reserve_pct, accrual_policy_notes)
        SELECT '${seed.periodId}', ${seed.budget}, DATE '${seed.lockDate}',
          'Monthly earned, true-up quarterly',
          8.00, 12.00, 3.00, 8.00, 19.00, 12.00,
          '${seed.notes.replace(/'/g, "''")}'
        WHERE NOT EXISTS (
          SELECT 1 FROM workspace.hgv_comp.dim_finance_period WHERE period_id = '${seed.periodId}'
        )
      `);
    } catch (err) {
      console.warn(`dim_finance_period seed skipped for ${seed.periodId}:`, err instanceof Error ? err.message : err);
    }
  }

  for (const row of SPIFF_ATTRIBUTION) {
    try {
      await runSql(`
        UPDATE workspace.hgv_comp.fact_comp_admin_log
        SET attributed_nsv = ${row.attributedNsv}
        WHERE event_id = '${row.eventId}' AND attributed_nsv IS NULL
      `);
    } catch (err) {
      console.warn(`SPIFF attribution skipped for ${row.eventId}:`, err instanceof Error ? err.message : err);
    }
  }
}

export async function loadFinancePeriodConfig(
  runSql: RunSql,
  periodId: string,
): Promise<Record<string, unknown> | null> {
  try {
    const rows = await runSql(`
      SELECT period_id, budget_comp, CAST(payroll_lock_date AS STRING) AS payroll_lock_date,
             accrual_basis, var_comp_target_min_pct, var_comp_target_max_pct,
             spiff_roi_threshold, rescission_target_pct, ebitda_margin_pct,
             ffs_reserve_pct, accrual_policy_notes
      FROM workspace.hgv_comp.dim_finance_period
      WHERE period_id = '${periodId.replace(/'/g, "''")}'
    `);
    return rows[0] ?? null;
  } catch {
    return null;
  }
}
