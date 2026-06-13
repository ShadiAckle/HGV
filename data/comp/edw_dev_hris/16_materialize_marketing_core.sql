-- =============================================================================
-- MATERIALIZE marketing core (REQUIRED for interactive speed on VDI)
-- =============================================================================
-- DATA WINDOW: calendar year 2026 only (2026-01-01 .. 2026-12-31)
--
-- Step order (run one block at a time if needed):
--   1  _stg_marketing_tour_detail     — marketing spine (163K tours) + detail join
--   2  _stg_tour_enriched             — personnel join only
--   3  fact_marketing_tour_payout     — Delta → Delta (fast)
--   4  dim_marketing_rep              — from tour_payout only (fast, no Cognos)
--   5–8  rollups, periods, views      — seconds
--
-- VDI baseline (2026): txn_rows ~1.23M, marketing tour_keys ~163K (~7.5 txn/tour).
-- Step 1 seeds from it_smt_marketing (tour grain), not a full detail date scan.
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
DROP TABLE IF EXISTS edw_dev_hris.hgv_comp._stg_tour_enriched;
DROP TABLE IF EXISTS edw_dev_hris.hgv_comp._stg_marketing_tour_detail;

-- ---------------------------------------------------------------------------
-- Step 1) Staging — marketing spine (2026) + detail metrics for those tours only
-- ---------------------------------------------------------------------------
CREATE OR REPLACE TABLE edw_dev_hris.hgv_comp._stg_marketing_tour_detail
USING DELTA
COMMENT 'Tour-grain 2026 slice — marketing-led join to detail (VDI ~163K tours)'
AS
WITH tours_2026 AS (
  SELECT
    m.tour_key_hash,
    m.tour_id,
    m.tour_status_desc,
    m.tour_booked_date,
    m.office_code,
    COALESCE(NULLIF(TRIM(m.office_region), ''), 'Other') AS office_region,
    COALESCE(m.channel, 'MKT') AS channel,
    COALESCE(m.marketing_program_desc, '') AS marketing_program,
    COALESCE(m.marketing_package_type_desc, 'Unknown') AS package_type
  FROM edw_dev_cognos.cognos_fm.it_smt_marketing m
  WHERE m.tour_key_hash IS NOT NULL
    AND m.tour_id IS NOT NULL
    AND m.tour_booked_date IS NOT NULL
    AND TO_DATE(m.tour_booked_date) BETWEEN DATE '2026-01-01' AND DATE '2026-12-31'
)
SELECT
  t.tour_key_hash,
  t.tour_id,
  MAX(d.tour_key) AS tour_key,
  MAX(d.enterprise_lead_id) AS enterprise_lead_id,
  MAX(
    COALESCE(
      TO_DATE(d.tour_date),
      TO_DATE(d.transaction_date),
      TO_DATE(t.tour_booked_date)
    )
  ) AS tour_date,
  MAX(COALESCE(CAST(d.showed AS INT), 0)) = 1 AS showed_flag,
  MAX(COALESCE(CAST(d.qualified AS INT), 0)) = 1 AS qualified_flag,
  MAX(CAST(COALESCE(d.net_volume, 0) AS DECIMAL(14, 2))) AS net_volume,
  MAX(COALESCE(d.lead_source_desc, 'Unknown')) AS lead_source,
  MAX(COALESCE(d.lead_prequal_fico_tier, 'U')) AS abc_score,
  MAX(t.tour_status_desc) AS tour_status_desc,
  MAX(t.tour_booked_date) AS tour_booked_date,
  MAX(t.office_code) AS office_code,
  MAX(t.office_region) AS office_region,
  MAX(t.channel) AS channel,
  MAX(t.marketing_program) AS marketing_program,
  MAX(t.package_type) AS package_type
FROM tours_2026 t
INNER JOIN edw_dev_cognos.cognos_fm.it_smt_detail d
  ON d.tour_key_hash = t.tour_key_hash
GROUP BY t.tour_key_hash, t.tour_id;

-- CHECK: expect ~163K rows — SELECT COUNT(*) FROM edw_dev_hris.hgv_comp._stg_marketing_tour_detail;

-- ---------------------------------------------------------------------------
-- Step 2) Enriched staging — personnel only (marketing already in step 1)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE TABLE edw_dev_hris.hgv_comp._stg_tour_enriched
USING DELTA
COMMENT '2026 tours + rep assignment — refresh via script 16'
AS
SELECT
  d.tour_key_hash,
  d.tour_id,
  d.tour_key,
  d.enterprise_lead_id,
  d.tour_date,
  d.showed_flag,
  d.qualified_flag,
  d.net_volume,
  d.lead_source,
  d.abc_score,
  d.tour_status_desc,
  d.tour_booked_date,
  d.office_code,
  d.office_region,
  d.channel,
  d.marketing_program,
  d.package_type,
  p.salesperson_1_employee_id,
  p.salesperson_1_name,
  COALESCE(NULLIF(TRIM(p.sales_team_code), ''), 'TEAM-MKT') AS sales_team_code
FROM edw_dev_hris.hgv_comp._stg_marketing_tour_detail d
INNER JOIN edw_dev_cognos.cognos_fm.it_smt_personnel p
  ON d.tour_key_hash = p.tour_key_hash
WHERE p.salesperson_1_employee_id IS NOT NULL
  AND d.tour_date IS NOT NULL;

-- CHECK: SELECT COUNT(*) FROM edw_dev_hris.hgv_comp._stg_tour_enriched;

-- ---------------------------------------------------------------------------
-- Step 3) fact_marketing_tour_payout — Delta only (no Cognos)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE TABLE edw_dev_hris.hgv_comp.fact_marketing_tour_payout
USING DELTA
COMMENT 'Materialized marketing tour ledger (calendar 2026)'
AS
SELECT
  CAST(t.tour_id AS STRING) AS tour_id,
  COALESCE(CAST(t.salesperson_1_employee_id AS STRING), 'UNASSIGNED') AS rep_id,
  CONCAT(
    CAST(YEAR(t.tour_date) AS STRING),
    '-Q',
    CAST(CAST(CEIL(MONTH(t.tour_date) / 3.0) AS INT) AS STRING)
  ) AS period_id,
  CONCAT('Lead-', CAST(t.enterprise_lead_id AS STRING)) AS guest_name,
  CASE
    WHEN t.qualified_flag THEN 'Qualified'
    WHEN t.showed_flag THEN 'Showed'
    ELSE 'Courtesy'
  END AS guest_type,
  t.tour_date AS arrival_date,
  COALESCE(t.tour_status_desc, 'Scheduled') AS tour_status,
  COALESCE(t.channel, 'MKT') AS code,
  CAST(
    CASE
      WHEN t.qualified_flag THEN GREATEST(t.net_volume, 0) * 0.0025
      WHEN t.showed_flag THEN 35.00
      ELSE 0
    END AS DECIMAL(14, 2)
  ) AS payout,
  t.qualified_flag AS fps_eligible,
  CAST(GREATEST(t.net_volume, 0) * 0.01 AS DECIMAL(14, 2)) AS fps_potential,
  COALESCE(t.marketing_program, '') AS notes,
  CAST(t.enterprise_lead_id AS STRING) AS guest_id,
  CONCAT('HH-', CAST(t.enterprise_lead_id AS STRING)) AS household_id,
  CONCAT('LOC-', t.office_code) AS planned_tour_location_id,
  CAST(NULL AS STRING) AS current_stay_location_id,
  t.lead_source,
  t.abc_score,
  t.package_type,
  CAST(t.tour_key AS STRING) AS xref_tour_id,
  TO_DATE(t.tour_booked_date) AS tour_booked_date,
  COALESCE(NULLIF(TRIM(t.salesperson_1_name), ''), CAST(t.salesperson_1_employee_id AS STRING)) AS rep_name,
  COALESCE(t.office_region, 'Other') AS rep_region,
  COALESCE(t.sales_team_code, 'TEAM-MKT') AS rep_team_id
FROM edw_dev_hris.hgv_comp._stg_tour_enriched t;

-- ---------------------------------------------------------------------------
-- Step 4) dim_marketing_rep — from tour_payout ONLY (no Cognos join)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE TABLE edw_dev_hris.hgv_comp.dim_marketing_rep
USING DELTA
COMMENT 'Materialized marketing reps (calendar 2026)'
AS
SELECT
  tp.rep_id,
  MAX(tp.rep_name) AS rep_name,
  'MKT' AS level_code,
  MAX(tp.rep_team_id) AS team_id,
  MAX(tp.rep_region) AS region,
  TRUE AS is_active
FROM edw_dev_hris.hgv_comp.fact_marketing_tour_payout tp
WHERE tp.rep_id IS NOT NULL
  AND tp.rep_id <> 'UNASSIGNED'
GROUP BY tp.rep_id;

-- ---------------------------------------------------------------------------
-- Step 5) fact_marketing_rep_period — rollup from Delta tour ledger
-- ---------------------------------------------------------------------------
CREATE OR REPLACE TABLE edw_dev_hris.hgv_comp.fact_marketing_rep_period
USING DELTA
COMMENT 'Materialized marketing rep-period KPIs'
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
    CAST(SUM(tp.payout) AS DECIMAL(18, 2)) AS tour_payout,
    CAST(SUM(CASE WHEN tp.payout < 0 THEN ABS(tp.payout) ELSE 0 END) AS DECIMAL(18, 2)) AS chargebacks,
    CAST(SUM(CASE WHEN tp.guest_type = 'Qualified' THEN tp.payout ELSE 0 END) AS DECIMAL(18, 2)) AS qualified_tour_pay,
    CAST(SUM(CASE WHEN tp.guest_type = 'Courtesy' THEN tp.payout ELSE 0 END) AS DECIMAL(18, 2)) AS courtesy_tour_pay
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
  CAST(t.tour_payout AS DECIMAL(18, 2)) AS qtd_earnings,
  CAST(t.tour_payout AS DECIMAL(18, 2)) AS paid_to_date,
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
  CAST(t.qualified_tour_pay AS DECIMAL(18, 2)) AS qualified_tour_pay,
  CAST(t.courtesy_tour_pay AS DECIMAL(18, 2)) AS courtesy_tour_pay,
  CAST(0 AS DECIMAL(18, 2)) AS penetration_spiff,
  CAST(t.chargebacks AS DECIMAL(18, 2)) AS chargebacks,
  CAST(t.tour_payout AS DECIMAL(18, 2)) AS total_payout,
  CAST(30.00 AS DECIMAL(6, 2)) AS base_pct,
  CAST(70.00 AS DECIMAL(6, 2)) AS variable_pct,
  CAST(0 AS DECIMAL(6, 2)) AS tcc_gap_vs_market_pct
FROM tour_agg t;

-- ---------------------------------------------------------------------------
-- Step 6) dim_period — 2026 quarters only (instant)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE TABLE edw_dev_hris.hgv_comp.dim_period
USING DELTA
COMMENT '2026 comp periods'
AS
SELECT period_id, period_label, period_start, period_end, is_current
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
-- Step 7) dim_rep — marketing reps only
-- ---------------------------------------------------------------------------
CREATE OR REPLACE TABLE edw_dev_hris.hgv_comp.dim_rep
USING DELTA
COMMENT 'Materialized rep directory (marketing)'
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
-- Step 8) Thin views
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW edw_dev_hris.hgv_comp.fact_marketing_rep_metric AS
WITH base AS (
  SELECT rep_id, period_id, qualified_tours, tours_shown, show_rate_pct, penetration_pct, total_payout
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
  t.rep_id, t.period_id, t.guest_name, t.tour_id,
  CAST(NULL AS STRING) AS premium_gift,
  CAST(ABS(LEAST(t.payout, 0)) AS DECIMAL(14, 2)) AS chargeback_amount,
  'Negative tour payout / reversal' AS notes
FROM edw_dev_hris.hgv_comp.fact_marketing_tour_payout t
WHERE t.payout < 0;

CREATE OR REPLACE VIEW edw_dev_hris.hgv_comp.fact_marketing_arrival AS
SELECT
  CONCAT('ARR-', t.tour_id) AS arrival_id,
  t.rep_id, t.period_id, t.guest_name, t.guest_type,
  COALESCE(CAST(t.tour_booked_date AS STRING), CAST(t.arrival_date AS STRING)) AS arrival_datetime,
  COALESCE(t.code, 'Desk') AS desk,
  CAST(CASE WHEN t.guest_type = 'Qualified' THEN 150 ELSE 50 END AS DECIMAL(14, 2)) AS potential_qualified_tour,
  CAST(t.fps_potential AS DECIMAL(14, 2)) AS potential_fps_payout,
  CAST(t.payout + t.fps_potential AS DECIMAL(14, 2)) AS projected_total_payout
FROM edw_dev_hris.hgv_comp.fact_marketing_tour_payout t
WHERE t.tour_status IN ('Scheduled', 'Booked', 'Confirmed')
   OR t.arrival_date >= CURRENT_DATE();

-- Smoke: SELECT COUNT(*) FROM edw_dev_hris.hgv_comp.dim_marketing_rep;
