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

-- =============================================================================
-- Comp-status → payout mapping (PRIMARY — used by 01_MATERIALIZE payout join).
-- The materialization derives a comp_status_key per tour:
--   QUALIFIED = showed & qualified (Owner / New Buyer)
--   COURTESY  = showed & not qualified
--   NO SHOW   = did not show
-- These three rows drive every tour payout. Admins can tune the amounts.
-- =============================================================================
INSERT INTO edw_dev_hris.hgv_comp.dim_tour_status_config
  (config_id, tour_status_desc, payout_amount, is_active, effective_start_date, created_at, created_by)
SELECT 'TS-QUALIFIED-001', 'QUALIFIED', 75.00, TRUE, DATE '2026-01-01', CURRENT_TIMESTAMP(), 'system'
WHERE NOT EXISTS (SELECT 1 FROM edw_dev_hris.hgv_comp.dim_tour_status_config WHERE config_id = 'TS-QUALIFIED-001');

INSERT INTO edw_dev_hris.hgv_comp.dim_tour_status_config
  (config_id, tour_status_desc, payout_amount, is_active, effective_start_date, created_at, created_by)
SELECT 'TS-COURTESY-001', 'COURTESY', 20.00, TRUE, DATE '2026-01-01', CURRENT_TIMESTAMP(), 'system'
WHERE NOT EXISTS (SELECT 1 FROM edw_dev_hris.hgv_comp.dim_tour_status_config WHERE config_id = 'TS-COURTESY-001');

-- Raw Cognos status rows (kept for reference / admin visibility; not used by payout join)
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
SELECT 'TS-NOSHOW-001', 'NO SHOW', 0.00, TRUE, DATE '2026-01-01', CURRENT_TIMESTAMP(), 'system'
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
-- Stub tables for optional tour-enrichment joins
-- These allow the enrichment query in marketingTourContext.ts to run without
-- throwing TABLE_OR_VIEW_NOT_FOUND. All are empty; data may be populated later.
-- =============================================================================

-- dim_location: planned tour location & current stay location
DROP TABLE IF EXISTS edw_dev_hris.hgv_comp.dim_location;
CREATE TABLE edw_dev_hris.hgv_comp.dim_location (
  location_id   STRING      NOT NULL,
  location_name STRING,
  location_type STRING,
  market        STRING,
  brand         STRING,
  desk_label    STRING
) USING DELTA;

-- dim_guest: guest identity / qualification
DROP TABLE IF EXISTS edw_dev_hris.hgv_comp.dim_guest;
CREATE TABLE edw_dev_hris.hgv_comp.dim_guest (
  guest_id          STRING  NOT NULL,
  email             STRING,
  phone_token       STRING,
  qualification_code STRING,
  owner_flag        BOOLEAN
) USING DELTA;

-- dim_household: guest household demographics
DROP TABLE IF EXISTS edw_dev_hris.hgv_comp.dim_household;
CREATE TABLE edw_dev_hris.hgv_comp.dim_household (
  household_id  STRING NOT NULL,
  hh_size_band  STRING,
  income_band   STRING,
  home_msa      STRING
) USING DELTA;

-- fact_tour_quality: tour outcome & contract details
DROP TABLE IF EXISTS edw_dev_hris.hgv_comp.fact_tour_quality;
CREATE TABLE edw_dev_hris.hgv_comp.fact_tour_quality (
  tour_id           STRING  NOT NULL,
  lead_source       STRING,
  abc_score         STRING,
  package_type      STRING,
  showed_flag       BOOLEAN,
  closed_flag       BOOLEAN,
  contract_status   STRING,
  rescission_flag   BOOLEAN,
  net_sales_volume  DECIMAL(14,2),
  vpg               DECIMAL(14,2)
) USING DELTA;

-- fact_guest_rental_stay: rental stay history for guest context
DROP TABLE IF EXISTS edw_dev_hris.hgv_comp.fact_guest_rental_stay;
CREATE TABLE edw_dev_hris.hgv_comp.fact_guest_rental_stay (
  stay_id     STRING  NOT NULL,
  guest_id    STRING,
  stay_type   STRING,
  check_in    DATE,
  check_out   DATE,
  nights      INT,
  location_id STRING
) USING DELTA;

-- fact_guest_tour_history: prior tour history per guest
DROP TABLE IF EXISTS edw_dev_hris.hgv_comp.fact_guest_tour_history;
CREATE TABLE edw_dev_hris.hgv_comp.fact_guest_tour_history (
  history_id      STRING NOT NULL,
  guest_id        STRING,
  tour_id         STRING,
  rep_id          STRING,
  tour_date       DATE,
  tour_status     STRING,
  outcome_summary STRING
) USING DELTA;

-- fact_guest_ownership: timeshare ownership records per guest
DROP TABLE IF EXISTS edw_dev_hris.hgv_comp.fact_guest_ownership;
CREATE TABLE edw_dev_hris.hgv_comp.fact_guest_ownership (
  ownership_id     STRING  NOT NULL,
  guest_id         STRING,
  property_name    STRING,
  contract_status  STRING,
  points_balance   DECIMAL(14,2),
  brand            STRING,
  location_id      STRING
) USING DELTA;

-- =============================================================================
-- Manager-view analytics stubs (empty; let the manager "My Comp" view run).
-- IF NOT EXISTS so a re-run never wipes data. See 03_manager_view_stubs.sql.
-- =============================================================================
CREATE TABLE IF NOT EXISTS edw_dev_hris.hgv_comp.fact_manager_intervention (
  intervention_id STRING NOT NULL, manager_rep_id STRING NOT NULL,
  target_rep_id STRING NOT NULL, period_id STRING NOT NULL,
  intervention_type STRING NOT NULL, status STRING NOT NULL,
  discount_pct DECIMAL(5,2), quota_relief_pct DECIMAL(5,2),
  tour_id STRING, notes STRING, admin_event_id STRING, created_at TIMESTAMP
) USING DELTA;
CREATE TABLE IF NOT EXISTS edw_dev_hris.hgv_comp.fact_rep_market_position (
  rep_id STRING NOT NULL, period_id STRING NOT NULL, rep_name STRING, role_key STRING,
  tcc_gap_vs_market_pct DECIMAL(6,2), base_pct DECIMAL(6,2), variable_pct DECIMAL(6,2),
  quota_attainment_pct DECIMAL(6,2)
) USING DELTA;
CREATE TABLE IF NOT EXISTS edw_dev_hris.hgv_comp.dim_product_line (
  product_line_id STRING NOT NULL, product_line_name STRING NOT NULL, is_ffs BOOLEAN NOT NULL
) USING DELTA;
CREATE TABLE IF NOT EXISTS edw_dev_hris.hgv_comp.fact_rep_product_mix (
  rep_id STRING NOT NULL, period_id STRING NOT NULL,
  product_line_id STRING NOT NULL, mix_pct DECIMAL(6,2) NOT NULL
) USING DELTA;
CREATE TABLE IF NOT EXISTS edw_dev_hris.hgv_comp.fact_quota_attainment (
  rep_id STRING NOT NULL, period_id STRING NOT NULL, plan_version_id STRING NOT NULL,
  quota_amount DECIMAL(14,2) NOT NULL, credited_amount DECIMAL(14,2) NOT NULL,
  attainment_pct DECIMAL(6,2) NOT NULL, deals_closed_count INT NOT NULL,
  next_tier_threshold_pct DECIMAL(6,2) NOT NULL
) USING DELTA;
CREATE TABLE IF NOT EXISTS edw_dev_hris.hgv_comp.fact_payout (
  rep_id STRING NOT NULL, period_id STRING NOT NULL,
  base_pay DECIMAL(14,2) NOT NULL, commission DECIMAL(14,2) NOT NULL,
  bonus DECIMAL(14,2) NOT NULL, total_earnings DECIMAL(14,2) NOT NULL, total_paid DECIMAL(14,2) NOT NULL
) USING DELTA;
CREATE TABLE IF NOT EXISTS edw_dev_hris.hgv_comp.fact_team_snapshot (
  team_id STRING NOT NULL, period_id STRING NOT NULL,
  team_attainment_pct DECIMAL(6,2) NOT NULL, top_performer_count INT NOT NULL,
  at_risk_count INT NOT NULL, ffs_sales_pct DECIMAL(6,2) NOT NULL, ffs_target_pct DECIMAL(6,2) NOT NULL
) USING DELTA;
CREATE TABLE IF NOT EXISTS edw_dev_hris.hgv_comp.dim_team (
  team_id STRING NOT NULL, team_name STRING NOT NULL, region STRING NOT NULL
) USING DELTA;

-- =============================================================================
-- Grant permissions to app service principal
-- =============================================================================
GRANT MODIFY ON TABLE edw_dev_hris.hgv_comp.dim_tour_status_config   TO `hgv-app-service-principal`;
GRANT MODIFY ON TABLE edw_dev_hris.hgv_comp.dim_comp_rule_config      TO `hgv-app-service-principal`;
GRANT MODIFY ON TABLE edw_dev_hris.hgv_comp.dim_rep_filter_config     TO `hgv-app-service-principal`;
GRANT MODIFY ON TABLE edw_dev_hris.hgv_comp.fact_comp_config_audit_log TO `hgv-app-service-principal`;
GRANT SELECT ON TABLE edw_dev_hris.hgv_comp.dim_location              TO `hgv-app-service-principal`;
GRANT SELECT ON TABLE edw_dev_hris.hgv_comp.dim_guest                 TO `hgv-app-service-principal`;
GRANT SELECT ON TABLE edw_dev_hris.hgv_comp.dim_household             TO `hgv-app-service-principal`;
GRANT SELECT ON TABLE edw_dev_hris.hgv_comp.fact_tour_quality         TO `hgv-app-service-principal`;
GRANT SELECT ON TABLE edw_dev_hris.hgv_comp.fact_guest_rental_stay    TO `hgv-app-service-principal`;
GRANT SELECT ON TABLE edw_dev_hris.hgv_comp.fact_guest_tour_history   TO `hgv-app-service-principal`;
GRANT SELECT ON TABLE edw_dev_hris.hgv_comp.fact_guest_ownership      TO `hgv-app-service-principal`;
GRANT SELECT ON TABLE edw_dev_hris.hgv_comp.fact_manager_intervention TO `hgv-app-service-principal`;
GRANT SELECT ON TABLE edw_dev_hris.hgv_comp.fact_rep_market_position  TO `hgv-app-service-principal`;
GRANT SELECT ON TABLE edw_dev_hris.hgv_comp.dim_product_line          TO `hgv-app-service-principal`;
GRANT SELECT ON TABLE edw_dev_hris.hgv_comp.fact_rep_product_mix      TO `hgv-app-service-principal`;
GRANT SELECT ON TABLE edw_dev_hris.hgv_comp.fact_quota_attainment     TO `hgv-app-service-principal`;
GRANT SELECT ON TABLE edw_dev_hris.hgv_comp.fact_payout               TO `hgv-app-service-principal`;
GRANT SELECT ON TABLE edw_dev_hris.hgv_comp.fact_team_snapshot        TO `hgv-app-service-principal`;
GRANT SELECT ON TABLE edw_dev_hris.hgv_comp.dim_team                  TO `hgv-app-service-principal`;
