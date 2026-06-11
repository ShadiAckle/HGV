-- Conversion rate scenario lever (FPS / tour close assumptions)
ALTER TABLE edw_dev_hris.hgv_comp.scenario_run ADD COLUMN conversion_rate_change_pct DECIMAL(6, 2);
UPDATE edw_dev_hris.hgv_comp.scenario_run SET conversion_rate_change_pct = 0.00 WHERE conversion_rate_change_pct IS NULL;
