-- Rep KPI strip: current earnings + quota attainment (My Compensation Overview)
-- @param rep_id STRING
-- @param period_id STRING
SELECT
  r.rep_id,
  r.rep_name,
  p.period_label,
  pay.total_earnings AS current_earnings,
  pay.total_paid AS paid_to_date,
  qa.attainment_pct AS quota_attainment_pct,
  qa.credited_amount AS credited_amount,
  qa.quota_amount AS quota_amount,
  qa.deals_closed_count AS deals_closed_count,
  qa.next_tier_threshold_pct AS next_tier_threshold_pct,
  qa.next_tier_gap_amount AS next_tier_gap_amount
FROM workspace.hgv_comp.dim_rep r
JOIN workspace.hgv_comp.fact_payout pay
  ON pay.rep_id = r.rep_id
JOIN workspace.hgv_comp.fact_quota_attainment qa
  ON qa.rep_id = r.rep_id
  AND qa.period_id = pay.period_id
JOIN workspace.hgv_comp.dim_period p
  ON p.period_id = pay.period_id
WHERE r.rep_id = :rep_id
  AND pay.period_id = :period_id;
