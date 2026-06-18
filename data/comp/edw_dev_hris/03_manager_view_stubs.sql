-- =============================================================================
-- MANAGER-VIEW ANALYTICS STUBS  (idempotent — CREATE TABLE IF NOT EXISTS)
--
-- The manager workspace reads several analytics tables that exist in the full
-- sales schema but are NOT created by the marketing-only build (00/01/02).
-- Without them, the manager "My Comp" view errors with TABLE_OR_VIEW_NOT_FOUND
-- (e.g. fact_rep_product_mix). These empty stubs let the manager queries run
-- and surface the real marketing data (from fact_marketing_rep_period) while
-- gracefully showing empty for the sales-only metrics.
--
-- Safe to run anytime: IF NOT EXISTS never overwrites existing data.
-- =============================================================================

CREATE TABLE IF NOT EXISTS edw_dev_hris.hgv_comp.fact_manager_intervention (
  intervention_id   STRING NOT NULL, manager_rep_id STRING NOT NULL,
  target_rep_id     STRING NOT NULL, period_id STRING NOT NULL,
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
  bonus DECIMAL(14,2) NOT NULL, total_earnings DECIMAL(14,2) NOT NULL,
  total_paid DECIMAL(14,2) NOT NULL
) USING DELTA;

CREATE TABLE IF NOT EXISTS edw_dev_hris.hgv_comp.fact_team_snapshot (
  team_id STRING NOT NULL, period_id STRING NOT NULL,
  team_attainment_pct DECIMAL(6,2) NOT NULL, top_performer_count INT NOT NULL,
  at_risk_count INT NOT NULL, ffs_sales_pct DECIMAL(6,2) NOT NULL, ffs_target_pct DECIMAL(6,2) NOT NULL
) USING DELTA;

CREATE TABLE IF NOT EXISTS edw_dev_hris.hgv_comp.dim_team (
  team_id STRING NOT NULL, team_name STRING NOT NULL, region STRING NOT NULL
) USING DELTA;

-- Grants for the app service principal
GRANT SELECT ON TABLE edw_dev_hris.hgv_comp.fact_manager_intervention TO `hgv-app-service-principal`;
GRANT SELECT ON TABLE edw_dev_hris.hgv_comp.fact_rep_market_position   TO `hgv-app-service-principal`;
GRANT SELECT ON TABLE edw_dev_hris.hgv_comp.dim_product_line           TO `hgv-app-service-principal`;
GRANT SELECT ON TABLE edw_dev_hris.hgv_comp.fact_rep_product_mix       TO `hgv-app-service-principal`;
GRANT SELECT ON TABLE edw_dev_hris.hgv_comp.fact_quota_attainment      TO `hgv-app-service-principal`;
GRANT SELECT ON TABLE edw_dev_hris.hgv_comp.fact_payout                TO `hgv-app-service-principal`;
GRANT SELECT ON TABLE edw_dev_hris.hgv_comp.fact_team_snapshot         TO `hgv-app-service-principal`;
GRANT SELECT ON TABLE edw_dev_hris.hgv_comp.dim_team                   TO `hgv-app-service-principal`;

-- Verify
SELECT 'fact_rep_product_mix' AS tbl, COUNT(*) AS rows FROM edw_dev_hris.hgv_comp.fact_rep_product_mix
UNION ALL SELECT 'fact_rep_market_position', COUNT(*) FROM edw_dev_hris.hgv_comp.fact_rep_market_position
UNION ALL SELECT 'fact_manager_intervention', COUNT(*) FROM edw_dev_hris.hgv_comp.fact_manager_intervention;
