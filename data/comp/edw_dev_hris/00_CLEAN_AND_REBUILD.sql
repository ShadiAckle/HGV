-- COMPLETE CLEAN AND REBUILD
-- Run this ONE file to drop everything and rebuild from scratch

-- Drop ALL views first (views block table creation)
DROP VIEW IF EXISTS edw_dev_hris.hgv_comp.fact_marketing_rep_metric;
DROP VIEW IF EXISTS edw_dev_hris.hgv_comp.fact_marketing_chargeback;
DROP VIEW IF EXISTS edw_dev_hris.hgv_comp.fact_marketing_arrival;
DROP VIEW IF EXISTS edw_dev_hris.hgv_comp.fact_marketing_rep_period;
DROP VIEW IF EXISTS edw_dev_hris.hgv_comp.fact_marketing_tour_payout;
DROP VIEW IF EXISTS edw_dev_hris.hgv_comp.dim_marketing_rep;
DROP VIEW IF EXISTS edw_dev_hris.hgv_comp.dim_period;
DROP VIEW IF EXISTS edw_dev_hris.hgv_comp.dim_rep;

-- Drop ALL tables
DROP TABLE IF EXISTS edw_dev_hris.hgv_comp.fact_marketing_rep_metric;
DROP TABLE IF EXISTS edw_dev_hris.hgv_comp.fact_marketing_chargeback;
DROP TABLE IF EXISTS edw_dev_hris.hgv_comp.fact_marketing_arrival;
DROP TABLE IF EXISTS edw_dev_hris.hgv_comp.fact_marketing_rep_period;
DROP TABLE IF EXISTS edw_dev_hris.hgv_comp.fact_marketing_tour_payout;
DROP TABLE IF EXISTS edw_dev_hris.hgv_comp.dim_marketing_rep;
DROP TABLE IF EXISTS edw_dev_hris.hgv_comp.dim_period;
DROP TABLE IF EXISTS edw_dev_hris.hgv_comp.dim_rep;
DROP TABLE IF EXISTS edw_dev_hris.hgv_comp._stg_tour_enriched;
DROP TABLE IF EXISTS edw_dev_hris.hgv_comp._stg_marketing_tour_detail;

-- Drop config tables (we'll recreate them)
DROP TABLE IF EXISTS edw_dev_hris.hgv_comp.dim_tour_status_config;
DROP TABLE IF EXISTS edw_dev_hris.hgv_comp.dim_comp_rule_config;
DROP TABLE IF EXISTS edw_dev_hris.hgv_comp.dim_rep_filter_config;
DROP TABLE IF EXISTS edw_dev_hris.hgv_comp.fact_comp_config_audit_log;

-- Create config tables
CREATE TABLE edw_dev_hris.hgv_comp.dim_tour_status_config (
  config_id STRING NOT NULL,
  tour_status_desc STRING,
  payout_amount DECIMAL(10,2) NOT NULL,
  is_active BOOLEAN NOT NULL,
  effective_start_date DATE NOT NULL,
  effective_end_date DATE,
  created_at TIMESTAMP NOT NULL,
  created_by STRING NOT NULL,
  updated_at TIMESTAMP,
  updated_by STRING
) USING DELTA;

CREATE TABLE edw_dev_hris.hgv_comp.dim_comp_rule_config (
  config_id STRING NOT NULL,
  rule_name STRING NOT NULL,
  rule_value STRING NOT NULL,
  rule_description STRING,
  is_active BOOLEAN NOT NULL,
  effective_start_date DATE NOT NULL,
  effective_end_date DATE,
  created_at TIMESTAMP NOT NULL,
  created_by STRING NOT NULL,
  updated_at TIMESTAMP,
  updated_by STRING
) USING DELTA;

CREATE TABLE edw_dev_hris.hgv_comp.dim_rep_filter_config (
  config_id STRING NOT NULL,
  filter_name STRING NOT NULL,
  filter_type STRING NOT NULL,
  filter_value STRING NOT NULL,
  is_active BOOLEAN NOT NULL,
  effective_start_date DATE NOT NULL,
  effective_end_date DATE,
  created_at TIMESTAMP NOT NULL,
  created_by STRING NOT NULL,
  updated_at TIMESTAMP,
  updated_by STRING
) USING DELTA;

CREATE TABLE edw_dev_hris.hgv_comp.fact_comp_config_audit_log (
  audit_id STRING NOT NULL,
  config_table STRING NOT NULL,
  config_id STRING NOT NULL,
  action STRING NOT NULL,
  changed_by STRING NOT NULL,
  changed_at TIMESTAMP NOT NULL,
  old_value STRING,
  new_value STRING
) USING DELTA;

CREATE TABLE edw_dev_hris.hgv_comp.fact_marketing_chargeback (
  chargeback_id STRING NOT NULL,
  rep_id STRING NOT NULL,
  tour_id STRING,
  chargeback_date DATE NOT NULL,
  chargeback_amount DECIMAL(10,2) NOT NULL,
  chargeback_reason STRING,
  period_id STRING NOT NULL,
  reversed_date DATE,
  is_active BOOLEAN NOT NULL
) USING DELTA;

CREATE TABLE edw_dev_hris.hgv_comp.fact_marketing_arrival (
  arrival_id STRING NOT NULL,
  rep_id STRING NOT NULL,
  arrival_date DATE NOT NULL,
  guest_count INT NOT NULL,
  tour_booked BOOLEAN NOT NULL,
  tour_id STRING,
  site_code STRING NOT NULL
) USING DELTA;

-- Seed config data
INSERT INTO edw_dev_hris.hgv_comp.dim_tour_status_config (config_id, tour_status_desc, payout_amount, is_active, effective_start_date, created_at, created_by)
SELECT 'cfg_show', 'SHOW', 50.00, TRUE, '2026-01-01', CURRENT_TIMESTAMP(), 'system'
WHERE NOT EXISTS (SELECT 1 FROM edw_dev_hris.hgv_comp.dim_tour_status_config WHERE tour_status_desc = 'SHOW');

INSERT INTO edw_dev_hris.hgv_comp.dim_tour_status_config (config_id, tour_status_desc, payout_amount, is_active, effective_start_date, created_at, created_by)
SELECT 'cfg_tour', 'TOUR', 50.00, TRUE, '2026-01-01', CURRENT_TIMESTAMP(), 'system'
WHERE NOT EXISTS (SELECT 1 FROM edw_dev_hris.hgv_comp.dim_tour_status_config WHERE tour_status_desc = 'TOUR');

INSERT INTO edw_dev_hris.hgv_comp.dim_tour_status_config (config_id, tour_status_desc, payout_amount, is_active, effective_start_date, created_at, created_by)
SELECT 'cfg_no_show', 'NO SHOW', 25.00, TRUE, '2026-01-01', CURRENT_TIMESTAMP(), 'system'
WHERE NOT EXISTS (SELECT 1 FROM edw_dev_hris.hgv_comp.dim_tour_status_config WHERE tour_status_desc = 'NO SHOW');

INSERT INTO edw_dev_hris.hgv_comp.dim_tour_status_config (config_id, tour_status_desc, payout_amount, is_active, effective_start_date, created_at, created_by)
SELECT 'cfg_null', '__NULL__', 0.00, TRUE, '2026-01-01', CURRENT_TIMESTAMP(), 'system'
WHERE NOT EXISTS (SELECT 1 FROM edw_dev_hris.hgv_comp.dim_tour_status_config WHERE tour_status_desc = '__NULL__');

INSERT INTO edw_dev_hris.hgv_comp.dim_comp_rule_config (config_id, rule_name, rule_value, rule_description, is_active, effective_start_date, created_at, created_by)
SELECT 'rule_multi_rep', 'multi_rep_credit_policy', 'first_rep_only', 'Credit first rep only', TRUE, '2026-01-01', CURRENT_TIMESTAMP(), 'system'
WHERE NOT EXISTS (SELECT 1 FROM edw_dev_hris.hgv_comp.dim_comp_rule_config WHERE rule_name = 'multi_rep_credit_policy');

-- Grant permissions
GRANT MODIFY ON TABLE edw_dev_hris.hgv_comp.dim_tour_status_config TO `hgv-app-service-principal`;
GRANT MODIFY ON TABLE edw_dev_hris.hgv_comp.dim_comp_rule_config TO `hgv-app-service-principal`;
GRANT MODIFY ON TABLE edw_dev_hris.hgv_comp.dim_rep_filter_config TO `hgv-app-service-principal`;
GRANT MODIFY ON TABLE edw_dev_hris.hgv_comp.fact_comp_config_audit_log TO `hgv-app-service-principal`;
