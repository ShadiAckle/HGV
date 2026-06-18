-- =============================================================================
-- REBUILD REP HIERARCHY ONLY  (fast — reuses existing _stg_tour_enriched)
--
-- Run this when the rep dropdown shows only reps and no managers/directors.
-- It rebuilds dim_marketing_rep (C2a reps + C2b managers + C2c directors) and
-- dim_rep (with manager_rep_id reporting lines), then prints the result counts.
--
-- Prereq: _stg_tour_enriched already exists (it does if reps show in the app).
-- Does NOT rescan Cognos source — safe to run anytime.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- dim_marketing_rep  (rep picker + management hierarchy)
--   C2a = Marketing Representative | C2b = Manager (per OPC team) | C2c = Director (per region)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE TABLE edw_dev_hris.hgv_comp.dim_marketing_rep
USING DELTA AS
WITH rep_team AS (
  SELECT
    rep_id,
    COALESCE(NULLIF(team_id, ''), 'UNASSIGNED') AS team_id,
    COALESCE(NULLIF(TRIM(office_region), ''), 'Other') AS region,
    ROW_NUMBER() OVER (
      PARTITION BY rep_id
      ORDER BY COUNT(*) DESC, COALESCE(NULLIF(team_id, ''), 'UNASSIGNED')
    ) AS rn
  FROM edw_dev_hris.hgv_comp._stg_tour_enriched
  WHERE rep_id IS NOT NULL
  GROUP BY rep_id, COALESCE(NULLIF(team_id, ''), 'UNASSIGNED'),
           COALESCE(NULLIF(TRIM(office_region), ''), 'Other')
),
rep_names AS (
  SELECT rep_id, MAX(rep_name) AS rep_name
  FROM edw_dev_hris.hgv_comp._stg_tour_enriched
  WHERE rep_id IS NOT NULL
  GROUP BY rep_id
),
reps AS (
  SELECT rt.rep_id, rn.rep_name, 'C2a' AS level_code, rt.team_id, rt.region, TRUE AS is_active
  FROM rep_team rt
  JOIN rep_names rn ON rn.rep_id = rt.rep_id
  WHERE rt.rn = 1
),
team_lookup AS (
  SELECT CAST(opc_team_code AS STRING) AS team_id, MAX(opc_team_description) AS team_desc
  FROM edw_dev_cognos.cognos_fm.it_smt_personnel
  WHERE opc_team_code IS NOT NULL
  GROUP BY CAST(opc_team_code AS STRING)
),
teams_with_reps AS (
  SELECT team_id, MAX(region) AS region
  FROM reps
  WHERE team_id NOT IN ('UNASSIGNED', '0', '')
  GROUP BY team_id
),
managers AS (
  SELECT
    CONCAT('MGR-', t.team_id) AS rep_id,
    CONCAT('Manager — ', COALESCE(NULLIF(TRIM(tl.team_desc), ''), CONCAT('Team ', t.team_id))) AS rep_name,
    'C2b' AS level_code,
    t.team_id,
    t.region,
    (COALESCE(tl.team_desc, '') NOT LIKE '[DNU]%') AS is_active
  FROM teams_with_reps t
  LEFT JOIN team_lookup tl ON tl.team_id = t.team_id
),
regions AS (
  SELECT DISTINCT region FROM reps
  WHERE region IS NOT NULL AND TRIM(region) <> '' AND region <> 'Other'
),
directors AS (
  SELECT
    CONCAT('DIR-', region) AS rep_id,
    CONCAT('Director — ', region) AS rep_name,
    'C2c' AS level_code,
    CONCAT('REGION-', region) AS team_id,
    region,
    TRUE AS is_active
  FROM regions
)
SELECT rep_id, rep_name, level_code, team_id, region, is_active FROM reps
UNION ALL
SELECT rep_id, rep_name, level_code, team_id, region, is_active FROM managers
UNION ALL
SELECT rep_id, rep_name, level_code, team_id, region, is_active FROM directors;

-- ---------------------------------------------------------------------------
-- dim_rep  (unified rep dimension + manager_rep_id reporting lines)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- VERIFY (read the output of these)
-- ---------------------------------------------------------------------------
-- Expect three rows: C2a, C2b, C2c
SELECT level_code, COUNT(*) AS rows
FROM edw_dev_hris.hgv_comp.dim_marketing_rep
GROUP BY level_code ORDER BY level_code;

-- Should be > 0; this is what managers are built from
SELECT COUNT(DISTINCT team_id) AS buildable_teams
FROM edw_dev_hris.hgv_comp.dim_marketing_rep
WHERE level_code = 'C2a' AND team_id NOT IN ('UNASSIGNED', '0', '');

-- Peek at the managers/directors now present
SELECT rep_id, rep_name, level_code, team_id, region, is_active
FROM edw_dev_hris.hgv_comp.dim_marketing_rep
WHERE level_code IN ('C2b', 'C2c')
ORDER BY level_code, rep_name
LIMIT 30;
