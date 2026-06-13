-- =============================================================================
-- MATERIALIZE marketing core (REQUIRED for interactive speed on VDI)
-- =============================================================================
-- DATA WINDOW: calendar year 2026 only (2026-01-01 .. 2026-12-31)
-- Smaller than multi-year windows — fewer Cognos rows to scan on VDI.
--
-- Architecture fix vs prior 16:
--   • ONE Cognos detail scan → tour-grain staging table (not transaction grain)
--   • dim_marketing_rep + fact_marketing_tour_payout read staging (no re-scan)
--   • dim_period = static app periods (no commissions scan)
--
-- If step 1 still slow: run ONLY the "Step 1" block below, wait, then steps 2–7.
-- Interrupt any multi-hour run — prior version scanned billions of txn rows twice.
-- =============================================================================

-- Dependent views + partial tables from stalled runs
DROP VIEW IF EXISTS edw_dev_hris.hgv_comp.fact_marketing_rep_metric;
DROP VIEW IF EXISTS edw_dev_hris.hgv_comp.fact_marketing_chargeback;
DROP VIEW IF EXISTS edw_dev_hris.hgv_comp.fact_marketing_arrival;
DROP VIEW IF EXISTS edw_dev_hris.hgv_comp.fact_marketing_rep_period;
DROP VIEW IF EXISTS edw_dev_hris.hgv_comp.fact_marketing_tour_payout;
DROP VIEW IF EXISTS edw_dev_hris.hgv_comp.dim_marketing_rep;
DROP VIEW IF EXISTS edw_dev_hris.hgv_comp.dim_period;
DROP VIEW IF EXISTS edw_dev_hris.hgv_comp.dim_rep;

DROP TABLE IF EXISTS edw_dev_hris.hgv_comp.fact_marketing_rep_period;
DROP TABLE IF EXISTS edw_dev_hris.hgv_comp.fact_marketing_tour_payout;
DROP TABLE IF EXISTS edw_dev_hris.hgv_comp.dim_marketing_rep;
DROP TABLE IF EXISTS edw_dev_hris.hgv_comp.dim_period;
DROP TABLE IF EXISTS edw_dev_hris.hgv_comp.dim_rep;
DROP TABLE IF EXISTS edw_dev_hris.hgv_comp._stg_marketing_tour_detail;

-- ---------------------------------------------------------------------------
-- Step 1) Staging — ONE scan of it_smt_detail, collapsed to tour grain
-- ---------------------------------------------------------------------------
CREATE OR REPLACE TABLE edw_dev_hris.hgv_comp._stg_marketing_tour_detail
USING DELTA
COMMENT 'Tour-grain Cognos slice for marketing materialization (calendar 2026)'
AS
SELECT
  d.tour_key_hash,
  d.tour_id,
  MAX(d.tour_key) AS tour_key,
  MAX(d.enterprise_lead_id) AS enterprise_lead_id,
  MAX(COALESCE(TO_DATE(d.tour_date), TO_DATE(d.transaction_date))) AS tour_date,
  MAX(COALESCE(CAST(d.showed AS INT), 0)) = 1 AS showed_flag,
  MAX(COALESCE(CAST(d.qualified AS INT), 0)) = 1 AS qualified_flag,
  MAX(CAST(COALESCE(d.net_volume, 0) AS DECIMAL(14, 2))) AS net_volume,
  MAX(COALESCE(d.lead_source_desc, 'Unknown')) AS lead_source,
  MAX(COALESCE(d.lead_prequal_fico_tier, 'U')) AS abc_score
FROM edw_dev_cognos.cognos_fm.it_smt_detail d
WHERE d.tour_id IS NOT NULL
  AND (
    (d.tour_date IS NOT NULL
      AND TO_DATE(d.tour_date) BETWEEN DATE '2026-01-01' AND DATE '2026-12-31')
    OR (d.tour_date IS NULL
      AND TO_DATE(d.transaction_date) BETWEEN DATE '2026-01-01' AND DATE '2026-12-31')
  )
GROUP BY d.tour_key_hash, d.tour_id;

-- ---------------------------------------------------------------------------
-- Step 2) dim_marketing_rep — from staging (no Cognos detail re-scan)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE TABLE edw_dev_hris.hgv_comp.dim_marketing_rep
USING DELTA
COMMENT 'Materialized marketing reps (calendar 2026) — refresh via 16_materialize_marketing_core.sql'
AS
SELECT
  CAST(p.salesperson_1_employee_id AS STRING) AS rep_id,
  MAX(
    COALESCE(NULLIF(TRIM(p.salesperson_1_name), ''), CAST(p.salesperson_1_employee_id AS STRING))
  ) AS rep_name,
  'MKT' AS level_code,
  MAX(COALESCE(NULLIF(TRIM(p.sales_team_code), ''), 'TEAM-MKT')) AS team_id,
  MAX(COALESCE(NULLIF(TRIM(m.office_region), ''), 'Other')) AS region,
  TRUE AS is_active
FROM edw_dev_hris.hgv_comp._stg_marketing_tour_detail d
INNER JOIN edw_dev_cognos.cognos_fm.it_smt_personnel p
  ON d.tour_key_hash = p.tour_key_hash
LEFT JOIN edw_dev_cognos.cognos_fm.it_smt_marketing m
  ON d.tour_key_hash = m.tour_key_hash
WHERE p.salesperson_1_employee_id IS NOT NULL
GROUP BY CAST(p.salesperson_1_employee_id AS STRING);

-- ---------------------------------------------------------------------------
-- Step 3) fact_marketing_tour_payout — staging + marketing/personnel only
-- ---------------------------------------------------------------------------
CREATE OR REPLACE TABLE edw_dev_hris.hgv_comp.fact_marketing_tour_payout
USING DELTA
COMMENT 'Materialized marketing tour ledger (calendar 2026) — refresh via 16_materialize_marketing_core.sql'
AS
SELECT
  CAST(d.tour_id AS STRING) AS tour_id,
  COALESCE(CAST(p.salesperson_1_employee_id AS STRING), 'UNASSIGNED') AS rep_id,
  CONCAT(
    CAST(YEAR(d.tour_date) AS STRING),
    '-Q',
    CAST(CAST(CEIL(MONTH(d.tour_date) / 3.0) AS INT) AS STRING)
  ) AS period_id,
  CONCAT('Lead-', CAST(d.enterprise_lead_id AS STRING)) AS guest_name,
  CASE
    WHEN d.qualified_flag THEN 'Qualified'
    WHEN d.showed_flag THEN 'Showed'
    ELSE 'Courtesy'
  END AS guest_type,
  d.tour_date AS arrival_date,
  COALESCE(m.tour_status_desc, 'Scheduled') AS tour_status,
  COALESCE(m.channel, 'MKT') AS code,
  CAST(
    CASE
      WHEN d.qualified_flag THEN GREATEST(d.net_volume, 0) * 0.0025
      WHEN d.showed_flag THEN 35.00
      ELSE 0
    END AS DECIMAL(14, 2)
  ) AS payout,
  d.qualified_flag AS fps_eligible,
  CAST(GREATEST(d.net_volume, 0) * 0.01 AS DECIMAL(14, 2)) AS fps_potential,
  COALESCE(m.marketing_program_desc, '') AS notes,
  CAST(d.enterprise_lead_id AS STRING) AS guest_id,
  CONCAT('HH-', CAST(d.enterprise_lead_id AS STRING)) AS household_id,
  CONCAT('LOC-', m.office_code) AS planned_tour_location_id,
  CAST(NULL AS STRING) AS current_stay_location_id,
  d.lead_source,
  d.abc_score,
  COALESCE(m.marketing_package_type_desc, 'Unknown') AS package_type,
  CAST(d.tour_key AS STRING) AS xref_tour_id,
  TO_DATE(m.tour_booked_date) AS tour_booked_date,
  COALESCE(NULLIF(TRIM(p.salesperson_1_name), ''), CAST(p.salesperson_1_employee_id AS STRING)) AS rep_name,
  COALESCE(NULLIF(TRIM(m.office_region), ''), 'Other') AS rep_region,
  COALESCE(NULLIF(TRIM(p.sales_team_code), ''), 'TEAM-MKT') AS rep_team_id
FROM edw_dev_hris.hgv_comp._stg_marketing_tour_detail d
INNER JOIN edw_dev_cognos.cognos_fm.it_smt_personnel p
  ON d.tour_key_hash = p.tour_key_hash
LEFT JOIN edw_dev_cognos.cognos_fm.it_smt_marketing m
  ON d.tour_key_hash = m.tour_key_hash
WHERE p.salesperson_1_employee_id IS NOT NULL
  AND d.tour_date IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Step 4) fact_marketing_rep_period — rollup from Delta tour ledger
-- ---------------------------------------------------------------------------
CREATE OR REPLACE TABLE edw_dev_hris.hgv_comp.fact_marketing_rep_period
USING DELTA
COMMENT 'Materialized marketing rep-period KPIs — refresh via 16_materialize_marketing_core.sql'
AS
WITH tour_agg AS (
  SELECT
    tp.rep_id,
    tp.period_id,
    MAX(tp.rep_name) AS rep_name,
    MAX(tp.rep_region) AS region,
    MAX(tp.rep_team_id) AS team_id,
    COUNT(*) AS tours_total,
    SUM(CASE WHEN tp.guest_type = 'Qualified' THEN 1 ELSE 0 END) AS qualified_tours,
    SUM(CASE WHEN tp.guest_type IN ('Qualified', 'Showed') THEN 1 ELSE 0 END) AS tours_shown,
    SUM(tp.payout) AS tour_payout,
    SUM(CASE WHEN tp.payout < 0 THEN ABS(tp.payout) ELSE 0 END) AS chargebacks,
    SUM(CASE WHEN tp.guest_type = 'Qualified' THEN tp.payout ELSE 0 END) AS qualified_tour_pay,
    SUM(CASE WHEN tp.guest_type = 'Courtesy' THEN tp.payout ELSE 0 END) AS courtesy_tour_pay
  FROM edw_dev_hris.hgv_comp.fact_marketing_tour_payout tp
  GROUP BY tp.rep_id, tp.period_id
)
SELECT
  t.rep_id,
  t.period_id,
  t.rep_name,
  'PLAN-MKT-2026' AS plan_id,
  COALESCE(t.region, 'Regional') AS assigned_area,
  CONCAT('AREA-', COALESCE(t.team_id, 'UNK')) AS bonus_area_id,
  CAST(t.tour_payout AS DECIMAL(14, 2)) AS qtd_earnings,
  CAST(t.tour_payout AS DECIMAL(14, 2)) AS paid_to_date,
  CAST(t.qualified_tours AS INT) AS qualified_tours,
  CAST(t.tours_shown AS INT) AS tours_shown,
  CAST(
    CASE WHEN t.tours_total = 0 THEN 0 ELSE (t.tours_shown / t.tours_total) * 100 END AS DECIMAL(6, 2)
  ) AS show_rate_pct,
  CAST(
    CASE WHEN t.tours_total = 0 THEN 0 ELSE (t.qualified_tours / t.tours_total) * 100 END AS DECIMAL(6, 2)
  ) AS penetration_pct,
  CAST(25.00 AS DECIMAL(6, 2)) AS penetration_target_pct,
  (t.qualified_tours >= 10) AS spiff_active,
  CASE
    WHEN t.qualified_tours < 10 THEN '10 Qualified Tours'
    WHEN t.qualified_tours < 20 THEN '20 Qualified Tours'
    ELSE 'Director Tier'
  END AS next_tier_label,
  CAST(GREATEST(0, 10 - t.qualified_tours) AS INT) AS next_tier_gap_tours,
  CAST(t.qualified_tour_pay AS DECIMAL(14, 2)) AS qualified_tour_pay,
  CAST(t.courtesy_tour_pay AS DECIMAL(14, 2)) AS courtesy_tour_pay,
  CAST(0 AS DECIMAL(14, 2)) AS penetration_spiff,
  CAST(t.chargebacks AS DECIMAL(14, 2)) AS chargebacks,
  CAST(t.tour_payout AS DECIMAL(14, 2)) AS total_payout,
  CAST(30.00 AS DECIMAL(6, 2)) AS base_pct,
  CAST(70.00 AS DECIMAL(6, 2)) AS variable_pct,
  CAST(0 AS DECIMAL(6, 2)) AS tcc_gap_vs_market_pct
FROM tour_agg t;

-- ---------------------------------------------------------------------------
-- Step 5) dim_period — 2026 quarters only (instant)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE TABLE edw_dev_hris.hgv_comp.dim_period
USING DELTA
COMMENT '2026 comp periods — refresh via 16_materialize_marketing_core.sql'
AS
SELECT
  period_id,
  period_label,
  period_start,
  period_end,
  is_current
FROM (
  SELECT '2026-Q4' AS period_id, 'Q4 2026' AS period_label,
         DATE '2026-10-01' AS period_start, DATE '2026-12-31' AS period_end, FALSE AS is_current
  UNION ALL
  SELECT '2026-Q3', 'Q3 2026', DATE '2026-07-01', DATE '2026-09-30', FALSE
  UNION ALL
  SELECT '2026-Q2', 'Q2 2026', DATE '2026-04-01', DATE '2026-06-30', TRUE
  UNION ALL
  SELECT '2026-Q1', 'Q1 2026', DATE '2026-01-01', DATE '2026-03-31', FALSE
) p;

-- ---------------------------------------------------------------------------
-- Step 6) dim_rep — marketing reps only (skip commissions scan for VDI speed)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE TABLE edw_dev_hris.hgv_comp.dim_rep
USING DELTA
COMMENT 'Materialized rep directory (marketing) — refresh via 16_materialize_marketing_core.sql'
AS
SELECT
  rep_id,
  rep_name,
  level_code,
  team_id,
  CAST(NULL AS STRING) AS manager_rep_id,
  region,
  is_active
FROM edw_dev_hris.hgv_comp.dim_marketing_rep;

-- ---------------------------------------------------------------------------
-- Step 7) Thin views on materialized tables
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW edw_dev_hris.hgv_comp.fact_marketing_rep_metric AS
WITH base AS (
  SELECT
    rep_id,
    period_id,
    qualified_tours,
    tours_shown,
    show_rate_pct,
    penetration_pct,
    total_payout
  FROM edw_dev_hris.hgv_comp.fact_marketing_rep_period
)
SELECT rep_id, period_id, 'Qualified Tours' AS metric_name, CAST(40.00 AS DECIMAL(6, 2)) AS weight_pct,
       CAST(total_payout * 0.4 AS DECIMAL(14, 2)) AS earnings,
       CAST(penetration_pct AS DECIMAL(6, 2)) AS attainment_pct,
       'Plan target' AS target_label,
       CAST(GREATEST(0, (25 - penetration_pct) * 50) AS DECIMAL(14, 2)) AS opportunity_usd
FROM base
UNION ALL
SELECT rep_id, period_id, 'Show Rate', CAST(35.00 AS DECIMAL(6, 2)),
       CAST(total_payout * 0.35 AS DECIMAL(14, 2)),
       show_rate_pct, '85% benchmark',
       CAST(GREATEST(0, (85 - show_rate_pct) * 25) AS DECIMAL(14, 2))
FROM base
UNION ALL
SELECT rep_id, period_id, 'Qualified Tour Pay', CAST(25.00 AS DECIMAL(6, 2)),
       CAST(total_payout * 0.25 AS DECIMAL(14, 2)),
       CAST(CASE WHEN qualified_tours = 0 THEN 0 ELSE LEAST(100, qualified_tours * 5) END AS DECIMAL(6, 2)),
       'Tour count tier',
       CAST(GREATEST(0, (10 - qualified_tours) * 100) AS DECIMAL(14, 2))
FROM base;

CREATE OR REPLACE VIEW edw_dev_hris.hgv_comp.fact_marketing_chargeback AS
SELECT
  CONCAT('MKT-CB-', t.tour_id) AS chargeback_id,
  t.rep_id,
  t.period_id,
  t.guest_name,
  t.tour_id,
  CAST(NULL AS STRING) AS premium_gift,
  CAST(ABS(LEAST(t.payout, 0)) AS DECIMAL(14, 2)) AS chargeback_amount,
  'Negative tour payout / reversal' AS notes
FROM edw_dev_hris.hgv_comp.fact_marketing_tour_payout t
WHERE t.payout < 0;

CREATE OR REPLACE VIEW edw_dev_hris.hgv_comp.fact_marketing_arrival AS
SELECT
  CONCAT('ARR-', t.tour_id) AS arrival_id,
  t.rep_id,
  t.period_id,
  t.guest_name,
  t.guest_type,
  COALESCE(CAST(t.tour_booked_date AS STRING), CAST(t.arrival_date AS STRING)) AS arrival_datetime,
  COALESCE(t.code, 'Desk') AS desk,
  CAST(CASE WHEN t.guest_type = 'Qualified' THEN 150 ELSE 50 END AS DECIMAL(14, 2)) AS potential_qualified_tour,
  CAST(t.fps_potential AS DECIMAL(14, 2)) AS potential_fps_payout,
  CAST(t.payout + t.fps_potential AS DECIMAL(14, 2)) AS projected_total_payout
FROM edw_dev_hris.hgv_comp.fact_marketing_tour_payout t
WHERE t.tour_status IN ('Scheduled', 'Booked', 'Confirmed')
   OR t.arrival_date >= CURRENT_DATE();

-- ---------------------------------------------------------------------------
-- Smoke (seconds after completion):
-- ---------------------------------------------------------------------------
-- SELECT COUNT(*) FROM edw_dev_hris.hgv_comp._stg_marketing_tour_detail;
-- SELECT COUNT(*) FROM edw_dev_hris.hgv_comp.dim_marketing_rep;
-- SELECT COUNT(*) FROM edw_dev_hris.hgv_comp.fact_marketing_tour_payout;
-- SELECT * FROM edw_dev_hris.hgv_comp.dim_period ORDER BY period_start;
