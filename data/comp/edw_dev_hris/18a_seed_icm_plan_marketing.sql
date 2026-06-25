-- =============================================================================
-- ICM plan seeds — marketing channel (idempotent)
-- Run after 18_create_icm_plan_model.sql or 00_CLEAN_AND_REBUILD.sql
-- =============================================================================

USE CATALOG edw_dev_hris;
USE SCHEMA hgv_comp;

-- ── dim_plan ────────────────────────────────────────────────────────────────
INSERT INTO edw_dev_hris.hgv_comp.dim_plan (row_uuid, plan_id, plan_name, icm_role)
SELECT 'DP-MKT-REP-2026', 'PLAN-MKT-REP-2026', 'Marketing Plan', 'marketing'
WHERE NOT EXISTS (SELECT 1 FROM edw_dev_hris.hgv_comp.dim_plan WHERE plan_id = 'PLAN-MKT-REP-2026');

INSERT INTO edw_dev_hris.hgv_comp.dim_plan (row_uuid, plan_id, plan_name, icm_role)
SELECT 'DP-MKT-MGR-2026', 'PLAN-MKT-MGR-2026', 'Marketing Manager Plan', 'marketing_manager'
WHERE NOT EXISTS (SELECT 1 FROM edw_dev_hris.hgv_comp.dim_plan WHERE plan_id = 'PLAN-MKT-MGR-2026');

INSERT INTO edw_dev_hris.hgv_comp.dim_plan (row_uuid, plan_id, plan_name, icm_role)
SELECT 'DP-MKT-DIR-2026', 'PLAN-MKT-DIR-2026', 'Marketing Director Plan', 'marketing_director'
WHERE NOT EXISTS (SELECT 1 FROM edw_dev_hris.hgv_comp.dim_plan WHERE plan_id = 'PLAN-MKT-DIR-2026');

-- ── fact_plan — metric components (PLAN-MKT-REP-2026) ───────────────────────
INSERT INTO edw_dev_hris.hgv_comp.fact_plan
  (row_uuid, plan_id, component, component_type, plan_name, icm_role, period_id,
   tier_seq, min_qualified_tours, payout_per_unit, tier_label, is_active)
SELECT 'FP-MKT-M1', 'PLAN-MKT-REP-2026', 'qualified tours', 'METRIC', 'Marketing Plan',
       'marketing', '*', NULL, NULL, NULL, NULL, TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM edw_dev_hris.hgv_comp.fact_plan
  WHERE plan_id = 'PLAN-MKT-REP-2026' AND component = 'qualified tours' AND component_type = 'METRIC'
);

INSERT INTO edw_dev_hris.hgv_comp.fact_plan
  (row_uuid, plan_id, component, component_type, plan_name, icm_role, period_id,
   tier_seq, min_qualified_tours, payout_per_unit, tier_label, is_active)
SELECT 'FP-MKT-M2', 'PLAN-MKT-REP-2026', 'individual fps packages', 'METRIC', 'Marketing Plan',
       'marketing', '*', NULL, NULL, NULL, NULL, TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM edw_dev_hris.hgv_comp.fact_plan
  WHERE plan_id = 'PLAN-MKT-REP-2026' AND component = 'individual fps packages' AND component_type = 'METRIC'
);

INSERT INTO edw_dev_hris.hgv_comp.fact_plan
  (row_uuid, plan_id, component, component_type, plan_name, icm_role, period_id,
   tier_seq, min_qualified_tours, payout_per_unit, tier_label, is_active)
SELECT 'FP-MKT-M3', 'PLAN-MKT-REP-2026', 'individual sales transactions', 'METRIC', 'Marketing Plan',
       'marketing', '*', NULL, NULL, NULL, NULL, TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM edw_dev_hris.hgv_comp.fact_plan
  WHERE plan_id = 'PLAN-MKT-REP-2026' AND component = 'individual sales transactions' AND component_type = 'METRIC'
);

-- ── fact_plan — qualified tour tier ladder (drives What's next hero) ────────
INSERT INTO edw_dev_hris.hgv_comp.fact_plan
  (row_uuid, plan_id, component, component_type, plan_name, icm_role, period_id,
   tier_seq, min_qualified_tours, payout_per_unit, tier_label, is_active)
SELECT 'FP-MKT-T1', 'PLAN-MKT-REP-2026', 'qualified tour tier 1', 'TIER', 'Marketing Plan',
       'marketing', '*', 1, 0, 50.00, 'Tier 1', TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM edw_dev_hris.hgv_comp.fact_plan
  WHERE plan_id = 'PLAN-MKT-REP-2026' AND component_type = 'TIER' AND tier_seq = 1
);

INSERT INTO edw_dev_hris.hgv_comp.fact_plan
  (row_uuid, plan_id, component, component_type, plan_name, icm_role, period_id,
   tier_seq, min_qualified_tours, payout_per_unit, tier_label, is_active)
SELECT 'FP-MKT-T2', 'PLAN-MKT-REP-2026', 'qualified tour tier 2', 'TIER', 'Marketing Plan',
       'marketing', '*', 2, 3, 75.00, 'Tier 2', TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM edw_dev_hris.hgv_comp.fact_plan
  WHERE plan_id = 'PLAN-MKT-REP-2026' AND component_type = 'TIER' AND tier_seq = 2
);

INSERT INTO edw_dev_hris.hgv_comp.fact_plan
  (row_uuid, plan_id, component, component_type, plan_name, icm_role, period_id,
   tier_seq, min_qualified_tours, payout_per_unit, tier_label, is_active)
SELECT 'FP-MKT-T3', 'PLAN-MKT-REP-2026', 'qualified tour tier 3', 'TIER', 'Marketing Plan',
       'marketing', '*', 3, 6, 100.00, 'Tier 3', TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM edw_dev_hris.hgv_comp.fact_plan
  WHERE plan_id = 'PLAN-MKT-REP-2026' AND component_type = 'TIER' AND tier_seq = 3
);

INSERT INTO edw_dev_hris.hgv_comp.fact_plan
  (row_uuid, plan_id, component, component_type, plan_name, icm_role, period_id,
   tier_seq, min_qualified_tours, payout_per_unit, tier_label, is_active)
SELECT 'FP-MKT-T4', 'PLAN-MKT-REP-2026', 'qualified tour tier max', 'TIER', 'Marketing Plan',
       'marketing', '*', 4, 10, 100.00, 'Top Tier', TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM edw_dev_hris.hgv_comp.fact_plan
  WHERE plan_id = 'PLAN-MKT-REP-2026' AND component_type = 'TIER' AND tier_seq = 4
);
