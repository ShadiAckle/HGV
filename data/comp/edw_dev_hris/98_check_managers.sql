-- =============================================================================
-- QUICK CHECK: are manager/director rows actually in dim_marketing_rep?
-- Run all 3. Paste results back.
-- =============================================================================

-- 1) Row counts by level. EXPECT C2a (reps) + C2b (managers) + C2c (directors).
--    If you ONLY see C2a  ->  Step 5/6 of 01_MATERIALIZE was NOT re-run (re-run it).
SELECT level_code, COUNT(*) AS rows
FROM edw_dev_hris.hgv_comp.dim_marketing_rep
GROUP BY level_code
ORDER BY level_code;

-- 2) Are there valid teams to build managers from? (should be > 0)
SELECT COUNT(DISTINCT team_id) AS buildable_teams
FROM edw_dev_hris.hgv_comp.dim_marketing_rep
WHERE level_code = 'C2a' AND team_id NOT IN ('UNASSIGNED', '0', '');

-- 3) Show any manager / director rows that exist.
SELECT rep_id, rep_name, level_code, team_id, region, is_active
FROM edw_dev_hris.hgv_comp.dim_marketing_rep
WHERE level_code IN ('C2b', 'C2c')
ORDER BY level_code, rep_name
LIMIT 30;
