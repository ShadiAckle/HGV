-- =============================================================================
-- Diagnostic row counts — run on VDI SQL Editor (one query at a time)
-- =============================================================================
-- Purpose: size Cognos/PwC source tables and the script-16 demo window.
-- Run each block separately; full-table COUNT(*) on it_smt_detail may take minutes.
-- Paste results back to Cursor for tuning script 16 if needed.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- A) Full source table sizes
-- -----------------------------------------------------------------------------

-- A1) Cognos tour detail (transaction grain — usually the largest)
SELECT COUNT(*) AS detail_rows
FROM edw_dev_cognos.cognos_fm.it_smt_detail;

-- A2) PwC commissions (field comp)
SELECT COUNT(*) AS commission_rows
FROM edw_dev_hris.pwcmodels.commissions;

-- A3) Cognos personnel (tour keys)
SELECT COUNT(*) AS personnel_rows
FROM edw_dev_cognos.cognos_fm.it_smt_personnel;

-- A4) Cognos marketing (tour keys)
SELECT COUNT(*) AS marketing_rows
FROM edw_dev_cognos.cognos_fm.it_smt_marketing;


-- -----------------------------------------------------------------------------
-- B) Script 16 window — calendar year 2026 (2026-01-01 .. 2026-12-31)
-- -----------------------------------------------------------------------------

-- B1) Transaction rows in 2026 (what staging step 1 must scan)
SELECT COUNT(*) AS txn_rows_2026
FROM edw_dev_cognos.cognos_fm.it_smt_detail d
WHERE d.tour_id IS NOT NULL
  AND (
    (d.tour_date IS NOT NULL
      AND TO_DATE(d.tour_date) BETWEEN DATE '2026-01-01' AND DATE '2026-12-31')
    OR (d.tour_date IS NULL
      AND TO_DATE(d.transaction_date) BETWEEN DATE '2026-01-01' AND DATE '2026-12-31')
  );

-- B2) Tour rows after collapse (target size for _stg_marketing_tour_detail)
SELECT COUNT(*) AS tour_rows_2026
FROM (
  SELECT d.tour_key_hash, d.tour_id
  FROM edw_dev_cognos.cognos_fm.it_smt_detail d
  WHERE d.tour_id IS NOT NULL
    AND (
      (d.tour_date IS NOT NULL
        AND TO_DATE(d.tour_date) BETWEEN DATE '2026-01-01' AND DATE '2026-12-31')
      OR (d.tour_date IS NULL
        AND TO_DATE(d.transaction_date) BETWEEN DATE '2026-01-01' AND DATE '2026-12-31')
    )
  GROUP BY d.tour_key_hash, d.tour_id
) t;

-- B3) Ratio: txn_rows_2026 / tour_rows_2026 = avg transactions per tour


-- -----------------------------------------------------------------------------
-- B4) Marketing-led spine (script 16 step 1 — prefer this path)
--     VDI baseline: txn_rows_2026 ~1,232,974 | tour_keys_2026 ~163,233
-- -----------------------------------------------------------------------------

SELECT COUNT(*) AS marketing_rows_2026
FROM edw_dev_cognos.cognos_fm.it_smt_marketing m
WHERE m.tour_booked_date IS NOT NULL
  AND TO_DATE(m.tour_booked_date) BETWEEN DATE '2026-01-01' AND DATE '2026-12-31';

SELECT COUNT(DISTINCT m.tour_key_hash) AS tour_keys_2026
FROM edw_dev_cognos.cognos_fm.it_smt_marketing m
WHERE m.tour_booked_date IS NOT NULL
  AND TO_DATE(m.tour_booked_date) BETWEEN DATE '2026-01-01' AND DATE '2026-12-31';


-- -----------------------------------------------------------------------------
-- C) Narrower window — 2026-Q2 only (fallback if B1 is still huge)
-- -----------------------------------------------------------------------------

SELECT COUNT(*) AS txn_rows_2026_q2
FROM edw_dev_cognos.cognos_fm.it_smt_detail d
WHERE d.tour_id IS NOT NULL
  AND (
    (d.tour_date IS NOT NULL
      AND TO_DATE(d.tour_date) BETWEEN DATE '2026-04-01' AND DATE '2026-06-30')
    OR (d.tour_date IS NULL
      AND TO_DATE(d.transaction_date) BETWEEN DATE '2026-04-01' AND DATE '2026-06-30')
  );


-- -----------------------------------------------------------------------------
-- D) After script 16 — materialization smoke tests (should be seconds)
-- -----------------------------------------------------------------------------

-- D1) Table vs view check
SELECT table_name, table_type
FROM edw_dev_hris.information_schema.tables
WHERE table_schema = 'hgv_comp'
  AND table_name IN (
    '_stg_marketing_tour_detail',
    '_stg_tour_enriched',
    'dim_marketing_rep',
    'fact_marketing_tour_payout',
    'fact_marketing_rep_period',
    'dim_period',
    'dim_rep'
  )
ORDER BY table_name;

-- D2) Row counts on materialized objects
SELECT 'dim_marketing_rep' AS obj, COUNT(*) AS rows
FROM edw_dev_hris.hgv_comp.dim_marketing_rep
UNION ALL
SELECT '_stg_marketing_tour_detail', COUNT(*)
FROM edw_dev_hris.hgv_comp._stg_marketing_tour_detail
UNION ALL
SELECT '_stg_tour_enriched', COUNT(*)
FROM edw_dev_hris.hgv_comp._stg_tour_enriched
UNION ALL
SELECT 'fact_marketing_tour_payout', COUNT(*)
FROM edw_dev_hris.hgv_comp.fact_marketing_tour_payout
UNION ALL
SELECT 'fact_marketing_rep_period', COUNT(*)
FROM edw_dev_hris.hgv_comp.fact_marketing_rep_period
UNION ALL
SELECT 'dim_period', COUNT(*)
FROM edw_dev_hris.hgv_comp.dim_period
UNION ALL
SELECT 'dim_rep', COUNT(*)
FROM edw_dev_hris.hgv_comp.dim_rep;

-- D3) Period picker data
SELECT period_id, period_label, period_start, period_end, is_current
FROM edw_dev_hris.hgv_comp.dim_period
ORDER BY period_start;

-- D4) Sample marketing reps (rep picker)
SELECT rep_id, rep_name, region, team_id
FROM edw_dev_hris.hgv_comp.dim_marketing_rep
ORDER BY rep_name
LIMIT 10;

-- D5) Sample rep-period KPIs
SELECT rep_id, period_id, qualified_tours, total_payout
FROM edw_dev_hris.hgv_comp.fact_marketing_rep_period
ORDER BY total_payout DESC
LIMIT 10;
