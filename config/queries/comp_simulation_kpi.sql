-- Compensation Analysis Agent KPI strip: lever inputs + budget impact
-- @param scenario_id STRING
SELECT
  s.scenario_id,
  s.scenario_name,
  p.period_label,
  s.quota_change_pct,
  s.commission_rate_pct,
  s.bonus_rate_change_pct,
  s.accelerator_change_pct,
  s.tour_volume_change_pct,
  r.projected_payouts,
  r.budget_impact,
  r.expected_performance_pct
FROM workspace.hgv_comp.scenario_run s
JOIN workspace.hgv_comp.scenario_result r
  ON r.scenario_id = s.scenario_id
JOIN workspace.hgv_comp.dim_period p
  ON p.period_id = s.period_id
WHERE s.scenario_id = :scenario_id;
