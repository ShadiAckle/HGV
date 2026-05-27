-- Plan Designer KPI strip: projected cost + expected performance
-- @param scenario_id STRING
SELECT
  s.scenario_id,
  s.scenario_name,
  s.quota_change_pct AS quota_levels_change_pct,
  s.bonus_rate_change_pct AS bonus_rates_change_pct,
  s.accelerator_change_pct AS accelerators_change_pct,
  s.tour_volume_change_pct,
  r.projected_cost,
  r.expected_performance_pct,
  r.projected_payouts,
  r.budget_impact
FROM workspace.hgv_comp.scenario_run s
JOIN workspace.hgv_comp.scenario_result r
  ON r.scenario_id = s.scenario_id
WHERE s.scenario_id = :scenario_id;
