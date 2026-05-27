-- =============================================================================
-- HGV Comp — Finance reference layer (period budgets, thresholds, SPIFF attribution)
-- File: 05b_extend_finance_reference.sql
-- Schema: workspace.hgv_comp
-- Purpose: Governed finance config consumed by Finance Intelligence APIs
-- =============================================================================

CREATE TABLE IF NOT EXISTS workspace.hgv_comp.dim_finance_period (
  period_id                 STRING        NOT NULL,
  budget_comp               DECIMAL(14,2) NOT NULL,
  payroll_lock_date         DATE          NOT NULL,
  accrual_basis             STRING        NOT NULL,
  var_comp_target_min_pct   DECIMAL(5,2)  NOT NULL,
  var_comp_target_max_pct   DECIMAL(5,2)  NOT NULL,
  spiff_roi_threshold       DECIMAL(5,2)  NOT NULL,
  rescission_target_pct     DECIMAL(5,2)  NOT NULL,
  ebitda_margin_pct         DECIMAL(5,2)  NOT NULL,
  ffs_reserve_pct           DECIMAL(5,2)  NOT NULL,
  accrual_policy_notes      STRING
) USING DELTA
COMMENT 'Finance period config: budget, accrual calendar, ROI/corridor thresholds';

-- SPIFF incremental NSV attribution (ETL-populated per admin event)
ALTER TABLE workspace.hgv_comp.fact_comp_admin_log
  ADD COLUMN IF NOT EXISTS attributed_nsv DECIMAL(14,2);

-- Period finance config — 2026-Q2 (current)
INSERT INTO workspace.hgv_comp.dim_finance_period
  (period_id, budget_comp, payroll_lock_date, accrual_basis,
   var_comp_target_min_pct, var_comp_target_max_pct, spiff_roi_threshold,
   rescission_target_pct, ebitda_margin_pct, ffs_reserve_pct, accrual_policy_notes)
SELECT '2026-Q2', 14500000.00, DATE '2026-07-15',
  'Monthly earned, true-up quarterly',
  8.00, 12.00, 3.00, 8.00, 19.00, 12.00,
  'FFS reserve held 12% for 6-month rescission window; chargebacks netted in period of recognition'
WHERE NOT EXISTS (
  SELECT 1 FROM workspace.hgv_comp.dim_finance_period WHERE period_id = '2026-Q2'
);

INSERT INTO workspace.hgv_comp.dim_finance_period
  (period_id, budget_comp, payroll_lock_date, accrual_basis,
   var_comp_target_min_pct, var_comp_target_max_pct, spiff_roi_threshold,
   rescission_target_pct, ebitda_margin_pct, ffs_reserve_pct, accrual_policy_notes)
SELECT '2025-Q4', 13800000.00, DATE '2026-01-15',
  'Monthly earned, true-up quarterly',
  8.00, 12.00, 3.00, 8.00, 19.00, 12.00,
  'Prior-period finance control baseline'
WHERE NOT EXISTS (
  SELECT 1 FROM workspace.hgv_comp.dim_finance_period WHERE period_id = '2025-Q4'
);

-- Attribute incremental NSV to SPIFF / SPIFF_APPROVAL events (2026-Q2)
UPDATE workspace.hgv_comp.fact_comp_admin_log SET attributed_nsv = 2400.00
WHERE event_id = 'ADMEVT-0005' AND period_id = '2026-Q2' AND attributed_nsv IS NULL;

UPDATE workspace.hgv_comp.fact_comp_admin_log SET attributed_nsv = 3600.00
WHERE event_id = 'ADMEVT-0006' AND period_id = '2026-Q2' AND attributed_nsv IS NULL;

UPDATE workspace.hgv_comp.fact_comp_admin_log SET attributed_nsv = 42750.00
WHERE event_id = 'ADMEVT-0012' AND period_id = '2026-Q2' AND attributed_nsv IS NULL;

-- Bootstrap seed event ids (runtime adminFinanceSeed)
UPDATE workspace.hgv_comp.fact_comp_admin_log SET attributed_nsv = 2400.00
WHERE event_id = 'ADMEVT-0005' AND attributed_nsv IS NULL;

UPDATE workspace.hgv_comp.fact_comp_admin_log SET attributed_nsv = 3600.00
WHERE event_id = 'ADMEVT-0006' AND attributed_nsv IS NULL;
