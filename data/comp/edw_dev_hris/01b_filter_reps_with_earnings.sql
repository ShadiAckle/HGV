-- =============================================================================
-- Filter dim_marketing_rep to C2a reps with qtd_earnings > 0 (rep dropdown).
-- Run AFTER 01_MATERIALIZE_ALL_TABLES.sql (or when fact_marketing_rep_period exists).
-- No app code change — GET /api/comp/metadata reads dim_marketing_rep.
-- =============================================================================

CREATE OR REPLACE TABLE edw_dev_hris.hgv_comp._tmp_dim_marketing_rep
USING DELTA AS
SELECT * FROM edw_dev_hris.hgv_comp.dim_marketing_rep;

CREATE OR REPLACE TABLE edw_dev_hris.hgv_comp.dim_marketing_rep
USING DELTA AS
SELECT t.*
FROM edw_dev_hris.hgv_comp._tmp_dim_marketing_rep t
WHERE t.level_code IN ('C2b', 'C2c')
   OR t.rep_id IN (
     SELECT DISTINCT rep_id
     FROM edw_dev_hris.hgv_comp.fact_marketing_rep_period
     WHERE COALESCE(qtd_earnings, 0) > 0
   );

DROP TABLE IF EXISTS edw_dev_hris.hgv_comp._tmp_dim_marketing_rep;

CREATE OR REPLACE TABLE edw_dev_hris.hgv_comp.dim_rep
USING DELTA AS
SELECT
  rep_id, rep_name, level_code, team_id,
  CASE
    WHEN level_code = 'C2a' AND team_id NOT IN ('UNASSIGNED', '0', '')
         THEN CONCAT('MGR-', team_id)
    WHEN level_code = 'C2b' AND region IS NOT NULL AND TRIM(region) <> '' AND region <> 'Other'
         THEN CONCAT('DIR-', region)
    ELSE CAST(NULL AS STRING)
  END AS manager_rep_id,
  region, is_active
FROM edw_dev_hris.hgv_comp.dim_marketing_rep;

-- Verify
SELECT level_code, COUNT(*) AS rep_count
FROM edw_dev_hris.hgv_comp.dim_marketing_rep
GROUP BY level_code
ORDER BY level_code;
