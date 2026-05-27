-- Rep earnings breakdown card: base, commission, bonus
-- @param rep_id STRING
-- @param period_id STRING
SELECT
  r.rep_name,
  p.period_label,
  pay.base_pay,
  pay.commission,
  pay.bonus,
  pay.total_earnings,
  pay.total_paid
FROM workspace.hgv_comp.dim_rep r
JOIN workspace.hgv_comp.fact_payout pay
  ON pay.rep_id = r.rep_id
JOIN workspace.hgv_comp.dim_period p
  ON p.period_id = pay.period_id
WHERE r.rep_id = :rep_id
  AND pay.period_id = :period_id;
