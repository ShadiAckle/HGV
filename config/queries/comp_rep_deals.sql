-- Rep closed deals / contracts
-- @param rep_id STRING
-- @param period_id STRING
SELECT
  deal_id,
  credit_date AS close_date,
  property_display_name AS description,
  credit_amount AS contract_volume,
  credit_amount AS commission_earned,
  credit_status AS status
FROM workspace.hgv_comp.fact_deal_credit
WHERE rep_id = :rep_id
  AND period_id = :period_id
ORDER BY close_date DESC;
