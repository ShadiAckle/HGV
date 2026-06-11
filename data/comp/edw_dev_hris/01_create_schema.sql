-- Catalog: edw_dev_hris | Schema: hgv_comp
-- Generated copy — originals remain in data/comp/
-- Regenerate: node scripts/gen-edw-dev-hris-sql.mjs
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
