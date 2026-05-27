-- Conversion rate scenario lever (FPS / tour close assumptions)
ALTER TABLE workspace.hgv_comp.scenario_run ADD COLUMN conversion_rate_change_pct DECIMAL(6, 2);
UPDATE workspace.hgv_comp.scenario_run SET conversion_rate_change_pct = 0.00 WHERE conversion_rate_change_pct IS NULL;
