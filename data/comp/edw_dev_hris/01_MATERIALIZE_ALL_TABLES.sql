-- =============================================================================
-- MATERIALIZE ALL TABLES (run AFTER 00_CLEAN_AND_REBUILD.sql)
-- =============================================================================
-- This script creates all tables WITHOUT any DROP statements
-- Run this immediately after 00_CLEAN_AND_REBUILD.sql completes
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Step 1) Staging — marketing spine (2026) + AGGREGATED detail metrics
-- ---------------------------------------------------------------------------
CREATE OR REPLACE TABLE edw_dev_hris.hgv_comp._stg_marketing_tour_detail
USING DELTA
COMMENT 'Tour-grain 2026 slice with PRE-AGGREGATED detail to prevent duplication'
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
    ROW_NUMBER() OVER (PARTITION BY m.tour_key_hash ORDER BY m.tour_booked_date) AS rn
  FROM edw_dev_cognos.cognos_fm.it_smt_marketing m
  WHERE TO_DATE(m.tour_booked_date) BETWEEN DATE '2026-01-01' AND DATE '2026-12-31'
),
tour_detail_agg AS (
  SELECT
    d.tour_key_hash,
    MAX(CAST(d.qualified AS INT)) AS qualified_flag,
    MAX(CAST(d.showed AS INT)) AS showed_flag,
    COUNT(DISTINCT d.transaction_date) AS distinct_txn_dates,
    COUNT(*) AS raw_detail_rows
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
  COALESCE(d.showed_flag, 0) = 1 AS showed_flag,
  COALESCE(d.distinct_txn_dates, 0) AS txn_count,
  COALESCE(d.raw_detail_rows, 0) AS detail_row_count
FROM tours_2026 t
LEFT JOIN tour_detail_agg d ON t.tour_key_hash = d.tour_key_hash
WHERE t.rn = 1;

-- ---------------------------------------------------------------------------
-- Step 2) Enrich with OPC personnel (one rep per tour)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE TABLE edw_dev_hris.hgv_comp._stg_tour_enriched
USING DELTA
COMMENT 'Marketing tours + OPC personnel (ONE rep per tour)'
AS
WITH personnel_one AS (
  SELECT
    p.tour_key_hash,
    p.opc_person_1_employee_id,
    p.opc_person_1_name,
    p.opc_team_code,
    ROW_NUMBER() OVER (
      PARTITION BY p.tour_key_hash
      ORDER BY 
        CASE 
          WHEN p.opc_person_1_employee_id IS NOT NULL 
           AND CAST(p.opc_person_1_employee_id AS BIGINT) <> 0 
          THEN 0 
          ELSE 1 
        END,
        p.opc_person_1_employee_id DESC
    ) AS rn
  FROM edw_dev_cognos.cognos_fm.it_smt_personnel p
  WHERE p.tour_key_hash IN (
    SELECT tour_key_hash FROM edw_dev_hris.hgv_comp._stg_marketing_tour_detail
  )
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
  d.txn_count,
  d.detail_row_count,
  p.opc_person_1_employee_id AS rep_employee_id,
  COALESCE(p.opc_person_1_name, 'UNASSIGNED') AS rep_name,
  p.opc_team_code AS rep_team_code
FROM edw_dev_hris.hgv_comp._stg_marketing_tour_detail d
INNER JOIN personnel_one p
  ON d.tour_key_hash = p.tour_key_hash
  AND p.rn = 1
WHERE p.opc_person_1_employee_id IS NOT NULL
  AND CAST(p.opc_person_1_employee_id AS BIGINT) <> 0;

-- ---------------------------------------------------------------------------
-- Step 3) fact_marketing_tour_payout (CONFIG-DRIVEN PAYOUTS)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE TABLE edw_dev_hris.hgv_comp.fact_marketing_tour_payout
USING DELTA
COMMENT 'Tour-grain payout fact with CONFIGURABLE status-driven payouts'
AS
SELECT
  t.tour_id,
  t.tour_booked_date AS tour_date,
  t.rep_employee_id,
  t.rep_name,
  t.rep_team_code,
  t.office_code,
  t.office_region,
  t.channel,
  t.tour_status_desc,
  t.qualified_flag AS contract_qualified_flag,
  t.txn_count,
  t.detail_row_count,
  COALESCE(cfg.payout_amount, 0.00) AS payout,
  CASE
    WHEN t.qualified_flag = TRUE THEN 250.00
    ELSE 0.00
  END AS fps_potential,
  CURRENT_TIMESTAMP() AS _loaded_at
FROM edw_dev_hris.hgv_comp._stg_tour_enriched t
LEFT JOIN edw_dev_hris.hgv_comp.dim_tour_status_config cfg
  ON COALESCE(t.tour_status_desc, '__NULL__') = COALESCE(cfg.tour_status_desc, '__NULL__')
  AND cfg.is_active = TRUE
  AND CURRENT_DATE() BETWEEN cfg.effective_start_date AND COALESCE(cfg.effective_end_date, DATE '2099-12-31');

-- ---------------------------------------------------------------------------
-- Step 4) dim_marketing_rep (with rep_id alias for app compatibility)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE TABLE edw_dev_hris.hgv_comp.dim_marketing_rep
USING DELTA
COMMENT 'Marketing rep dimension'
AS
SELECT DISTINCT
  rep_employee_id AS rep_id,
  rep_name,
  rep_team_code AS team_id,
  CAST(NULL AS STRING) AS level_code,
  CAST(NULL AS STRING) AS manager_rep_id,
  CAST(NULL AS STRING) AS region,
  TRUE AS is_active,
  CURRENT_TIMESTAMP() AS _loaded_at
FROM edw_dev_hris.hgv_comp.fact_marketing_tour_payout
WHERE rep_employee_id IS NOT NULL
ORDER BY rep_name;

-- ---------------------------------------------------------------------------
-- Step 5) fact_marketing_rep_period (with rep_id/period_id for app compatibility)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE TABLE edw_dev_hris.hgv_comp.fact_marketing_rep_period
USING DELTA
COMMENT 'Rep + period grain rollup'
AS
WITH rep_period AS (
  SELECT
    rep_employee_id,
    rep_name,
    rep_team_code,
    DATE_TRUNC('quarter', tour_date) AS period_start,
    COUNT(DISTINCT tour_id) AS tours,
    COUNT(DISTINCT CASE WHEN payout > 0 THEN tour_id END) AS tours_paid,
    CAST(SUM(payout) AS DECIMAL(18, 2)) AS total_payout,
    CAST(SUM(fps_potential) AS DECIMAL(18, 2)) AS total_fps_potential
  FROM edw_dev_hris.hgv_comp.fact_marketing_tour_payout
  GROUP BY rep_employee_id, rep_name, rep_team_code, DATE_TRUNC('quarter', tour_date)
)
SELECT
  rep_employee_id AS rep_id,
  rep_name,
  rep_team_code AS team_id,
  CONCAT('Q', QUARTER(period_start), '-', YEAR(period_start)) AS period_id,
  period_start AS period_label,
  tours,
  tours_paid,
  CAST(total_payout AS DECIMAL(18, 2)) AS total_payout,
  CAST(total_fps_potential AS DECIMAL(18, 2)) AS total_fps_potential,
  CAST(total_payout + total_fps_potential AS DECIMAL(18, 2)) AS total_earnings,
  CURRENT_TIMESTAMP() AS _loaded_at
FROM rep_period;

-- ---------------------------------------------------------------------------
-- Step 6) dim_period (with period_id for app compatibility)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE TABLE edw_dev_hris.hgv_comp.dim_period
USING DELTA
COMMENT 'Period dimension (quarters)'
AS
SELECT
  period_id,
  period_label,
  YEAR(TO_DATE(period_label)) AS period_year,
  QUARTER(TO_DATE(period_label)) AS period_quarter,
  TO_DATE(period_label) AS period_start,
  CURRENT_TIMESTAMP() AS _loaded_at
FROM (
  SELECT DISTINCT period_id, period_label
  FROM edw_dev_hris.hgv_comp.fact_marketing_rep_period
);

-- ---------------------------------------------------------------------------
-- Step 7) dim_rep (union of marketing + sales, app schema compatible)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE TABLE edw_dev_hris.hgv_comp.dim_rep
USING DELTA
COMMENT 'Unified rep dimension (marketing + sales)'
AS
SELECT
  rep_id,
  rep_name,
  level_code,
  team_id,
  manager_rep_id,
  region,
  is_active,
  _loaded_at
FROM edw_dev_hris.hgv_comp.dim_marketing_rep;

-- ---------------------------------------------------------------------------
-- Step 8) Create convenience views for API (app schema compatible)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW edw_dev_hris.hgv_comp.fact_marketing_rep_metric
AS
SELECT
  r.rep_id,
  r.rep_name,
  r.period_id,
  p.period_label,
  r.tours,
  r.tours_paid,
  r.total_payout,
  r.total_fps_potential,
  r.total_earnings,
  CASE
    WHEN r.tours > 0 THEN CAST(r.total_earnings / r.tours AS DECIMAL(18, 2))
    ELSE 0.00
  END AS avg_earnings_per_tour,
  CASE
    WHEN r.tours > 0 THEN CAST(r.tours_paid * 100.0 / r.tours AS DECIMAL(5, 2))
    ELSE 0.00
  END AS qualified_tour_pct
FROM edw_dev_hris.hgv_comp.fact_marketing_rep_period r
INNER JOIN edw_dev_hris.hgv_comp.dim_period p
  ON r.period_id = p.period_id;

-- =============================================================================
-- END OF MATERIALIZATION
-- =============================================================================
