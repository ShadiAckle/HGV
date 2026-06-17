-- Diagnostic Query 2: Multi-Rep Tour Analysis
-- Purpose: Understand how many tours have multiple OPC reps
-- Expected: Most tours should have 1 rep, some may have 2+

SELECT 
  rep_count,
  COUNT(*) AS tour_count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) AS pct_of_tours
FROM (
  SELECT 
    tour_key_hash,
    COUNT(*) AS rep_count
  FROM edw_dev_cognos.cognos_fm.it_smt_personnel
  WHERE opc_person_1_employee_id IS NOT NULL
    AND CAST(opc_person_1_employee_id AS BIGINT) <> 0
  GROUP BY tour_key_hash
) tour_rep_counts
GROUP BY rep_count
ORDER BY rep_count
LIMIT 10;
