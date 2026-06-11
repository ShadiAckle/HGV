-- One-shot DDL bootstrap for edw_dev_hris.hgv_comp

-- Paste into SQL Editor and Run All, or use scripts/setup-comp-data-edw-dev-hris.ps1

-- Catalog edw_dev_hris must already exist.



-- ----- 01_create_schema.sql -----

-- Catalog: edw_dev_hris | Schema: hgv_comp
--
-- HGV Sales Compensation — star schema DDL
-- Run once on a SQL warehouse (edw_dev_hris catalog must already exist).

CREATE SCHEMA IF NOT EXISTS edw_dev_hris.hgv_comp
COMMENT 'Synthetic Hilton Grand Vacations sales compensation data for agent POC';

CREATE OR REPLACE TABLE edw_dev_hris.hgv_comp.dim_team (
  team_id STRING NOT NULL,
  team_name STRING NOT NULL,
  region STRING NOT NULL
) USING DELTA
COMMENT 'Sales team dimension';

CREATE OR REPLACE TABLE edw_dev_hris.hgv_comp.dim_rep (
  rep_id STRING NOT NULL,
  rep_name STRING NOT NULL,
  level_code STRING NOT NULL,
  team_id STRING NOT NULL,
  manager_rep_id STRING,
  region STRING NOT NULL,
  is_active BOOLEAN NOT NULL
) USING DELTA
COMMENT 'Sales rep dimension';

CREATE OR REPLACE TABLE edw_dev_hris.hgv_comp.dim_period (
  period_id STRING NOT NULL,
  period_label STRING NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  is_current BOOLEAN NOT NULL
) USING DELTA
COMMENT 'Pay / reporting period';

CREATE OR REPLACE TABLE edw_dev_hris.hgv_comp.dim_plan_version (
  plan_version_id STRING NOT NULL,
  plan_name STRING NOT NULL,
  effective_start DATE NOT NULL,
  effective_end DATE
) USING DELTA
COMMENT 'Compensation plan version';

CREATE OR REPLACE TABLE edw_dev_hris.hgv_comp.dim_product_line (
  product_line_id STRING NOT NULL,
  product_line_name STRING NOT NULL,
  is_ffs BOOLEAN NOT NULL
) USING DELTA
COMMENT 'Product line (FFS vs other mix)';

CREATE OR REPLACE TABLE edw_dev_hris.hgv_comp.fact_quota_attainment (
  rep_id STRING NOT NULL,
  period_id STRING NOT NULL,
  plan_version_id STRING NOT NULL,
  quota_amount DECIMAL(14, 2) NOT NULL,
  credited_amount DECIMAL(14, 2) NOT NULL,
  attainment_pct DECIMAL(6, 2) NOT NULL,
  deals_closed_count INT NOT NULL,
  next_tier_threshold_pct DECIMAL(6, 2) NOT NULL,
  next_tier_gap_amount DECIMAL(14, 2) NOT NULL
) USING DELTA
COMMENT 'Rep quota and attainment by period';

CREATE OR REPLACE TABLE edw_dev_hris.hgv_comp.fact_payout (
  rep_id STRING NOT NULL,
  period_id STRING NOT NULL,
  base_pay DECIMAL(14, 2) NOT NULL,
  commission DECIMAL(14, 2) NOT NULL,
  bonus DECIMAL(14, 2) NOT NULL,
  total_earnings DECIMAL(14, 2) NOT NULL,
  total_paid DECIMAL(14, 2) NOT NULL
) USING DELTA
COMMENT 'Rep payout breakdown by period';

CREATE OR REPLACE TABLE edw_dev_hris.hgv_comp.fact_deal_credit (
  deal_id STRING NOT NULL,
  rep_id STRING NOT NULL,
  period_id STRING NOT NULL,
  product_line_id STRING NOT NULL,
  property_code STRING NOT NULL,
  property_display_name STRING NOT NULL,
  credit_amount DECIMAL(14, 2) NOT NULL,
  credit_status STRING NOT NULL,
  credit_date DATE NOT NULL
) USING DELTA
COMMENT 'Deal-level quota credit';

CREATE OR REPLACE TABLE edw_dev_hris.hgv_comp.fact_team_snapshot (
  team_id STRING NOT NULL,
  period_id STRING NOT NULL,
  team_attainment_pct DECIMAL(6, 2) NOT NULL,
  top_performer_count INT NOT NULL,
  at_risk_count INT NOT NULL,
  ffs_sales_pct DECIMAL(6, 2) NOT NULL,
  ffs_target_pct DECIMAL(6, 2) NOT NULL
) USING DELTA
COMMENT 'Manager team KPI snapshot';

CREATE OR REPLACE TABLE edw_dev_hris.hgv_comp.fact_rep_product_mix (
  rep_id STRING NOT NULL,
  period_id STRING NOT NULL,
  product_line_id STRING NOT NULL,
  mix_pct DECIMAL(6, 2) NOT NULL
) USING DELTA
COMMENT 'Rep product mix share';

CREATE OR REPLACE TABLE edw_dev_hris.hgv_comp.scenario_run (
  scenario_id STRING NOT NULL,
  scenario_name STRING NOT NULL,
  period_id STRING NOT NULL,
  quota_change_pct DECIMAL(6, 2) NOT NULL,
  commission_rate_pct DECIMAL(6, 2) NOT NULL,
  bonus_rate_change_pct DECIMAL(6, 2) NOT NULL,
  accelerator_change_pct DECIMAL(6, 2) NOT NULL,
  tour_volume_change_pct DECIMAL(6, 2) NOT NULL,
  conversion_rate_change_pct DECIMAL(6, 2) NOT NULL,
  created_by STRING NOT NULL
) USING DELTA
COMMENT 'What-if scenario inputs';

CREATE OR REPLACE TABLE edw_dev_hris.hgv_comp.scenario_result (
  scenario_id STRING NOT NULL,
  projected_payouts DECIMAL(16, 2) NOT NULL,
  budget_impact DECIMAL(16, 2) NOT NULL,
  projected_cost DECIMAL(16, 2) NOT NULL,
  expected_performance_pct DECIMAL(6, 2) NOT NULL
) USING DELTA
COMMENT 'What-if scenario outputs';

CREATE OR REPLACE TABLE edw_dev_hris.hgv_comp.scenario_payout_series (
  scenario_id STRING NOT NULL,
  series_label STRING NOT NULL,
  bucket_order INT NOT NULL,
  bucket_label STRING NOT NULL,
  payout_amount DECIMAL(16, 2) NOT NULL
) USING DELTA
COMMENT 'Payouts vs budget chart series';



-- ----- 05_extend_admin_finance.sql -----

-- HGV Comp — Admin + Finance Schema Extension
-- File: 05_extend_admin_finance.sql
-- Schema: edw_dev_hris.hgv_comp
-- Purpose: Adds tables for Comp Admin Agent and Finance Agent
-- Created: 2026-Q2 rollout

-- ---------------------------------------------------------------------------
-- Table 1: fact_plan_eligibility
-- Tracks plan assignment, eligibility, and proration per rep per period
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS edw_dev_hris.hgv_comp.fact_plan_eligibility (
  rep_id            STRING      NOT NULL,
  period_id         STRING      NOT NULL,
  plan_version_id   STRING      NOT NULL,
  job_code          STRING      NOT NULL,
  location_code     STRING      NOT NULL,
  brand             STRING      NOT NULL,
  effective_start   DATE        NOT NULL,
  effective_end     DATE,
  proration_pct     DECIMAL(5,2) NOT NULL,
  eligibility_flag  BOOLEAN     NOT NULL,
  exclusion_reason  STRING
) USING DELTA
COMMENT 'Plan eligibility and assignment per rep per period';

-- ---------------------------------------------------------------------------
-- Table 2: fact_comp_admin_log
-- Audit log for all compensation administration events
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS edw_dev_hris.hgv_comp.fact_comp_admin_log (
  event_id     STRING        NOT NULL,
  rep_id       STRING        NOT NULL,
  period_id    STRING        NOT NULL,
  event_type   STRING        NOT NULL,
  amount       DECIMAL(14,2),
  reason       STRING        NOT NULL,
  approved_by  STRING,
  created_at   TIMESTAMP     NOT NULL,
  attributed_nsv DECIMAL(14,2)
) USING DELTA
COMMENT 'Audit log of all compensation administration events';

-- ---------------------------------------------------------------------------
-- Table 3: fact_chargeback
-- Chargeback and reserve detail per deal
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS edw_dev_hris.hgv_comp.fact_chargeback (
  chargeback_id       STRING        NOT NULL,
  deal_id             STRING        NOT NULL,
  rep_id              STRING        NOT NULL,
  period_id           STRING        NOT NULL,
  original_commission DECIMAL(14,2) NOT NULL,
  chargeback_amount   DECIMAL(14,2) NOT NULL,
  reserve_held        DECIMAL(14,2) NOT NULL,
  reserve_released    DECIMAL(14,2) NOT NULL,
  reason              STRING        NOT NULL,
  status              STRING        NOT NULL
) USING DELTA
COMMENT 'Chargeback and reserve detail per deal';

-- ---------------------------------------------------------------------------
-- Table 4: fact_tour_quality
-- Tour-level quality and performance data for Finance analysis
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS edw_dev_hris.hgv_comp.fact_tour_quality (
  tour_id           STRING        NOT NULL,
  rep_id            STRING        NOT NULL,
  period_id         STRING        NOT NULL,
  lead_source       STRING        NOT NULL,
  abc_score         STRING        NOT NULL,
  package_type      STRING        NOT NULL,
  showed_flag       BOOLEAN       NOT NULL,
  closed_flag       BOOLEAN       NOT NULL,
  contract_status   STRING        NOT NULL,
  rescission_flag   BOOLEAN       NOT NULL,
  net_sales_volume  DECIMAL(14,2) NOT NULL,
  vpg               DECIMAL(10,2) NOT NULL,
  ebitda_estimate   DECIMAL(14,2) NOT NULL
) USING DELTA
COMMENT 'Tour-level quality and performance data for Finance analysis';



-- ----- 05b_extend_finance_reference.sql -----

-- HGV Comp — Finance reference layer (period budgets, thresholds, SPIFF attribution)
-- File: 05b_extend_finance_reference.sql
-- Schema: edw_dev_hris.hgv_comp
-- Purpose: Governed finance config consumed by Finance Intelligence APIs

CREATE TABLE IF NOT EXISTS edw_dev_hris.hgv_comp.dim_finance_period (
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

-- attributed_nsv is on fact_comp_admin_log DDL in 05_extend_admin_finance.sql

-- Period finance config — 2026-Q2 (current)
INSERT INTO edw_dev_hris.hgv_comp.dim_finance_period
  (period_id, budget_comp, payroll_lock_date, accrual_basis,
   var_comp_target_min_pct, var_comp_target_max_pct, spiff_roi_threshold,
   rescission_target_pct, ebitda_margin_pct, ffs_reserve_pct, accrual_policy_notes)
SELECT '2026-Q2', 14500000.00, DATE '2026-07-15',
  'Monthly earned, true-up quarterly',
  8.00, 12.00, 3.00, 8.00, 19.00, 12.00,
  'FFS reserve held 12% for 6-month rescission window; chargebacks netted in period of recognition'
WHERE NOT EXISTS (
  SELECT 1 FROM edw_dev_hris.hgv_comp.dim_finance_period WHERE period_id = '2026-Q2'
);

INSERT INTO edw_dev_hris.hgv_comp.dim_finance_period
  (period_id, budget_comp, payroll_lock_date, accrual_basis,
   var_comp_target_min_pct, var_comp_target_max_pct, spiff_roi_threshold,
   rescission_target_pct, ebitda_margin_pct, ffs_reserve_pct, accrual_policy_notes)
SELECT '2025-Q4', 13800000.00, DATE '2026-01-15',
  'Monthly earned, true-up quarterly',
  8.00, 12.00, 3.00, 8.00, 19.00, 12.00,
  'Prior-period finance control baseline'
WHERE NOT EXISTS (
  SELECT 1 FROM edw_dev_hris.hgv_comp.dim_finance_period WHERE period_id = '2025-Q4'
);

-- Attribute incremental NSV to SPIFF / SPIFF_APPROVAL events (2026-Q2)
UPDATE edw_dev_hris.hgv_comp.fact_comp_admin_log SET attributed_nsv = 2400.00
WHERE event_id = 'ADMEVT-0005' AND period_id = '2026-Q2' AND attributed_nsv IS NULL;

UPDATE edw_dev_hris.hgv_comp.fact_comp_admin_log SET attributed_nsv = 3600.00
WHERE event_id = 'ADMEVT-0006' AND period_id = '2026-Q2' AND attributed_nsv IS NULL;

UPDATE edw_dev_hris.hgv_comp.fact_comp_admin_log SET attributed_nsv = 42750.00
WHERE event_id = 'ADMEVT-0012' AND period_id = '2026-Q2' AND attributed_nsv IS NULL;

-- Bootstrap seed event ids (runtime adminFinanceSeed)
UPDATE edw_dev_hris.hgv_comp.fact_comp_admin_log SET attributed_nsv = 2400.00
WHERE event_id = 'ADMEVT-0005' AND attributed_nsv IS NULL;

UPDATE edw_dev_hris.hgv_comp.fact_comp_admin_log SET attributed_nsv = 3600.00
WHERE event_id = 'ADMEVT-0006' AND attributed_nsv IS NULL;



-- ----- 06_create_marketing_benchmark.sql -----

-- Marketing rep comp, industry benchmarks, rep market positions, scenario tour lever
-- File: 06_create_marketing_benchmark.sql

-- Extend scenario_run with tour volume lever (idempotent on fresh CREATE OR REPLACE from 01)
-- For existing deployments, server bootstrap runs ALTER TABLE ADD COLUMN IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS edw_dev_hris.hgv_comp.industry_comp_benchmark (
  benchmark_id STRING NOT NULL,
  role_key STRING NOT NULL,
  role_label STRING,
  metric_code STRING NOT NULL,
  market_value DECIMAL(10, 2),
  hgv_typical_value DECIMAL(10, 2),
  unit STRING,
  benchmark_source STRING,
  effective_period STRING,
  notes STRING
) USING DELTA
COMMENT 'Industry compensation benchmarks (Slide 16 framework)';

CREATE TABLE IF NOT EXISTS edw_dev_hris.hgv_comp.fact_marketing_rep_period (
  rep_id STRING NOT NULL,
  period_id STRING NOT NULL,
  rep_name STRING,
  plan_id STRING,
  assigned_area STRING,
  bonus_area_id STRING,
  qtd_earnings DECIMAL(14, 2),
  paid_to_date DECIMAL(14, 2),
  qualified_tours INT,
  tours_shown INT,
  show_rate_pct DECIMAL(6, 2),
  penetration_pct DECIMAL(6, 2),
  penetration_target_pct DECIMAL(6, 2),
  spiff_active BOOLEAN,
  next_tier_label STRING,
  next_tier_gap_tours INT,
  qualified_tour_pay DECIMAL(14, 2),
  courtesy_tour_pay DECIMAL(14, 2),
  penetration_spiff DECIMAL(14, 2),
  chargebacks DECIMAL(14, 2),
  total_payout DECIMAL(14, 2),
  base_pct DECIMAL(6, 2),
  variable_pct DECIMAL(6, 2),
  tcc_gap_vs_market_pct DECIMAL(6, 2)
) USING DELTA
COMMENT 'Marketing rep period rollup — plan-aligned earnings';

CREATE TABLE IF NOT EXISTS edw_dev_hris.hgv_comp.fact_marketing_rep_metric (
  rep_id STRING NOT NULL,
  period_id STRING NOT NULL,
  metric_name STRING NOT NULL,
  weight_pct DECIMAL(6, 2),
  earnings DECIMAL(14, 2),
  attainment_pct DECIMAL(6, 2),
  target_label STRING,
  opportunity_usd DECIMAL(14, 2)
) USING DELTA
COMMENT 'Marketing rep plan metric weights and attainment';

CREATE TABLE IF NOT EXISTS edw_dev_hris.hgv_comp.fact_marketing_tour_payout (
  tour_id STRING NOT NULL,
  rep_id STRING NOT NULL,
  period_id STRING NOT NULL,
  guest_name STRING,
  guest_type STRING,
  arrival_date DATE,
  tour_status STRING,
  code STRING,
  payout DECIMAL(14, 2),
  fps_eligible BOOLEAN,
  fps_potential DECIMAL(14, 2),
  notes STRING,
  guest_id STRING,
  household_id STRING,
  planned_tour_location_id STRING,
  current_stay_location_id STRING,
  lead_source STRING,
  abc_score STRING,
  package_type STRING,
  xref_tour_id STRING,
  tour_booked_date DATE
) USING DELTA
COMMENT 'Marketing rep tour activity and credits';

CREATE TABLE IF NOT EXISTS edw_dev_hris.hgv_comp.fact_marketing_chargeback (
  chargeback_id STRING NOT NULL,
  rep_id STRING NOT NULL,
  period_id STRING NOT NULL,
  guest_name STRING,
  tour_id STRING,
  premium_gift STRING,
  chargeback_amount DECIMAL(14, 2),
  notes STRING
) USING DELTA
COMMENT 'Marketing rep chargebacks';

CREATE TABLE IF NOT EXISTS edw_dev_hris.hgv_comp.fact_marketing_arrival (
  arrival_id STRING NOT NULL,
  rep_id STRING NOT NULL,
  period_id STRING NOT NULL,
  guest_name STRING,
  guest_type STRING,
  arrival_datetime STRING,
  desk STRING,
  potential_qualified_tour DECIMAL(14, 2),
  potential_fps_payout DECIMAL(14, 2),
  projected_total_payout DECIMAL(14, 2)
) USING DELTA
COMMENT 'Upcoming arrivals with projected payout';

CREATE TABLE IF NOT EXISTS edw_dev_hris.hgv_comp.fact_rep_market_position (
  rep_id STRING NOT NULL,
  period_id STRING NOT NULL,
  rep_name STRING,
  role_key STRING,
  tcc_gap_vs_market_pct DECIMAL(6, 2),
  base_pct DECIMAL(6, 2),
  variable_pct DECIMAL(6, 2),
  quota_attainment_pct DECIMAL(6, 2)
) USING DELTA
COMMENT 'Rep pay vs industry benchmark — mixed above/below market seed';



-- ----- 07_create_regional_bonus.sql -----

-- Regional bonus levels by area (Jan 2025 PDF) — seeded from shared/bonusLevelsJan2025.ts
CREATE TABLE IF NOT EXISTS edw_dev_hris.hgv_comp.fact_regional_bonus_area (
  area_id STRING NOT NULL,
  period_id STRING NOT NULL,
  site_line STRING,
  smt_volume DECIMAL(16, 2),
  budget_volume DECIMAL(16, 2),
  volume_var_pct DECIMAL(6, 2)
) USING DELTA;

CREATE TABLE IF NOT EXISTS edw_dev_hris.hgv_comp.fact_regional_bonus_tier (
  area_id STRING NOT NULL,
  period_id STRING NOT NULL,
  level INT,
  salespeople_count INT,
  avg_tier_volume DECIMAL(16, 2),
  total_tier_volume DECIMAL(16, 2),
  total_cmi DECIMAL(16, 2),
  cost_pct DECIMAL(6, 2)
) USING DELTA;



-- ----- 09_create_guest_registry.sql -----

-- Guest registry spine for marketing tour enrichment (comp-relevant context only)
-- File: 09_create_guest_registry.sql

CREATE TABLE IF NOT EXISTS edw_dev_hris.hgv_comp.dim_household (
  household_id   STRING NOT NULL,
  hh_size_band   STRING NOT NULL,
  income_band    STRING NOT NULL,
  home_msa       STRING,
  enrichment_source STRING,
  enrichment_as_of  DATE
) USING DELTA
COMMENT 'Household demographics — banded fields only, no raw PII';

CREATE TABLE IF NOT EXISTS edw_dev_hris.hgv_comp.dim_location (
  location_id    STRING NOT NULL,
  location_name  STRING NOT NULL,
  location_type  STRING NOT NULL,
  market         STRING NOT NULL,
  brand          STRING NOT NULL,
  desk_label     STRING
) USING DELTA
COMMENT 'Properties, sales centers, and desk assignments';

CREATE TABLE IF NOT EXISTS edw_dev_hris.hgv_comp.dim_guest (
  guest_id            STRING NOT NULL,
  guest_name          STRING NOT NULL,
  email               STRING,
  phone_token         STRING,
  guest_type          STRING NOT NULL,
  owner_flag          BOOLEAN NOT NULL,
  household_id        STRING,
  qualification_code  STRING,
  tour_booked_date    DATE
) USING DELTA
COMMENT 'Guest spine — links tours, ownership, and stays';

CREATE TABLE IF NOT EXISTS edw_dev_hris.hgv_comp.bridge_tour_guest (
  tour_id    STRING NOT NULL,
  guest_id   STRING NOT NULL,
  is_primary BOOLEAN NOT NULL
) USING DELTA
COMMENT 'Tour-to-guest bridge (supports multi-guest tours)';

CREATE TABLE IF NOT EXISTS edw_dev_hris.hgv_comp.fact_guest_ownership (
  ownership_id    STRING NOT NULL,
  guest_id        STRING NOT NULL,
  property_name   STRING NOT NULL,
  location_id     STRING,
  contract_status STRING NOT NULL,
  points_balance  INT,
  brand           STRING
) USING DELTA
COMMENT 'HGV interval / club ownership interests';

CREATE TABLE IF NOT EXISTS edw_dev_hris.hgv_comp.fact_guest_rental_stay (
  stay_id      STRING NOT NULL,
  guest_id     STRING NOT NULL,
  location_id  STRING NOT NULL,
  stay_type    STRING NOT NULL,
  check_in     DATE NOT NULL,
  check_out    DATE NOT NULL,
  nights       INT NOT NULL
) USING DELTA
COMMENT 'Rental, exchange, and owner stays on HGV properties';

CREATE TABLE IF NOT EXISTS edw_dev_hris.hgv_comp.fact_guest_tour_history (
  history_id       STRING NOT NULL,
  guest_id         STRING NOT NULL,
  tour_id          STRING NOT NULL,
  rep_id           STRING,
  tour_date        DATE NOT NULL,
  tour_status      STRING NOT NULL,
  outcome_summary  STRING
) USING DELTA
COMMENT 'Prior tour outcomes across time for qualification context';

-- Guest spine columns on fact_marketing_tour_payout are in 06_create_marketing_benchmark.sql



-- ----- 10_create_plan_assessment.sql -----

-- Plan assessment profiles and segments (HGV vs market competitor standards)
CREATE TABLE IF NOT EXISTS edw_dev_hris.hgv_comp.plan_assessment_profile (
  persona_id STRING NOT NULL,
  plan_id STRING NOT NULL,
  role_title STRING NOT NULL,
  channel_code STRING NOT NULL,
  effective_period STRING NOT NULL
) USING DELTA
COMMENT 'Comp plan assessment header by persona';

CREATE TABLE IF NOT EXISTS edw_dev_hris.hgv_comp.plan_assessment_segment (
  persona_id STRING NOT NULL,
  effective_period STRING NOT NULL,
  attribute STRING NOT NULL,
  attribute_order INT NOT NULL,
  side STRING NOT NULL,
  segment_order INT NOT NULL,
  segment_label STRING,
  segment_value STRING NOT NULL
) USING DELTA
COMMENT 'HGV vs market plan assessment row segments';

