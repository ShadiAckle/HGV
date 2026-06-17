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
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  effective_date        DATE NOT NULL,
  end_date              DATE,             -- NULL = open-ended
  rule_description      STRING,           -- Human-readable explanation
  modified_by           STRING NOT NULL,  -- User/email who last modified
  modified_at           TIMESTAMP NOT NULL,
  created_at            TIMESTAMP NOT NULL
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
  rule_parameters       STRING,           -- JSON for complex rules (e.g., {"split_percentage": 50})
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  effective_date        DATE NOT NULL,
  end_date              DATE,
  rule_description      STRING,
  modified_by           STRING NOT NULL,
  modified_at           TIMESTAMP NOT NULL,
  created_at            TIMESTAMP NOT NULL
) USING DELTA;

-- ─────────────────────────────────────────────────────────────────────────────
-- Rep Filtering Rules
-- ─────────────────────────────────────────────────────────────────────────────
-- Define which reps to include/exclude from dim_marketing_rep.
-- Examples: exclude patterns like 'UNASSIGNED', minimum tour count thresholds.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dim_rep_filter_config (
  config_id             STRING NOT NULL,  -- UUID primary key
  filter_type           STRING NOT NULL,  -- 'exclude_pattern', 'min_tour_count', 'site_filter', etc.
  filter_value          STRING NOT NULL,  -- Pattern/threshold value
  filter_parameters     STRING,           -- JSON for complex filters
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  effective_date        DATE NOT NULL,
  end_date              DATE,
  rule_description      STRING,
  modified_by           STRING NOT NULL,
  modified_at           TIMESTAMP NOT NULL,
  created_at            TIMESTAMP NOT NULL
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
  action_type           STRING NOT NULL,  -- 'INSERT', 'UPDATE', 'DELETE', 'ACTIVATE', 'DEACTIVATE'
  old_value             STRING,           -- JSON snapshot of previous state
  new_value             STRING,           -- JSON snapshot of new state
  modified_by           STRING NOT NULL,
  modified_at           TIMESTAMP NOT NULL,
  client_ip             STRING,
  user_agent            STRING
) USING DELTA;

-- ═══════════════════════════════════════════════════════════════════════════
-- Done: Config tables created
-- Next: Bootstrap default values in server/compSchemaBootstrap.ts
-- Grant: Add MODIFY grants to 08_grant_app_permissions.sql
-- ═══════════════════════════════════════════════════════════════════════════
