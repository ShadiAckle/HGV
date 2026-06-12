-- =============================================================================
-- MATERIALIZE marketing core (REQUIRED for interactive speed on VDI)
-- =============================================================================
-- DATA WINDOW: calendar FY2025 + FY2026 only (2025-01-01 .. 2026-12-31)
-- Tuned for VDI: ~5–20 min total vs multi-hour full-history scans.
--
-- Prerequisite: 15_apply_view_performance_governance.sql (or full 12_bootstrap)
-- Re-run safe: CREATE OR REPLACE TABLE overwrites marketing core tables.
-- If a prior run stalled: Interrupt → Pull → re-run this script (or one block at a time).
-- =============================================================================

-- Dependent views + any partial tables from a stalled run
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

-- ---------------------------------------------------------------------------
-- 1) dim_marketing_rep — rep picker (FY2025–FY2026 tours only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE TABLE edw_dev_hris.hgv_comp.dim_marketing_rep
USING DELTA
COMMENT 'Materialized marketing reps (FY2025–FY2026) — refresh via 16_materialize_marketing_core.sql'
AS
WITH recent_detail AS (
  SELECT d.tour_key_hash
  FROM edw_dev_cognos.cognos_fm.it_smt_detail d
  WHERE COALESCE(TO_DATE(d.tour_date), TO_DATE(d.transaction_date))
    BETWEEN DATE '2025-01-01' AND DATE '2026-12-31'
  GROUP BY d.tour_key_hash
)
SELECT
  CAST(p.salesperson_1_employee_id AS STRING) AS rep_id,
  MAX(
    COALESCE(NULLIF(TRIM(p.salesperson_1_name), ''), CAST(p.salesperson_1_employee_id AS STRING))
  ) AS rep_name,
  'MKT' AS level_code,
  MAX(COALESCE(NULLIF(TRIM(p.sales_team_code), ''), 'TEAM-MKT')) AS team_id,
  MAX(COALESCE(NULLIF(TRIM(m.office_region), ''), 'Other')) AS region,
  TRUE AS is_active
FROM edw_dev_cognos.cognos_fm.it_smt_personnel p
INNER JOIN recent_detail rd
  ON rd.tour_key_hash = p.tour_key_hash
LEFT JOIN edw_dev_cognos.cognos_fm.it_smt_marketing m
  ON p.tour_key_hash = m.tour_key_hash
WHERE p.salesperson_1_employee_id IS NOT NULL
GROUP BY CAST(p.salesperson_1_employee_id AS STRING);

-- ---------------------------------------------------------------------------
-- 2) fact_marketing_tour_payout — tour ledger (FY2025–FY2026)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE TABLE edw_dev_hris.hgv_comp.fact_marketing_tour_payout
USING DELTA
COMMENT 'Materialized marketing tour ledger (FY2025–FY2026) — refresh via 16_materialize_marketing_core.sql'
AS
WITH recent_detail AS (
  SELECT
    d.tour_key_hash,
    d.tour_id,
    d.tour_key,
    d.enterprise_lead_id,
    COALESCE(TO_DATE(d.tour_date), TO_DATE(d.transaction_date)) AS tour_date,
    COALESCE(CAST(d.showed AS INT), 0) = 1 AS showed_flag,
    COALESCE(CAST(d.qualified AS INT), 0) = 1 AS qualified_flag,
    CAST(COALESCE(d.net_volume, 0) AS DECIMAL(14, 2)) AS net_volume,
    COALESCE(d.lead_source_desc, 'Unknown') AS lead_source,
    COALESCE(d.lead_prequal_fico_tier, 'U') AS abc_score
  FROM edw_dev_cognos.cognos_fm.it_smt_detail d
  WHERE COALESCE(TO_DATE(d.tour_date), TO_DATE(d.transaction_date))
    BETWEEN DATE '2025-01-01' AND DATE '2026-12-31'
),
tour_spine AS (
  SELECT
    d.tour_id,
    d.tour_key,
    d.enterprise_lead_id,
    d.tour_date,
    d.showed_flag,
    d.qualified_flag,
    d.net_volume,
    d.lead_source,
    d.abc_score,
    m.tour_status_desc,
    m.tour_booked_date,
    m.office_code,
    COALESCE(NULLIF(TRIM(m.office_region), ''), 'Other') AS office_region,
    COALESCE(m.channel, 'Unknown') AS channel,
    COALESCE(m.marketing_program_desc, '') AS marketing_program,
    COALESCE(m.marketing_package_type_desc, 'Unknown') AS package_type,
    p.salesperson_1_employee_id,
    p.salesperson_1_name,
    COALESCE(NULLIF(TRIM(p.sales_team_code), ''), 'TEAM-MKT') AS sales_team_code
  FROM recent_detail d
  LEFT JOIN edw_dev_cognos.cognos_fm.it_smt_marketing m
    ON d.tour_key_hash = m.tour_key_hash
  LEFT JOIN edw_dev_cognos.cognos_fm.it_smt_personnel p
    ON d.tour_key_hash = p.tour_key_hash
  WHERE d.tour_id IS NOT NULL
    AND p.salesperson_1_employee_id IS NOT NULL
    AND d.tour_date IS NOT NULL
)
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
  COALESCE(NULLIF(TRIM(t.office_region), ''), 'Other') AS rep_region,
  COALESCE(NULLIF(TRIM(t.sales_team_code), ''), 'TEAM-MKT') AS rep_team_id
FROM tour_spine t;

-- ---------------------------------------------------------------------------
-- 3) fact_marketing_rep_period — rollup from Delta (not Cognos)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE TABLE edw_dev_hris.hgv_comp.fact_marketing_rep_period
USING DELTA
COMMENT 'Materialized marketing rep-period KPIs (FY2025–FY2026) — refresh via 16_materialize_marketing_core.sql'
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
-- 4) dim_period — FY2025–FY2026 quarters only (max 8)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE TABLE edw_dev_hris.hgv_comp.dim_period
USING DELTA
COMMENT 'Materialized comp periods (FY2025–FY2026) — refresh via 16_materialize_marketing_core.sql'
AS
WITH commission_quarters AS (
  SELECT
    CONCAT(
      CAST(YEAR(TO_DATE(payDate)) AS STRING),
      '-Q',
      CAST(CAST(CEIL(MONTH(TO_DATE(payDate)) / 3.0) AS INT) AS STRING)
    ) AS period_id,
    CONCAT(
      'Q',
      CAST(CAST(CEIL(MONTH(TO_DATE(payDate)) / 3.0) AS INT) AS STRING),
      ' ',
      CAST(YEAR(TO_DATE(payDate)) AS STRING)
    ) AS period_label,
    MAKE_DATE(
      YEAR(TO_DATE(payDate)),
      CAST((CAST(CEIL(MONTH(TO_DATE(payDate)) / 3.0) AS INT) - 1) * 3 + 1 AS INT),
      1
    ) AS period_start,
    LAST_DAY(
      MAKE_DATE(
        YEAR(TO_DATE(payDate)),
        CAST(CAST(CEIL(MONTH(TO_DATE(payDate)) / 3.0) AS INT) * 3 AS INT),
        1
      )
    ) AS period_end
  FROM edw_dev_hris.pwcmodels.commissions
  WHERE payDate IS NOT NULL
    AND TO_DATE(payDate) BETWEEN DATE '2025-01-01' AND DATE '2026-12-31'
  GROUP BY 1, 2, 3, 4
),
tour_quarters AS (
  SELECT
    period_id,
    MAX(period_label) AS period_label,
    MIN(period_start) AS period_start,
    MAX(period_end) AS period_end
  FROM (
    SELECT
      CONCAT(
        CAST(YEAR(tp.arrival_date) AS STRING),
        '-Q',
        CAST(CAST(CEIL(MONTH(tp.arrival_date) / 3.0) AS INT) AS STRING)
      ) AS period_id,
      CONCAT(
        'Q',
        CAST(CAST(CEIL(MONTH(tp.arrival_date) / 3.0) AS INT) AS STRING),
        ' ',
        CAST(YEAR(tp.arrival_date) AS STRING)
      ) AS period_label,
      MAKE_DATE(
        YEAR(tp.arrival_date),
        CAST((CAST(CEIL(MONTH(tp.arrival_date) / 3.0) AS INT) - 1) * 3 + 1 AS INT),
        1
      ) AS period_start,
      LAST_DAY(
        MAKE_DATE(
          YEAR(tp.arrival_date),
          CAST(CAST(CEIL(MONTH(tp.arrival_date) / 3.0) AS INT) * 3 AS INT),
          1
        )
      ) AS period_end
    FROM edw_dev_hris.hgv_comp.fact_marketing_tour_payout tp
    WHERE tp.arrival_date IS NOT NULL
  ) q
  GROUP BY period_id
),
merged AS (
  SELECT period_id, period_label, period_start, period_end FROM commission_quarters
  UNION
  SELECT period_id, period_label, period_start, period_end FROM tour_quarters
),
ranked AS (
  SELECT
    period_id,
    period_label,
    period_start,
    period_end,
    ROW_NUMBER() OVER (ORDER BY period_start DESC) AS rn
  FROM merged
  WHERE period_start BETWEEN DATE '2025-01-01' AND DATE '2026-12-31'
)
SELECT
  period_id,
  period_label,
  period_start,
  period_end,
  (rn = 1) AS is_current
FROM ranked;

-- ---------------------------------------------------------------------------
-- 5) dim_rep — marketing reps + field reps (FY2025–FY2026 commissions)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE TABLE edw_dev_hris.hgv_comp.dim_rep
USING DELTA
COMMENT 'Materialized rep directory (FY2025–FY2026) — refresh via 16_materialize_marketing_core.sql'
AS
SELECT
  rep_id,
  rep_name,
  level_code,
  team_id,
  CAST(NULL AS STRING) AS manager_rep_id,
  region,
  is_active
FROM edw_dev_hris.hgv_comp.dim_marketing_rep

UNION ALL

SELECT
  c.participant AS rep_id,
  MAX(c.participant) AS rep_name,
  MAX(
    CASE
      WHEN LOWER(c.title) LIKE '%manager%' THEN 'L8'
      WHEN LOWER(c.title) LIKE '%train%' THEN 'L5'
      ELSE 'L6'
    END
  ) AS level_code,
  MAX(COALESCE(NULLIF(TRIM(c.businessUnit), ''), 'TEAM-FIELD')) AS team_id,
  CAST(NULL AS STRING) AS manager_rep_id,
  'Field' AS region,
  TRUE AS is_active
FROM edw_dev_hris.pwcmodels.commissions c
WHERE c.participant IS NOT NULL
  AND c.payDate IS NOT NULL
  AND TO_DATE(c.payDate) BETWEEN DATE '2025-01-01' AND DATE '2026-12-31'
  AND c.participant NOT IN (SELECT rep_id FROM edw_dev_hris.hgv_comp.dim_marketing_rep)
GROUP BY c.participant;

-- ---------------------------------------------------------------------------
-- 6) Thin views on materialized tables (chargebacks, metrics, arrivals)
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
-- Smoke (should be seconds after materialization completes):
-- ---------------------------------------------------------------------------
-- SELECT COUNT(*) FROM edw_dev_hris.hgv_comp.dim_marketing_rep;
-- SELECT COUNT(*) FROM edw_dev_hris.hgv_comp.fact_marketing_tour_payout;
-- SELECT table_name, table_type FROM edw_dev_hris.information_schema.tables
--   WHERE table_schema = 'hgv_comp' AND table_name LIKE '%marketing%';
