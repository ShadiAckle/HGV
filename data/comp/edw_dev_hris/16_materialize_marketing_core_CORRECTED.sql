-- =============================================================================
-- MATERIALIZE marketing core (CORRECTED VERSION - Based on CSV Schema Analysis)
-- =============================================================================
-- DATA WINDOW: calendar year 2026 only (2026-01-01 .. 2026-12-31)
--
-- CORRECTIONS APPLIED:
--   ✓ Tour qualification based on `tour_status_desc` (not detail.qualified)
--   ✓ Payout logic: $75 for "Show", $20 for "Show - No tour", $0 for no-show/cancel
--   ✓ FPS based on detail.qualified = 1 (contract qualified, not tour attendance)
--   ✓ Rep attribution via opc_person_1_* (already correct)
--   ✓ Handles multi-rep tours by taking first opc rep (ROW_NUMBER = 1)
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
    ROW_NUMBER() OVER (PARTITION BY m.tour_key_hash ORDER BY m.tour_booked_date) AS rn
  FROM edw_dev_cognos.cognos_fm.it_smt_marketing m
  WHERE TO_DATE(m.tour_booked_date) BETWEEN DATE '2026-01-01' AND DATE '2026-12-31'
),
tour_detail_agg AS (
  SELECT
    d.tour_key_hash,
    SUM(CAST(d.qualified AS INT)) AS qualified_count,
    SUM(CAST(d.showed AS INT)) AS showed_count,
    COUNT(*) AS txn_count
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
  COALESCE(d.qualified_count, 0) > 0 AS qualified_flag,
  COALESCE(d.showed_count, 0) > 0 AS showed_flag,
  COALESCE(d.txn_count, 0) AS txn_count
FROM tours_2026 t
LEFT JOIN tour_detail_agg d ON t.tour_key_hash = d.tour_key_hash
WHERE t.rn = 1;

-- ---------------------------------------------------------------------------
-- Step 2) Enrich with OPC personnel (one rep per tour)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE TABLE edw_dev_hris.hgv_comp._stg_tour_enriched
USING DELTA
COMMENT 'Marketing tours + OPC personnel (one rep per tour via ROW_NUMBER)'
AS
WITH personnel_one AS (
  SELECT
    p.tour_key_hash,
    p.opc_person_1_employee_id,
    p.opc_person_1_name,
    p.opc_team_code,
    ROW_NUMBER() OVER (
      PARTITION BY p.tour_key_hash
      ORDER BY CASE WHEN p.opc_person_1_employee_id IS NOT NULL THEN 0 ELSE 1 END,
               p.opc_person_1_employee_id
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
  p.opc_person_1_employee_id AS rep_employee_id,
  COALESCE(p.opc_person_1_name, 'UNASSIGNED') AS rep_name,
  p.opc_team_code AS rep_team_code
FROM edw_dev_hris.hgv_comp._stg_marketing_tour_detail d
INNER JOIN personnel_one p
  ON d.tour_key_hash = p.tour_key_hash
  AND p.rn = 1
WHERE p.opc_person_1_employee_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Step 3) fact_marketing_tour_payout (CORRECTED PAYOUT LOGIC)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE TABLE edw_dev_hris.hgv_comp.fact_marketing_tour_payout
USING DELTA
COMMENT 'Tour-grain payout fact (Delta → Delta, fast). CORRECTED: Uses tour_status_desc for payout tier'
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
  t.qualified_flag AS contract_qualified_flag,  -- THIS IS CONTRACT QUALIFIED, not tour attendance
  t.txn_count,
  
  -- **CORRECTED PAYOUT LOGIC**: Based on tour_status_desc
  CASE
    -- Qualified tour (guest attended and completed presentation)
    WHEN LOWER(TRIM(t.tour_status_desc)) IN ('show', '2,show', '2, show') THEN 75.00
    
    -- Courtesy tour (guest showed but no full presentation)
    WHEN LOWER(TRIM(t.tour_status_desc)) IN ('show - no tour', '4,show - no tour', '4, show - no tour') THEN 20.00
    
    -- No show or cancel (no payout)
    WHEN LOWER(TRIM(t.tour_status_desc)) IN ('no show', '3,no show', '3, no show', 'cancel', '5,cancel', '5, cancel') THEN 0.00
    
    -- Default: courtesy payout for any other status
    ELSE 20.00
  END AS payout,
  
  -- **FPS POTENTIAL**: Based on contract qualified flag (detail.qualified = 1)
  -- This is separate from tour attendance - it's whether the guest BOUGHT
  CASE
    WHEN t.qualified_flag = TRUE THEN 250.00  -- Full FPS if contract qualified
    ELSE 0.00
  END AS fps_potential,
  
  CURRENT_TIMESTAMP() AS _loaded_at
FROM edw_dev_hris.hgv_comp._stg_tour_enriched t;

-- ---------------------------------------------------------------------------
-- Step 4) dim_marketing_rep (from payout only, no Cognos join)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE TABLE edw_dev_hris.hgv_comp.dim_marketing_rep
USING DELTA
COMMENT 'Marketing rep dimension (derived from tour payouts)'
AS
SELECT DISTINCT
  rep_employee_id,
  rep_name,
  rep_team_code,
  CURRENT_TIMESTAMP() AS _loaded_at
FROM edw_dev_hris.hgv_comp.fact_marketing_tour_payout
WHERE rep_employee_id IS NOT NULL
ORDER BY rep_name;

-- ---------------------------------------------------------------------------
-- Step 5) fact_marketing_rep_period (period rollup with EXPLICIT decimal casting)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE TABLE edw_dev_hris.hgv_comp.fact_marketing_rep_period
USING DELTA
COMMENT 'Rep + period grain rollup (no more overflow)'
AS
WITH rep_period AS (
  SELECT
    rep_employee_id,
    rep_name,
    rep_team_code,
    DATE_TRUNC('quarter', tour_date) AS period_start,
    COUNT(*) AS tours,
    SUM(CASE WHEN payout > 0 THEN 1 ELSE 0 END) AS tours_paid,
    CAST(SUM(payout) AS DECIMAL(18, 2)) AS total_payout,
    CAST(SUM(fps_potential) AS DECIMAL(18, 2)) AS total_fps_potential
  FROM edw_dev_hris.hgv_comp.fact_marketing_tour_payout
  GROUP BY rep_employee_id, rep_name, rep_team_code, DATE_TRUNC('quarter', tour_date)
)
SELECT
  rep_employee_id,
  rep_name,
  rep_team_code,
  period_start,
  tours,
  tours_paid,
  CAST(total_payout AS DECIMAL(18, 2)) AS total_payout,
  CAST(total_fps_potential AS DECIMAL(18, 2)) AS total_fps_potential,
  CAST(total_payout + total_fps_potential AS DECIMAL(18, 2)) AS total_earnings,
  CURRENT_TIMESTAMP() AS _loaded_at
FROM rep_period;

-- ---------------------------------------------------------------------------
-- Step 6) dim_period (standard period dimension)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE TABLE edw_dev_hris.hgv_comp.dim_period
USING DELTA
COMMENT 'Period dimension (quarters for 2026)'
AS
SELECT
  period_start,
  YEAR(period_start) AS period_year,
  QUARTER(period_start) AS period_quarter,
  CONCAT('Q', QUARTER(period_start), ' ', YEAR(period_start)) AS period_label,
  CURRENT_TIMESTAMP() AS _loaded_at
FROM (
  SELECT DISTINCT period_start
  FROM edw_dev_hris.hgv_comp.fact_marketing_rep_period
);

-- ---------------------------------------------------------------------------
-- Step 7) dim_rep (union of marketing + sales reps)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE TABLE edw_dev_hris.hgv_comp.dim_rep
USING DELTA
COMMENT 'Unified rep dimension (marketing + sales)'
AS
SELECT
  rep_employee_id AS employee_id,
  rep_name AS name,
  'Marketing' AS role,
  rep_team_code AS team_code,
  _loaded_at
FROM edw_dev_hris.hgv_comp.dim_marketing_rep;

-- ---------------------------------------------------------------------------
-- Step 8) Create convenience views for API
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW edw_dev_hris.hgv_comp.fact_marketing_rep_metric
AS
SELECT
  r.rep_employee_id,
  r.rep_name,
  r.period_start,
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
  ON r.period_start = p.period_start;

-- ---------------------------------------------------------------------------
-- VALIDATION QUERIES (run separately to check results)
-- ---------------------------------------------------------------------------

-- Query 1: Check tour status distribution
-- SELECT tour_status_desc, COUNT(*) AS tours, SUM(payout) AS total_payout
-- FROM edw_dev_hris.hgv_comp.fact_marketing_tour_payout
-- GROUP BY tour_status_desc
-- ORDER BY tours DESC;

-- Query 2: Check top reps
-- SELECT rep_name, rep_employee_id, SUM(total_earnings) AS earnings, SUM(tours) AS tours
-- FROM edw_dev_hris.hgv_comp.fact_marketing_rep_period
-- GROUP BY rep_name, rep_employee_id
-- ORDER BY earnings DESC
-- LIMIT 20;

-- Query 3: Check multi-rep handling (should be NO duplicates in payout fact)
-- SELECT tour_id, COUNT(*) AS rep_count
-- FROM edw_dev_hris.hgv_comp.fact_marketing_tour_payout
-- GROUP BY tour_id
-- HAVING COUNT(*) > 1;

-- Query 4: Check FPS logic (contract qualified tours)
-- SELECT contract_qualified_flag, COUNT(*) AS tours, SUM(fps_potential) AS total_fps
-- FROM edw_dev_hris.hgv_comp.fact_marketing_tour_payout
-- GROUP BY contract_qualified_flag;

-- =============================================================================
-- END OF CORRECTED SQL
-- =============================================================================
