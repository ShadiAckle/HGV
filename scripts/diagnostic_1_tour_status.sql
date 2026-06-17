-- Diagnostic Query 1: Tour Status Distribution
-- Purpose: Identify ALL tour_status_desc values to map to payout tiers
-- Expected: Most tours should be "Show" or "No Show", check for any unexpected values

SELECT 
  tour_status_desc,
  COUNT(*) AS tour_count,
  COUNT(DISTINCT tour_id) AS unique_tours,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) AS pct_of_total
FROM edw_dev_cognos.cognos_fm.it_smt_marketing
WHERE TO_DATE(tour_booked_date) BETWEEN DATE '2026-04-01' AND DATE '2026-04-30'
GROUP BY tour_status_desc
ORDER BY tour_count DESC
LIMIT 20;
