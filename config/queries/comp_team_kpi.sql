-- Manager team KPI strip: attainment, top performers, at-risk, FFS mix vs target
-- @param team_id STRING
-- @param period_id STRING
SELECT
  t.team_id,
  t.team_name,
  p.period_label,
  ts.team_attainment_pct,
  ts.top_performer_count,
  ts.at_risk_count,
  ts.ffs_sales_pct,
  ts.ffs_target_pct,
  ROUND(ts.ffs_sales_pct - ts.ffs_target_pct, 2) AS ffs_gap_pct
FROM workspace.hgv_comp.dim_team t
JOIN workspace.hgv_comp.fact_team_snapshot ts
  ON ts.team_id = t.team_id
JOIN workspace.hgv_comp.dim_period p
  ON p.period_id = ts.period_id
WHERE t.team_id = :team_id
  AND ts.period_id = :period_id;
