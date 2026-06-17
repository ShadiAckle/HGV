-- =============================================================================
-- CLEAN AND REBUILD — Run this FIRST, then 01_MATERIALIZE_ALL_TABLES.sql
-- Drops every object in edw_dev_hris.hgv_comp that the app touches,
-- then creates the config/operational tables with the exact schema
-- the app expects (compSchemaBootstrap.ts is the source of truth).
-- =============================================================================

-- Drop views first (views block CREATE TABLE with same name)
DROP VIEW IF EXISTS edw_dev_hris.hgv_comp.fact_marketing_rep_metric;
DROP VIEW IF EXISTS edw_dev_hris.hgv_comp.fact_marketing_chargeback;
DROP VIEW IF EXISTS edw_dev_hris.hgv_comp.fact_marketing_arrival;
DROP VIEW IF EXISTS edw_dev_hris.hgv_comp.fact_marketing_rep_period;
DROP VIEW IF EXISTS edw_dev_hris.hgv_comp.fact_marketing_tour_payout;
DROP VIEW IF EXISTS edw_dev_hris.hgv_comp.dim_marketing_rep;
DROP VIEW IF EXISTS edw_dev_hris.hgv_comp.dim_period;
DROP VIEW IF EXISTS edw_dev_hris.hgv_comp.dim_rep;

-- Drop all materialized tables
DROP TABLE IF EXISTS edw_dev_hris.hgv_comp.fact_marketing_rep_metric;
DROP TABLE IF EXISTS edw_dev_hris.hgv_comp.fact_marketing_rep_period;
DROP TABLE IF EXISTS edw_dev_hris.hgv_comp.fact_marketing_tour_payout;
DROP TABLE IF EXISTS edw_dev_hris.hgv_comp.fact_marketing_chargeback;
DROP TABLE IF EXISTS edw_dev_hris.hgv_comp.fact_marketing_arrival;
DROP TABLE IF EXISTS edw_dev_hris.hgv_comp.dim_marketing_rep;
DROP TABLE IF EXISTS edw_dev_hris.hgv_comp.dim_rep;
DROP TABLE IF EXISTS edw_dev_hris.hgv_comp.dim_period;
DROP TABLE IF EXISTS edw_dev_hris.hgv_comp._stg_tour_enriched;
DROP TABLE IF EXISTS edw_dev_hris.hgv_comp._stg_marketing_tour_detail;

-- Drop config tables (recreate below)
DROP TABLE IF EXISTS edw_dev_hris.hgv_comp.dim_tour_status_config;
DROP TABLE IF EXISTS edw_dev_hris.hgv_comp.dim_comp_rule_config;
DROP TABLE IF EXISTS edw_dev_hris.hgv_comp.dim_rep_filter_config;
DROP TABLE IF EXISTS edw_dev_hris.hgv_comp.fact_comp_config_audit_log;

-- =============================================================================
-- Create config tables (exact schema from compSchemaBootstrap.ts)
-- =============================================================================

CREATE TABLE edw_dev_hris.hgv_comp.dim_tour_status_config (
  config_id          STRING NOT NULL,
  tour_status_desc   STRING,
  payout_amount      DECIMAL(10,2) NOT NULL,
  is_active          BOOLEAN NOT NULL,
  effective_start_date DATE NOT NULL,
  effective_end_date   DATE,
  created_at         TIMESTAMP NOT NULL,
  created_by         STRING NOT NULL,
  updated_at         TIMESTAMP,
  updated_by         STRING
) USING DELTA;

CREATE TABLE edw_dev_hris.hgv_comp.dim_comp_rule_config (
  config_id          STRING NOT NULL,
  rule_name          STRING NOT NULL,
  rule_value         STRING NOT NULL,
  rule_description   STRING,
  is_active          BOOLEAN NOT NULL,
  effective_start_date DATE NOT NULL,
  effective_end_date   DATE,
  created_at         TIMESTAMP NOT NULL,
  created_by         STRING NOT NULL,
  updated_at         TIMESTAMP,
  updated_by         STRING
) USING DELTA;

CREATE TABLE edw_dev_hris.hgv_comp.dim_rep_filter_config (
  config_id          STRING NOT NULL,
  filter_name        STRING NOT NULL,
  filter_type        STRING NOT NULL,
  filter_value       STRING NOT NULL,
  is_active          BOOLEAN NOT NULL,
  effective_start_date DATE NOT NULL,
  effective_end_date   DATE,
  created_at         TIMESTAMP NOT NULL,
  created_by         STRING NOT NULL,
  updated_at         TIMESTAMP,
  updated_by         STRING
) USING DELTA;

CREATE TABLE edw_dev_hris.hgv_comp.fact_comp_config_audit_log (
  audit_id      STRING NOT NULL,
  config_table  STRING NOT NULL,
  config_id     STRING NOT NULL,
  action        STRING NOT NULL,
  changed_by    STRING NOT NULL,
  changed_at    TIMESTAMP NOT NULL,
  old_value     STRING,
  new_value     STRING
) USING DELTA;

-- =============================================================================
-- Create operational tables (exact schema from compSchemaBootstrap.ts)
-- These start empty — populated by materialization or manual entry
-- =============================================================================

-- fact_marketing_chargeback (compSchemaBootstrap line 76-79)
CREATE TABLE edw_dev_hris.hgv_comp.fact_marketing_chargeback (
  chargeback_id     STRING NOT NULL,
  rep_id            STRING NOT NULL,
  period_id         STRING NOT NULL,
  guest_name        STRING,
  tour_id           STRING,
  premium_gift      STRING,
  chargeback_amount DECIMAL(14,2),
  notes             STRING
) USING DELTA;

-- fact_marketing_arrival (compSchemaBootstrap line 81-86)
CREATE TABLE edw_dev_hris.hgv_comp.fact_marketing_arrival (
  arrival_id               STRING NOT NULL,
  rep_id                   STRING NOT NULL,
  period_id                STRING NOT NULL,
  guest_name               STRING,
  guest_type               STRING,
  arrival_datetime         STRING,
  desk                     STRING,
  potential_qualified_tour DECIMAL(14,2),
  potential_fps_payout     DECIMAL(14,2),
  projected_total_payout   DECIMAL(14,2)
) USING DELTA;

-- =============================================================================
-- Seed default config data (idempotent — WHERE NOT EXISTS guards)
-- =============================================================================

-- Tour status → payout mapping (matches actual Cognos tour_status_desc values)
INSERT INTO edw_dev_hris.hgv_comp.dim_tour_status_config
  (config_id, tour_status_desc, payout_amount, is_active, effective_start_date, created_at, created_by)
SELECT 'TS-SHOW-001', 'SHOW', 50.00, TRUE, DATE '2026-01-01', CURRENT_TIMESTAMP(), 'system'
WHERE NOT EXISTS (SELECT 1 FROM edw_dev_hris.hgv_comp.dim_tour_status_config WHERE config_id = 'TS-SHOW-001');

INSERT INTO edw_dev_hris.hgv_comp.dim_tour_status_config
  (config_id, tour_status_desc, payout_amount, is_active, effective_start_date, created_at, created_by)
SELECT 'TS-TOUR-001', 'TOUR', 50.00, TRUE, DATE '2026-01-01', CURRENT_TIMESTAMP(), 'system'
WHERE NOT EXISTS (SELECT 1 FROM edw_dev_hris.hgv_comp.dim_tour_status_config WHERE config_id = 'TS-TOUR-001');

INSERT INTO edw_dev_hris.hgv_comp.dim_tour_status_config
  (config_id, tour_status_desc, payout_amount, is_active, effective_start_date, created_at, created_by)
SELECT 'TS-SHOWN-001', 'SHOWN', 50.00, TRUE, DATE '2026-01-01', CURRENT_TIMESTAMP(), 'system'
WHERE NOT EXISTS (SELECT 1 FROM edw_dev_hris.hgv_comp.dim_tour_status_config WHERE config_id = 'TS-SHOWN-001');

INSERT INTO edw_dev_hris.hgv_comp.dim_tour_status_config
  (config_id, tour_status_desc, payout_amount, is_active, effective_start_date, created_at, created_by)
SELECT 'TS-NOSHOW-001', 'NO SHOW', 25.00, TRUE, DATE '2026-01-01', CURRENT_TIMESTAMP(), 'system'
WHERE NOT EXISTS (SELECT 1 FROM edw_dev_hris.hgv_comp.dim_tour_status_config WHERE config_id = 'TS-NOSHOW-001');

INSERT INTO edw_dev_hris.hgv_comp.dim_tour_status_config
  (config_id, tour_status_desc, payout_amount, is_active, effective_start_date, created_at, created_by)
SELECT 'TS-CANCELLED-001', 'CANCELLED', 0.00, TRUE, DATE '2026-01-01', CURRENT_TIMESTAMP(), 'system'
WHERE NOT EXISTS (SELECT 1 FROM edw_dev_hris.hgv_comp.dim_tour_status_config WHERE config_id = 'TS-CANCELLED-001');

INSERT INTO edw_dev_hris.hgv_comp.dim_tour_status_config
  (config_id, tour_status_desc, payout_amount, is_active, effective_start_date, created_at, created_by)
SELECT 'TS-CANCELED-001', 'CANCELED', 0.00, TRUE, DATE '2026-01-01', CURRENT_TIMESTAMP(), 'system'
WHERE NOT EXISTS (SELECT 1 FROM edw_dev_hris.hgv_comp.dim_tour_status_config WHERE config_id = 'TS-CANCELED-001');

INSERT INTO edw_dev_hris.hgv_comp.dim_tour_status_config
  (config_id, tour_status_desc, payout_amount, is_active, effective_start_date, created_at, created_by)
SELECT 'TS-SHOWNOTOUR-001', 'SHOW - NO TOUR', 0.00, TRUE, DATE '2026-01-01', CURRENT_TIMESTAMP(), 'system'
WHERE NOT EXISTS (SELECT 1 FROM edw_dev_hris.hgv_comp.dim_tour_status_config WHERE config_id = 'TS-SHOWNOTOUR-001');

INSERT INTO edw_dev_hris.hgv_comp.dim_tour_status_config
  (config_id, tour_status_desc, payout_amount, is_active, effective_start_date, created_at, created_by)
SELECT 'TS-BOOKED-001', 'BOOKED', 0.00, TRUE, DATE '2026-01-01', CURRENT_TIMESTAMP(), 'system'
WHERE NOT EXISTS (SELECT 1 FROM edw_dev_hris.hgv_comp.dim_tour_status_config WHERE config_id = 'TS-BOOKED-001');

INSERT INTO edw_dev_hris.hgv_comp.dim_tour_status_config
  (config_id, tour_status_desc, payout_amount, is_active, effective_start_date, created_at, created_by)
SELECT 'TS-BOOK-001', 'BOOK', 0.00, TRUE, DATE '2026-01-01', CURRENT_TIMESTAMP(), 'system'
WHERE NOT EXISTS (SELECT 1 FROM edw_dev_hris.hgv_comp.dim_tour_status_config WHERE config_id = 'TS-BOOK-001');

INSERT INTO edw_dev_hris.hgv_comp.dim_tour_status_config
  (config_id, tour_status_desc, payout_amount, is_active, effective_start_date, created_at, created_by)
SELECT 'TS-NULL-001', '__NULL__', 0.00, TRUE, DATE '2026-01-01', CURRENT_TIMESTAMP(), 'system'
WHERE NOT EXISTS (SELECT 1 FROM edw_dev_hris.hgv_comp.dim_tour_status_config WHERE config_id = 'TS-NULL-001');

-- Comp rules
INSERT INTO edw_dev_hris.hgv_comp.dim_comp_rule_config
  (config_id, rule_name, rule_value, rule_description, is_active, effective_start_date, created_at, created_by)
SELECT 'CR-MULTIREP-001', 'multi_rep_credit_policy', 'first_rep_only',
  'When multiple OPC reps listed, credit 100% to first rep (opc_person_1_name)',
  TRUE, DATE '2026-01-01', CURRENT_TIMESTAMP(), 'system'
WHERE NOT EXISTS (SELECT 1 FROM edw_dev_hris.hgv_comp.dim_comp_rule_config WHERE config_id = 'CR-MULTIREP-001');

INSERT INTO edw_dev_hris.hgv_comp.dim_comp_rule_config
  (config_id, rule_name, rule_value, rule_description, is_active, effective_start_date, created_at, created_by)
SELECT 'CR-MINCOUNT-001', 'min_tour_count_threshold', '0',
  'Minimum tour count for rep to appear in dim_marketing_rep (0 = no filter)',
  TRUE, DATE '2026-01-01', CURRENT_TIMESTAMP(), 'system'
WHERE NOT EXISTS (SELECT 1 FROM edw_dev_hris.hgv_comp.dim_comp_rule_config WHERE config_id = 'CR-MINCOUNT-001');

-- Rep filter defaults (inactive — admin can enable)
INSERT INTO edw_dev_hris.hgv_comp.dim_rep_filter_config
  (config_id, filter_name, filter_type, filter_value, is_active, effective_start_date, created_at, created_by)
SELECT 'RF-EXCLUDE-001', 'Exclude UNASSIGNED', 'exclude_pattern', 'UNASSIGNED',
  FALSE, DATE '2026-01-01', CURRENT_TIMESTAMP(), 'system'
WHERE NOT EXISTS (SELECT 1 FROM edw_dev_hris.hgv_comp.dim_rep_filter_config WHERE config_id = 'RF-EXCLUDE-001');

-- =============================================================================
-- Grant permissions to app service principal
-- =============================================================================
GRANT MODIFY ON TABLE edw_dev_hris.hgv_comp.dim_tour_status_config   TO `hgv-app-service-principal`;
GRANT MODIFY ON TABLE edw_dev_hris.hgv_comp.dim_comp_rule_config      TO `hgv-app-service-principal`;
GRANT MODIFY ON TABLE edw_dev_hris.hgv_comp.dim_rep_filter_config     TO `hgv-app-service-principal`;
GRANT MODIFY ON TABLE edw_dev_hris.hgv_comp.fact_comp_config_audit_log TO `hgv-app-service-principal`;
