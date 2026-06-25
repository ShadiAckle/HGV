-- =============================================================================
-- ICM plan model — dim_plan / fact_plan / dim_payee / fact_payee_plan
-- Aligns with Varicent-style plan setup: plan catalog, components & tiers,
-- payee registry, and payee-to-plan assignment by period + icm_role.
-- Run after 00_CLEAN_AND_REBUILD.sql (tables also created there for VDI).
-- =============================================================================

USE CATALOG edw_dev_hris;
USE SCHEMA hgv_comp;

CREATE TABLE IF NOT EXISTS edw_dev_hris.hgv_comp.dim_plan (
  row_uuid   STRING  NOT NULL COMMENT 'Surrogate key',
  plan_id    STRING  NOT NULL COMMENT 'Business plan id (e.g. PLAN-MKT-REP-2026)',
  plan_name  STRING  NOT NULL,
  icm_role   STRING  NOT NULL COMMENT 'marketing | marketing_manager | marketing_director | sales'
) USING DELTA
COMMENT 'ICM plan catalog by role channel';

CREATE TABLE IF NOT EXISTS edw_dev_hris.hgv_comp.fact_plan (
  row_uuid              STRING         NOT NULL,
  plan_id               STRING         NOT NULL,
  component             STRING         NOT NULL COMMENT 'Metric or tier name',
  component_type        STRING         NOT NULL COMMENT 'METRIC | TIER',
  plan_name             STRING,
  icm_role              STRING         NOT NULL,
  period_id             STRING         NOT NULL COMMENT 'Quarter id (2026-Q2) or * for all periods',
  tier_seq              INT,
  min_qualified_tours   INT            COMMENT 'TIER: volume gate to enter this tier',
  payout_per_unit       DECIMAL(10, 2) COMMENT 'TIER: $ per qualified tour at this tier',
  tier_label            STRING         COMMENT 'TIER: display label (Tier 1, Tier 2, …)',
  is_active             BOOLEAN        NOT NULL
) USING DELTA
COMMENT 'Plan components (metrics) and qualified-tour tier ladder rows';

CREATE TABLE IF NOT EXISTS edw_dev_hris.hgv_comp.dim_payee (
  row_uuid       STRING NOT NULL,
  payee_id       STRING NOT NULL COMMENT 'Same as rep_id / warehouse payee key',
  employee_id    STRING NOT NULL,
  employee_name  STRING NOT NULL
) USING DELTA
COMMENT 'Payee dimension — maps to dim_marketing_rep / dim_rep';

CREATE TABLE IF NOT EXISTS edw_dev_hris.hgv_comp.fact_payee_plan (
  row_uuid      STRING NOT NULL,
  payee_id      STRING NOT NULL,
  plan_id       STRING NOT NULL,
  employee_id   STRING NOT NULL,
  icm_role      STRING NOT NULL,
  period_id     STRING NOT NULL
) USING DELTA
COMMENT 'Authoritative payee-to-plan assignment per period';
