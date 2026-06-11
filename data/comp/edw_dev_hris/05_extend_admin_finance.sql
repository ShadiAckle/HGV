-- =============================================================================
-- HGV Comp — Admin + Finance Schema Extension
-- File: 05_extend_admin_finance.sql
-- Schema: edw_dev_hris.hgv_comp
-- Purpose: Adds tables for Comp Admin Agent and Finance Agent
-- Created: 2026-Q2 rollout
-- =============================================================================

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
  created_at   TIMESTAMP     NOT NULL
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
