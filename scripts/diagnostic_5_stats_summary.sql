-- Diagnostic Query 5: Overall Statistics Summary
-- Purpose: High-level metrics to validate data completeness

SELECT
  'Total Tours (Apr 2026)' AS metric,
  CAST(COUNT(DISTINCT tour_id) AS STRING) AS value
FROM edw_dev_cognos.cognos_fm.it_smt_marketing
WHERE TO_DATE(tour_booked_date) BETWEEN DATE '2026-04-01' AND DATE '2026-04-30'

UNION ALL

SELECT
  'Tours with OPC Rep',
  CAST(COUNT(DISTINCT m.tour_id) AS STRING)
FROM edw_dev_cognos.cognos_fm.it_smt_marketing m
INNER JOIN edw_dev_cognos.cognos_fm.it_smt_personnel p
  ON m.tour_key_hash = p.tour_key_hash
WHERE TO_DATE(m.tour_booked_date) BETWEEN DATE '2026-04-01' AND DATE '2026-04-30'
  AND p.opc_person_1_employee_id IS NOT NULL
  AND CAST(p.opc_person_1_employee_id AS BIGINT) <> 0

UNION ALL

SELECT
  'Unique OPC Reps',
  CAST(COUNT(DISTINCT p.opc_person_1_employee_id) AS STRING)
FROM edw_dev_cognos.cognos_fm.it_smt_personnel p
INNER JOIN edw_dev_cognos.cognos_fm.it_smt_marketing m
  ON m.tour_key_hash = p.tour_key_hash
WHERE TO_DATE(m.tour_booked_date) BETWEEN DATE '2026-04-01' AND DATE '2026-04-30'
  AND p.opc_person_1_employee_id IS NOT NULL
  AND CAST(p.opc_person_1_employee_id AS BIGINT) <> 0

UNION ALL

SELECT
  'Tours with Multiple Reps',
  CAST(COUNT(*) AS STRING)
FROM (
  SELECT tour_key_hash
  FROM edw_dev_cognos.cognos_fm.it_smt_personnel
  WHERE opc_person_1_employee_id IS NOT NULL
    AND CAST(opc_person_1_employee_id AS BIGINT) <> 0
  GROUP BY tour_key_hash
  HAVING COUNT(*) > 1
)

UNION ALL

SELECT
  'Contract Qualified Tours',
  CAST(SUM(CASE WHEN d.qualified = 1 THEN 1 ELSE 0 END) AS STRING)
FROM edw_dev_cognos.cognos_fm.it_smt_detail d
INNER JOIN edw_dev_cognos.cognos_fm.it_smt_marketing m
  ON m.tour_key_hash = d.tour_key_hash
WHERE TO_DATE(m.tour_booked_date) BETWEEN DATE '2026-04-01' AND DATE '2026-04-30';
