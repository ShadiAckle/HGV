-- Idempotent core dimension seed — periods and teams required for metadata / period picker.
-- Safe to re-run; does not delete fact tables.

INSERT INTO edw_dev_hris.hgv_comp.dim_period
SELECT '2026-Q2', 'Q2 2026', DATE '2026-04-01', DATE '2026-06-30', TRUE
WHERE NOT EXISTS (SELECT 1 FROM edw_dev_hris.hgv_comp.dim_period WHERE period_id = '2026-Q2');

INSERT INTO edw_dev_hris.hgv_comp.dim_period
SELECT '2025-Q4', 'Q4 2025', DATE '2025-10-01', DATE '2025-12-31', FALSE
WHERE NOT EXISTS (SELECT 1 FROM edw_dev_hris.hgv_comp.dim_period WHERE period_id = '2025-Q4');

UPDATE edw_dev_hris.hgv_comp.dim_period SET is_current = FALSE;
UPDATE edw_dev_hris.hgv_comp.dim_period SET is_current = TRUE WHERE period_id = '2026-Q2';

INSERT INTO edw_dev_hris.hgv_comp.dim_team
SELECT 'TEAM-WEST', 'West Coast Sales', 'West'
WHERE NOT EXISTS (SELECT 1 FROM edw_dev_hris.hgv_comp.dim_team WHERE team_id = 'TEAM-WEST');

INSERT INTO edw_dev_hris.hgv_comp.dim_team
SELECT 'TEAM-EAST', 'East Coast Sales', 'East'
WHERE NOT EXISTS (SELECT 1 FROM edw_dev_hris.hgv_comp.dim_team WHERE team_id = 'TEAM-EAST');

INSERT INTO edw_dev_hris.hgv_comp.dim_team
SELECT 'TEAM-MKT-LAS', 'Las Vegas Marketing', 'West'
WHERE NOT EXISTS (SELECT 1 FROM edw_dev_hris.hgv_comp.dim_team WHERE team_id = 'TEAM-MKT-LAS');

INSERT INTO edw_dev_hris.hgv_comp.dim_team
SELECT 'TEAM-MKT-REG', 'Regional Marketing', 'West'
WHERE NOT EXISTS (SELECT 1 FROM edw_dev_hris.hgv_comp.dim_team WHERE team_id = 'TEAM-MKT-REG');
