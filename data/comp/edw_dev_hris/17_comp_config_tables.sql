-- ═══════════════════════════════════════════════════════════════════════════
-- HGV Compensation Configuration Tables
-- ═══════════════════════════════════════════════════════════════════════════
-- Self-service admin configuration for compensation rules and mappings.
-- Enables stakeholders to adjust business rules without SQL changes.
--
-- Run as catalog admin (your user) — NOT as app SP.
-- App SP needs MODIFY grants (see 08_grant_app_permissions.sql).
-- ═══════════════════════════════════════════════════════════════════════════

USE CATALOG edw_dev_hris;
USE SCHEMA hgv_comp;

-- ─────────────────────────────────────────────────────────────────────────────
-- Tour Status → Payout Mapping
-- ─────────────────────────────────────────────────────────────────────────────
-- Maps tour_status_desc values to payout amounts.
-- Special handling: NULL status stored as '__NULL__' string for SQL joins.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dim_tour_status_config (
  config_id             STRING NOT NULL,  -- UUID primary key
  tour_status_desc      STRING,           -- Status value from it_smt_marketing (NULL → '__NULL__')
  payout_amount         DECIMAL(10, 2) NOT NULL,
  is_active             BOOLEAN NOT NULL,
  effective_start_date  DATE NOT NULL,
  effective_end_date    DATE,             -- NULL = open-ended
  created_at            TIMESTAMP NOT NULL,
  created_by            STRING NOT NULL,  -- User/email who created
  updated_at            TIMESTAMP,
  updated_by            STRING            -- User/email who last modified
) USING DELTA;

-- ─────────────────────────────────────────────────────────────────────────────
-- Compensation Rule Configuration
-- ─────────────────────────────────────────────────────────────────────────────
-- Flexible key-value store for global comp rules.
-- Examples: multi_rep_credit_policy, min_tour_count_threshold, etc.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dim_comp_rule_config (
  config_id             STRING NOT NULL,  -- UUID primary key
  rule_name             STRING NOT NULL,  -- e.g., 'multi_rep_credit_policy'
  rule_value            STRING NOT NULL,  -- e.g., 'first_rep_only', 'split_credit', 'all_reps'
  rule_description      STRING,           -- Human-readable explanation
  is_active             BOOLEAN NOT NULL,
  effective_start_date  DATE NOT NULL,
  effective_end_date    DATE,
  created_at            TIMESTAMP NOT NULL,
  created_by            STRING NOT NULL,
  updated_at            TIMESTAMP,
  updated_by            STRING
) USING DELTA;

-- ─────────────────────────────────────────────────────────────────────────────
-- Rep Filtering Rules
-- ─────────────────────────────────────────────────────────────────────────────
-- Define which reps to include/exclude from dim_marketing_rep.
-- Examples: exclude patterns like 'UNASSIGNED', minimum tour count thresholds.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dim_rep_filter_config (
  config_id             STRING NOT NULL,  -- UUID primary key
  filter_name           STRING NOT NULL,  -- Human-readable name
  filter_type           STRING NOT NULL,  -- 'exclude_pattern', 'min_tour_count', 'site_filter', etc.
  filter_value          STRING NOT NULL,  -- Pattern/threshold value
  is_active             BOOLEAN NOT NULL,
  effective_start_date  DATE NOT NULL,
  effective_end_date    DATE,
  created_at            TIMESTAMP NOT NULL,
  created_by            STRING NOT NULL,
  updated_at            TIMESTAMP,
  updated_by            STRING
) USING DELTA;

-- ─────────────────────────────────────────────────────────────────────────────
-- Configuration Change Audit Log
-- ─────────────────────────────────────────────────────────────────────────────
-- Tracks all changes to configuration tables for compliance/debugging.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fact_comp_config_audit_log (
  audit_id              STRING NOT NULL,  -- UUID primary key
  config_table          STRING NOT NULL,  -- 'dim_tour_status_config', etc.
  config_id             STRING NOT NULL,  -- Foreign key to config row
  action                STRING NOT NULL,  -- 'INSERT', 'UPDATE', 'DELETE'
  changed_by            STRING NOT NULL,
  changed_at            TIMESTAMP NOT NULL,
  old_value             STRING,           -- JSON snapshot of previous state
  new_value             STRING            -- JSON snapshot of new state
) USING DELTA;

-- ═══════════════════════════════════════════════════════════════════════════
-- Done: Config tables created
-- Next: Bootstrap default values in server/compSchemaBootstrap.ts
-- Grant: Add MODIFY grants to 08_grant_app_permissions.sql
-- ═══════════════════════════════════════════════════════════════════════════
