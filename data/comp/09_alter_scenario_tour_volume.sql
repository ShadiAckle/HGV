-- Tour volume scenario lever column (no DEFAULT — Delta rejects column defaults on this warehouse)
ALTER TABLE workspace.hgv_comp.scenario_run ADD COLUMN tour_volume_change_pct DECIMAL(6, 2);
UPDATE workspace.hgv_comp.scenario_run SET tour_volume_change_pct = 0.00 WHERE tour_volume_change_pct IS NULL;
