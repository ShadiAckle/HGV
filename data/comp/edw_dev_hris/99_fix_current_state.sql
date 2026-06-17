-- Single script to fix the current state and get the app working
-- Run this ONE file on VDI Databricks to resolve all issues

-- First, let's check what exists and create what's missing

-- Step 1: Create the 4 NEW config tables (these are definitely missing)
CREATE TABLE IF NOT EXISTS edw_dev_hris.hgv_comp.dim_tour_status_config (
  config_id STRING NOT NULL,
  tour_status_desc STRING,
  payout_amount DECIMAL(10,2) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  effective_start_date DATE NOT NULL,
  effective_end_date DATE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP(),
  created_by STRING NOT NULL,
  updated_at TIMESTAMP,
  updated_by STRING
) USING DELTA
COMMENT 'Admin-configurable tour status to payout mapping';

CREATE TABLE IF NOT EXISTS edw_dev_hris.hgv_comp.dim_comp_rule_config (
  config_id STRING NOT NULL,
  rule_name STRING NOT NULL,
  rule_value STRING NOT NULL,
  rule_description STRING,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  effective_start_date DATE NOT NULL,
  effective_end_date DATE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP(),
  created_by STRING NOT NULL,
  updated_at TIMESTAMP,
  updated_by STRING
) USING DELTA
COMMENT 'Global compensation rule configuration';

CREATE TABLE IF NOT EXISTS edw_dev_hris.hgv_comp.dim_rep_filter_config (
  config_id STRING NOT NULL,
  filter_name STRING NOT NULL,
  filter_type STRING NOT NULL,
  filter_value STRING NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  effective_start_date DATE NOT NULL,
  effective_end_date DATE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP(),
  created_by STRING NOT NULL,
  updated_at TIMESTAMP,
  updated_by STRING
) USING DELTA
COMMENT 'Rep inclusion/exclusion filter configuration';

CREATE TABLE IF NOT EXISTS edw_dev_hris.hgv_comp.fact_comp_config_audit_log (
  audit_id STRING NOT NULL,
  config_table STRING NOT NULL,
  config_id STRING NOT NULL,
  action STRING NOT NULL,
  changed_by STRING NOT NULL,
  changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP(),
  old_value STRING,
  new_value STRING
) USING DELTA
COMMENT 'Audit trail for all compensation configuration changes';

-- Step 2: Seed default payout rules
INSERT INTO edw_dev_hris.hgv_comp.dim_tour_status_config (config_id, tour_status_desc, payout_amount, is_active, effective_start_date, created_by)
SELECT 'cfg_show', 'SHOW', 50.00, TRUE, '2026-01-01', 'system'
WHERE NOT EXISTS (SELECT 1 FROM edw_dev_hris.hgv_comp.dim_tour_status_config WHERE tour_status_desc = 'SHOW');

INSERT INTO edw_dev_hris.hgv_comp.dim_tour_status_config (config_id, tour_status_desc, payout_amount, is_active, effective_start_date, created_by)
SELECT 'cfg_no_show', 'NO SHOW', 25.00, TRUE, '2026-01-01', 'system'
WHERE NOT EXISTS (SELECT 1 FROM edw_dev_hris.hgv_comp.dim_tour_status_config WHERE tour_status_desc = 'NO SHOW');

INSERT INTO edw_dev_hris.hgv_comp.dim_tour_status_config (config_id, tour_status_desc, payout_amount, is_active, effective_start_date, created_by)
SELECT 'cfg_tour', 'TOUR', 50.00, TRUE, '2026-01-01', 'system'
WHERE NOT EXISTS (SELECT 1 FROM edw_dev_hris.hgv_comp.dim_tour_status_config WHERE tour_status_desc = 'TOUR');

INSERT INTO edw_dev_hris.hgv_comp.dim_tour_status_config (config_id, tour_status_desc, payout_amount, is_active, effective_start_date, created_by)
SELECT 'cfg_null', '__NULL__', 0.00, TRUE, '2026-01-01', 'system'
WHERE NOT EXISTS (SELECT 1 FROM edw_dev_hris.hgv_comp.dim_tour_status_config WHERE tour_status_desc = '__NULL__');

-- Step 3: Seed default global rules
INSERT INTO edw_dev_hris.hgv_comp.dim_comp_rule_config (config_id, rule_name, rule_value, rule_description, is_active, effective_start_date, created_by)
SELECT 'rule_multi_rep', 'multi_rep_credit_policy', 'first_rep_only', 'How to attribute credit when multiple reps are on a tour', TRUE, '2026-01-01', 'system'
WHERE NOT EXISTS (SELECT 1 FROM edw_dev_hris.hgv_comp.dim_comp_rule_config WHERE rule_name = 'multi_rep_credit_policy');

-- Step 4: Ensure fact_marketing_chargeback exists as a TABLE (not view)
CREATE TABLE IF NOT EXISTS edw_dev_hris.hgv_comp.fact_marketing_chargeback (
  chargeback_id STRING NOT NULL,
  rep_id STRING NOT NULL,
  tour_id STRING,
  chargeback_date DATE NOT NULL,
  chargeback_amount DECIMAL(10,2) NOT NULL,
  chargeback_reason STRING,
  period_id STRING NOT NULL,
  reversed_date DATE,
  is_active BOOLEAN NOT NULL
) USING DELTA
COMMENT 'Marketing compensation chargebacks';

-- Step 5: Grant permissions to app service principal
GRANT MODIFY ON TABLE edw_dev_hris.hgv_comp.dim_tour_status_config TO `hgv-app-service-principal`;
GRANT MODIFY ON TABLE edw_dev_hris.hgv_comp.dim_comp_rule_config TO `hgv-app-service-principal`;
GRANT MODIFY ON TABLE edw_dev_hris.hgv_comp.dim_rep_filter_config TO `hgv-app-service-principal`;
GRANT MODIFY ON TABLE edw_dev_hris.hgv_comp.fact_comp_config_audit_log TO `hgv-app-service-principal`;

-- Done! Now restart your app.
