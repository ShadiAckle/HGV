-- Rep monthly sales and attainment trend (period-scoped)
-- @param rep_id STRING
-- @param period_id STRING
SELECT
  month(credit_date) AS month_num,
  date_format(credit_date, 'MMM') AS month_name,
  SUM(credit_amount) AS monthly_sales,
  SUM(credit_amount) AS monthly_credit
FROM workspace.hgv_comp.fact_deal_credit
WHERE rep_id = :rep_id
  AND period_id = :period_id
GROUP BY 1, 2
ORDER BY month_num;
