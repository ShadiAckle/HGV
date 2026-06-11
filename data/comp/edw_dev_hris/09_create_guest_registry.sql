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

-- Extend marketing tour payout with guest spine FKs (idempotent ALTER for existing tables)
ALTER TABLE edw_dev_hris.hgv_comp.fact_marketing_tour_payout ADD COLUMN guest_id STRING;
ALTER TABLE edw_dev_hris.hgv_comp.fact_marketing_tour_payout ADD COLUMN household_id STRING;
ALTER TABLE edw_dev_hris.hgv_comp.fact_marketing_tour_payout ADD COLUMN planned_tour_location_id STRING;
ALTER TABLE edw_dev_hris.hgv_comp.fact_marketing_tour_payout ADD COLUMN current_stay_location_id STRING;
ALTER TABLE edw_dev_hris.hgv_comp.fact_marketing_tour_payout ADD COLUMN lead_source STRING;
ALTER TABLE edw_dev_hris.hgv_comp.fact_marketing_tour_payout ADD COLUMN abc_score STRING;
ALTER TABLE edw_dev_hris.hgv_comp.fact_marketing_tour_payout ADD COLUMN package_type STRING;
ALTER TABLE edw_dev_hris.hgv_comp.fact_marketing_tour_payout ADD COLUMN xref_tour_id STRING;
ALTER TABLE edw_dev_hris.hgv_comp.fact_marketing_tour_payout ADD COLUMN tour_booked_date DATE;
