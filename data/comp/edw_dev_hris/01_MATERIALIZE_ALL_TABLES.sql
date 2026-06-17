-- =============================================================================
-- MATERIALIZE ALL TABLES
-- Run AFTER 00_CLEAN_AND_REBUILD.sql
--
-- Schema matches EXACTLY what the app server code expects.
-- Source of truth for expected columns: server/compSchemaBootstrap.ts
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Step 1) Staging: marketing spine (2026) with aggregated detail
-- ONE row per tour_key_hash, detail pre-aggregated to prevent duplication
-- ---------------------------------------------------------------------------
CREATE OR REPLACE TABLE edw_dev_hris.hgv_comp._stg_marketing_tour_detail
USING DELTA AS
WITH tours_2026 AS (
  SELECT
    m.tour_key_hash,
    m.tour_id,
    m.tour_status_desc,
    m.tour_booked_date,
    m.office_code,
    COALESCE(NULLIF(TRIM(m.office_region), ''), 'Other') AS office_region,
    COALESCE(m.channel, 'MKT') AS channel,
    ROW_NUMBER() OVER (PARTITION BY m.tour_key_hash ORDER BY m.tour_booked_date) AS rn
  FROM edw_dev_cognos.cognos_fm.it_smt_marketing m
  WHERE TO_DATE(m.tour_booked_date) BETWEEN DATE '2026-01-01' AND DATE '2026-12-31'
),
tour_detail_agg AS (
  SELECT
    d.tour_key_hash,
    MAX(CASE WHEN CAST(d.qualified AS STRING) IN ('1','true','TRUE','Y') THEN 1 ELSE 0 END) AS qualified_flag,
    MAX(CASE WHEN CAST(d.showed AS STRING) IN ('1','true','TRUE','Y') THEN 1 ELSE 0 END) AS showed_flag
  FROM edw_dev_cognos.cognos_fm.it_smt_detail d
  WHERE d.tour_key_hash IN (SELECT tour_key_hash FROM tours_2026)
    AND TO_DATE(d.transaction_date) BETWEEN DATE '2026-01-01' AND DATE '2026-12-31'
  GROUP BY d.tour_key_hash
)
SELECT
  t.tour_key_hash,
  t.tour_id,
  t.tour_status_desc,
  t.tour_booked_date,
  t.office_code,
  t.office_region,
  t.channel,
  COALESCE(d.qualified_flag, 0) = 1 AS qualified_flag,
  COALESCE(d.showed_flag, 0) = 1    AS showed_flag
FROM tours_2026 t
LEFT JOIN tour_detail_agg d ON t.tour_key_hash = d.tour_key_hash
WHERE t.rn = 1;

-- ---------------------------------------------------------------------------
-- Step 2) Staging: enrich with OPC rep (one rep per tour)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE TABLE edw_dev_hris.hgv_comp._stg_tour_enriched
USING DELTA AS
WITH personnel_ranked AS (
  SELECT
    p.tour_key_hash,
    CAST(p.opc_person_1_employee_id AS STRING) AS rep_id,
    p.opc_person_1_name                         AS rep_name,
    p.opc_team_code                             AS team_id,
    ROW_NUMBER() OVER (
      PARTITION BY p.tour_key_hash
      ORDER BY
        CASE WHEN p.opc_person_1_employee_id IS NOT NULL
              AND CAST(p.opc_person_1_employee_id AS STRING) NOT IN ('0','')
             THEN 0 ELSE 1 END,
        p.opc_person_1_employee_id DESC
    ) AS rn
  FROM edw_dev_cognos.cognos_fm.it_smt_personnel p
  WHERE p.tour_key_hash IN (SELECT tour_key_hash FROM edw_dev_hris.hgv_comp._stg_marketing_tour_detail)
)
SELECT
  d.tour_key_hash,
  d.tour_id,
  d.tour_status_desc,
  d.tour_booked_date,
  d.office_code,
  d.office_region,
  d.channel,
  d.qualified_flag,
  d.showed_flag,
  p.rep_id,
  COALESCE(p.rep_name, 'UNASSIGNED') AS rep_name,
  p.team_id
FROM edw_dev_hris.hgv_comp._stg_marketing_tour_detail d
INNER JOIN personnel_ranked p
  ON d.tour_key_hash = p.tour_key_hash AND p.rn = 1
WHERE p.rep_id IS NOT NULL
  AND p.rep_id NOT IN ('0', '');

-- ---------------------------------------------------------------------------
-- Step 3) dim_period
-- period_id format: '2026-Q1', '2026-Q2', etc. (matches CURRENT_PERIOD_ID)
-- dim_period schema from compSchemaBootstrap: period_id, period_label,
--   period_start, period_end, is_current
-- ---------------------------------------------------------------------------
CREATE OR REPLACE TABLE edw_dev_hris.hgv_comp.dim_period
USING DELTA AS
SELECT
  CONCAT(YEAR(period_start), '-Q', QUARTER(period_start)) AS period_id,
  CONCAT('Q', QUARTER(period_start), ' ', YEAR(period_start)) AS period_label,
  period_start,
  LAST_DAY(ADD_MONTHS(period_start, 2)) AS period_end,
  CONCAT(YEAR(period_start), '-Q', QUARTER(period_start)) = '2026-Q2' AS is_current
FROM (
  SELECT DISTINCT DATE_TRUNC('quarter', TO_DATE(tour_booked_date)) AS period_start
  FROM edw_dev_cognos.cognos_fm.it_smt_marketing
  WHERE TO_DATE(tour_booked_date) BETWEEN DATE '2026-01-01' AND DATE '2026-12-31'
)
ORDER BY period_start;

-- ---------------------------------------------------------------------------
-- Step 4) dim_marketing_rep
-- Exact schema app queries: rep_id, rep_name, level_code, team_id, region, is_active
-- ---------------------------------------------------------------------------
CREATE OR REPLACE TABLE edw_dev_hris.hgv_comp.dim_marketing_rep
USING DELTA AS
SELECT DISTINCT
  rep_id,
  rep_name,
  'C2a'                   AS level_code,
  COALESCE(team_id, 'UNASSIGNED') AS team_id,
  office_region           AS region,
  TRUE                    AS is_active
FROM edw_dev_hris.hgv_comp._stg_tour_enriched
WHERE rep_id IS NOT NULL
  AND rep_id NOT LIKE 'PERSONA-MKT-%'
ORDER BY rep_name;

-- ---------------------------------------------------------------------------
-- Step 5) dim_rep (unified rep dimension, app queries: rep_id, rep_name,
--   level_code, team_id, manager_rep_id, region, is_active)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE TABLE edw_dev_hris.hgv_comp.dim_rep
USING DELTA AS
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
-- Step 6) fact_marketing_tour_payout
-- Exact schema (compSchemaBootstrap line 68-74):
--   tour_id, rep_id, period_id, guest_name, guest_type, arrival_date,
--   tour_status, code, payout, fps_eligible, fps_potential, notes,
--   guest_id, household_id, planned_tour_location_id,
--   current_stay_location_id, lead_source, abc_score, package_type,
--   xref_tour_id, tour_booked_date
-- ---------------------------------------------------------------------------
CREATE OR REPLACE TABLE edw_dev_hris.hgv_comp.fact_marketing_tour_payout
USING DELTA AS
SELECT
  t.tour_id,
  t.rep_id,
  CONCAT(YEAR(TO_DATE(t.tour_booked_date)), '-Q', QUARTER(TO_DATE(t.tour_booked_date))) AS period_id,

  -- Guest columns: not available in Cognos source, left NULL
  CAST(NULL AS STRING)  AS guest_name,
  CAST(NULL AS STRING)  AS guest_type,

  TO_DATE(t.tour_booked_date) AS arrival_date,
  t.tour_status_desc          AS tour_status,

  -- Code: Q = qualified, NQ = not qualified (matches demo seed pattern)
  CASE WHEN t.qualified_flag THEN 'Q' ELSE 'NQ' END AS code,

  -- Payout from admin-configurable status config table
  COALESCE(cfg.payout_amount, 0.00) AS payout,

  -- FPS eligibility from detail.qualified
  t.qualified_flag AS fps_eligible,

  CASE WHEN t.qualified_flag THEN CAST(250.00 AS DECIMAL(14,2)) ELSE CAST(0.00 AS DECIMAL(14,2)) END AS fps_potential,

  CAST(NULL AS STRING) AS notes,
  CAST(NULL AS STRING) AS guest_id,
  CAST(NULL AS STRING) AS household_id,
  t.office_code        AS planned_tour_location_id,
  CAST(NULL AS STRING) AS current_stay_location_id,
  t.channel            AS lead_source,
  CAST(NULL AS STRING) AS abc_score,
  CAST(NULL AS STRING) AS package_type,
  CAST(NULL AS STRING) AS xref_tour_id,
  TO_DATE(t.tour_booked_date) AS tour_booked_date

FROM edw_dev_hris.hgv_comp._stg_tour_enriched t
LEFT JOIN edw_dev_hris.hgv_comp.dim_tour_status_config cfg
  ON COALESCE(t.tour_status_desc, '__NULL__') = COALESCE(cfg.tour_status_desc, '__NULL__')
 AND cfg.is_active = TRUE
 AND CURRENT_DATE() BETWEEN cfg.effective_start_date
                        AND COALESCE(cfg.effective_end_date, DATE '2099-12-31');

-- ---------------------------------------------------------------------------
-- Step 7) fact_marketing_rep_period
-- Exact schema (compSchemaBootstrap line 52-60):
--   rep_id, period_id, rep_name, plan_id, assigned_area, bonus_area_id,
--   qtd_earnings, paid_to_date, qualified_tours, tours_shown, show_rate_pct,
--   penetration_pct, penetration_target_pct, spiff_active, next_tier_label,
--   next_tier_gap_tours, qualified_tour_pay, courtesy_tour_pay,
--   penetration_spiff, chargebacks, total_payout, base_pct, variable_pct,
--   tcc_gap_vs_market_pct
-- ---------------------------------------------------------------------------
CREATE OR REPLACE TABLE edw_dev_hris.hgv_comp.fact_marketing_rep_period
USING DELTA AS
WITH agg AS (
  SELECT
    tp.rep_id,
    tp.period_id,
    MAX(tp.rep_id)  AS _rep_id_check,  -- just for grouping reference
    MAX(dr.rep_name) AS rep_name,
    MAX(dr.team_id)  AS team_id,

    -- Paid tour counts (payout > 0 means it was a payable show/tour)
    COUNT(DISTINCT CASE WHEN tp.payout > 0 THEN tp.tour_id END) AS qualified_tours,

    -- Showed tours: any tour with a show-type status
    COUNT(DISTINCT CASE WHEN tp.tour_status IN ('SHOW','TOUR','SHOWN') THEN tp.tour_id END) AS tours_shown,

    COUNT(DISTINCT tp.tour_id) AS total_tours,

    -- Payout components
    CAST(SUM(tp.payout) AS DECIMAL(14,2)) AS qualified_tour_pay,
    CAST(0.00 AS DECIMAL(14,2))           AS courtesy_tour_pay,
    CAST(0.00 AS DECIMAL(14,2))           AS penetration_spiff,
    CAST(0.00 AS DECIMAL(14,2))           AS chargebacks,

    -- FPS potential
    CAST(SUM(tp.fps_potential) AS DECIMAL(14,2)) AS fps_earn,

    -- Dominant office for this rep+period
    FIRST(tp.planned_tour_location_id) AS assigned_area

  FROM edw_dev_hris.hgv_comp.fact_marketing_tour_payout tp
  JOIN edw_dev_hris.hgv_comp.dim_marketing_rep dr ON dr.rep_id = tp.rep_id
  GROUP BY tp.rep_id, tp.period_id
)
SELECT
  a.rep_id,
  a.period_id,
  a.rep_name,
  'PLAN-MKT-REP-2026'                         AS plan_id,
  COALESCE(a.assigned_area, 'Unknown')         AS assigned_area,
  COALESCE(a.assigned_area, 'Unknown')         AS bonus_area_id,

  -- qtd_earnings = tour pay + fps potential - chargebacks
  CAST(a.qualified_tour_pay + a.fps_earn AS DECIMAL(14,2)) AS qtd_earnings,
  CAST(a.qualified_tour_pay AS DECIMAL(14,2))               AS paid_to_date,

  a.qualified_tours,
  a.tours_shown,

  -- show_rate_pct = tours_shown / total_tours * 100
  CAST(
    CASE WHEN a.total_tours > 0
         THEN ROUND(a.tours_shown * 100.0 / a.total_tours, 2)
         ELSE 0.0 END
  AS DECIMAL(6,2)) AS show_rate_pct,

  -- penetration_pct = qualified_tours / tours_shown * 100
  CAST(
    CASE WHEN a.tours_shown > 0
         THEN ROUND(a.qualified_tours * 100.0 / a.tours_shown, 2)
         ELSE 0.0 END
  AS DECIMAL(6,2)) AS penetration_pct,

  CAST(20.0 AS DECIMAL(6,2)) AS penetration_target_pct,

  -- spiff_active when penetration exceeds target
  (CASE WHEN a.tours_shown > 0
        THEN (a.qualified_tours * 100.0 / a.tours_shown) > 20.0
        ELSE FALSE END) AS spiff_active,

  -- Next tier label based on qualified tour count
  CASE
    WHEN a.qualified_tours < 3  THEN 'Tier 1 — $50 per qualified tour'
    WHEN a.qualified_tours < 6  THEN 'Tier 2 — $75 per qualified tour'
    WHEN a.qualified_tours < 10 THEN 'Tier 3 — $100 per qualified tour'
    ELSE 'Top Tier — max rate achieved'
  END AS next_tier_label,

  -- Gap to next tier
  CAST(
    CASE
      WHEN a.qualified_tours < 3  THEN 3  - a.qualified_tours
      WHEN a.qualified_tours < 6  THEN 6  - a.qualified_tours
      WHEN a.qualified_tours < 10 THEN 10 - a.qualified_tours
      ELSE 0
    END
  AS INT) AS next_tier_gap_tours,

  a.qualified_tour_pay,
  a.courtesy_tour_pay,
  a.penetration_spiff,
  a.chargebacks,

  -- total_payout = all pay less chargebacks
  CAST(a.qualified_tour_pay + a.fps_earn + a.penetration_spiff - a.chargebacks AS DECIMAL(14,2)) AS total_payout,

  CAST(40.0 AS DECIMAL(6,2))  AS base_pct,
  CAST(60.0 AS DECIMAL(6,2))  AS variable_pct,
  CAST(0.0  AS DECIMAL(6,2))  AS tcc_gap_vs_market_pct

FROM agg a;

-- ---------------------------------------------------------------------------
-- Step 8) fact_marketing_rep_metric
-- Exact schema (compSchemaBootstrap line 62-66):
--   rep_id, period_id, metric_name, weight_pct, earnings,
--   attainment_pct, target_label, opportunity_usd
-- Three metrics per rep per period: Qualified Tours, FPS Penetration, Tours Shown
-- ---------------------------------------------------------------------------
CREATE OR REPLACE TABLE edw_dev_hris.hgv_comp.fact_marketing_rep_metric
USING DELTA AS
WITH base AS (
  SELECT
    p.rep_id,
    p.period_id,
    p.qualified_tours,
    p.tours_shown,
    p.penetration_pct,
    p.qualified_tour_pay,
    p.total_payout,
    COALESCE(fps.fps_total, 0.0) AS fps_total
  FROM edw_dev_hris.hgv_comp.fact_marketing_rep_period p
  LEFT JOIN (
    SELECT rep_id, period_id, CAST(SUM(fps_potential) AS DECIMAL(14,2)) AS fps_total
    FROM edw_dev_hris.hgv_comp.fact_marketing_tour_payout
    GROUP BY rep_id, period_id
  ) fps ON fps.rep_id = p.rep_id AND fps.period_id = p.period_id
)
SELECT rep_id, period_id,
  'Qualified Tours (Owner, New Buyer)'      AS metric_name,
  CAST(45 AS DECIMAL(6,2))                  AS weight_pct,
  qualified_tour_pay                         AS earnings,
  CAST(ROUND(qualified_tours * 100.0 / GREATEST(3, 1), 2) AS DECIMAL(6,2)) AS attainment_pct,
  '3 qualified tours target'                AS target_label,
  CAST(CASE WHEN qualified_tours < 3 THEN (3 - qualified_tours) * 50.0 ELSE 0 END AS DECIMAL(14,2)) AS opportunity_usd
FROM base
UNION ALL
SELECT rep_id, period_id,
  'Individual FPS Packages'                 AS metric_name,
  CAST(35 AS DECIMAL(6,2))                  AS weight_pct,
  fps_total                                  AS earnings,
  CAST(penetration_pct AS DECIMAL(6,2))     AS attainment_pct,
  '20% penetration target'                  AS target_label,
  CAST(CASE WHEN penetration_pct < 20.0 AND tours_shown > 0
            THEN (0.20 * tours_shown - qualified_tours) * 250.0
            ELSE 0 END AS DECIMAL(14,2))    AS opportunity_usd
FROM base
UNION ALL
SELECT rep_id, period_id,
  'Tours Shown'                             AS metric_name,
  CAST(20 AS DECIMAL(6,2))                  AS weight_pct,
  CAST(0 AS DECIMAL(14,2))                  AS earnings,
  CAST(ROUND(tours_shown * 100.0 / GREATEST(10, 1), 2) AS DECIMAL(6,2)) AS attainment_pct,
  '10 tours shown target'                   AS target_label,
  CAST(NULL AS DECIMAL(14,2))               AS opportunity_usd
FROM base;

-- ---------------------------------------------------------------------------
-- Step 9) fact_marketing_chargeback (empty — populated by operations)
-- Exact schema (compSchemaBootstrap line 76-79):
--   chargeback_id, rep_id, period_id, guest_name, tour_id,
--   premium_gift, chargeback_amount, notes
-- ---------------------------------------------------------------------------
-- Table already created by 00_CLEAN_AND_REBUILD.sql with the correct schema.
-- No Cognos source for chargebacks — table remains empty, ready for manual entry.

-- ---------------------------------------------------------------------------
-- Step 10) fact_marketing_arrival (empty — populated by operations)
-- Exact schema (compSchemaBootstrap line 81-86):
--   arrival_id, rep_id, period_id, guest_name, guest_type,
--   arrival_datetime, desk, potential_qualified_tour,
--   potential_fps_payout, projected_total_payout
-- ---------------------------------------------------------------------------
-- Table already created by 00_CLEAN_AND_REBUILD.sql with the correct schema.
-- No Cognos source for arrivals — table remains empty, ready for manual entry.

-- =============================================================================
-- END
-- =============================================================================
