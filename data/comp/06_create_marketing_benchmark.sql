-- Marketing rep comp, industry benchmarks, rep market positions, scenario tour lever
-- File: 06_create_marketing_benchmark.sql

-- Extend scenario_run with tour volume lever (idempotent on fresh CREATE OR REPLACE from 01)
-- For existing deployments, server bootstrap runs ALTER TABLE ADD COLUMN IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS workspace.hgv_comp.industry_comp_benchmark (
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

CREATE TABLE IF NOT EXISTS workspace.hgv_comp.fact_marketing_rep_period (
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

CREATE TABLE IF NOT EXISTS workspace.hgv_comp.fact_marketing_rep_metric (
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

CREATE TABLE IF NOT EXISTS workspace.hgv_comp.fact_marketing_tour_payout (
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

CREATE TABLE IF NOT EXISTS workspace.hgv_comp.fact_marketing_chargeback (
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

CREATE TABLE IF NOT EXISTS workspace.hgv_comp.fact_marketing_arrival (
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

CREATE TABLE IF NOT EXISTS workspace.hgv_comp.fact_rep_market_position (
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
