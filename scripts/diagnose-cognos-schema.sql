-- Diagnostic Queries for Cognos Marketing Schema
-- Purpose: Understand live 2026 data structure to correct SQL logic
-- Run via: databricks sql execute --file scripts/diagnose-cognos-schema.sql

-- ============================================================================
-- Query 1: Tour Status Distribution
-- ============================================================================
-- Purpose: Identify ALL tour_status_desc values to map to payout tiers
SELECT 
  'QUERY_1_TOUR_STATUS' AS query_label,
  tour_status_desc,
  COUNT(*) AS tour_count,
  COUNT(DISTINCT tour_id) AS unique_tours,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) AS pct_of_total
FROM edw_dev_cognos.cognos_fm.it_smt_marketing
WHERE TO_DATE(tour_booked_date) BETWEEN DATE '2026-04-01' AND DATE '2026-04-30'
GROUP BY tour_status_desc
ORDER BY tour_count DESC
LIMIT 20;

-- ============================================================================
-- Query 2: Personnel Deduplication Analysis
-- ============================================================================
-- Purpose: Understand scale of multi-rep tours
SELECT 
  'QUERY_2_MULTI_REP_SUMMARY' AS query_label,
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
ORDER BY rep_count;

-- ============================================================================
-- Query 3: Sample Multi-Rep Tours (if any)
-- ============================================================================
-- Purpose: See examples of tours with multiple OPC reps
SELECT 
  'QUERY_3_MULTI_REP_EXAMPLES' AS query_label,
  p.tour_key_hash,
  m.tour_id,
  TO_DATE(m.tour_booked_date) AS tour_date,
  p.opc_person_1_employee_id AS rep_id,
  p.opc_person_1_name AS rep_name,
  p.opc_team_code
FROM edw_dev_cognos.cognos_fm.it_smt_personnel p
INNER JOIN edw_dev_cognos.cognos_fm.it_smt_marketing m
  ON m.tour_key_hash = p.tour_key_hash
WHERE p.opc_person_1_employee_id IS NOT NULL
  AND CAST(p.opc_person_1_employee_id AS BIGINT) <> 0
  AND TO_DATE(m.tour_booked_date) BETWEEN DATE '2026-04-01' AND DATE '2026-04-30'
  AND p.tour_key_hash IN (
    SELECT tour_key_hash
    FROM edw_dev_cognos.cognos_fm.it_smt_personnel
    WHERE opc_person_1_employee_id IS NOT NULL
      AND CAST(opc_person_1_employee_id AS BIGINT) <> 0
    GROUP BY tour_key_hash
    HAVING COUNT(*) > 1
    LIMIT 5
  )
ORDER BY p.tour_key_hash, p.opc_person_1_employee_id;

-- ============================================================================
-- Query 4: Sample Tours with Full Context
-- ============================================================================
-- Purpose: See real examples to validate corrected logic
SELECT 
  'QUERY_4_SAMPLE_TOURS' AS query_label,
  m.tour_id,
  TO_DATE(m.tour_booked_date) AS tour_date,
  m.tour_status_desc,
  m.office_region,
  m.channel,
  CAST(p.opc_person_1_employee_id AS STRING) AS rep_id,
  p.opc_person_1_name AS rep_name,
  p.opc_team_code,
  d.qualified AS contract_qualified,
  d.showed AS contract_showed,
  CAST(d.net_volume AS DECIMAL(18,2)) AS net_volume
FROM edw_dev_cognos.cognos_fm.it_smt_marketing m
INNER JOIN edw_dev_cognos.cognos_fm.it_smt_detail d 
  ON d.tour_key_hash = m.tour_key_hash
INNER JOIN (
  -- Dedupe personnel: take first OPC rep per tour
  SELECT 
    tour_key_hash,
    opc_person_1_employee_id,
    opc_person_1_name,
    opc_team_code,
    ROW_NUMBER() OVER (
      PARTITION BY tour_key_hash
      ORDER BY
        CASE
          WHEN opc_person_1_employee_id IS NOT NULL
            AND CAST(opc_person_1_employee_id AS BIGINT) <> 0
          THEN 0
          ELSE 1
        END,
        opc_person_1_employee_id DESC
    ) AS rn
  FROM edw_dev_cognos.cognos_fm.it_smt_personnel
) p ON p.tour_key_hash = m.tour_key_hash AND p.rn = 1
WHERE TO_DATE(m.tour_booked_date) BETWEEN DATE '2026-04-01' AND DATE '2026-04-30'
  AND p.opc_person_1_employee_id IS NOT NULL
  AND CAST(p.opc_person_1_employee_id AS BIGINT) <> 0
ORDER BY m.tour_booked_date, m.tour_id
LIMIT 50;

-- ============================================================================
-- Query 5: Rep Aggregation Summary
-- ============================================================================
-- Purpose: Top 10 reps by tour count to validate volume
SELECT 
  'QUERY_5_TOP_REPS' AS query_label,
  CAST(p.opc_person_1_employee_id AS STRING) AS rep_id,
  MAX(p.opc_person_1_name) AS rep_name,
  MAX(p.opc_team_code) AS team_code,
  MAX(m.office_region) AS region,
  COUNT(DISTINCT m.tour_id) AS tour_count,
  SUM(CASE WHEN m.tour_status_desc LIKE '%Show%' THEN 1 ELSE 0 END) AS show_count,
  SUM(CASE WHEN d.qualified = 1 THEN 1 ELSE 0 END) AS contract_qualified_count,
  AVG(CAST(d.net_volume AS DOUBLE)) AS avg_net_volume
FROM edw_dev_cognos.cognos_fm.it_smt_marketing m
INNER JOIN edw_dev_cognos.cognos_fm.it_smt_detail d 
  ON d.tour_key_hash = m.tour_key_hash
INNER JOIN (
  SELECT 
    tour_key_hash,
    opc_person_1_employee_id,
    opc_person_1_name,
    opc_team_code,
    ROW_NUMBER() OVER (
      PARTITION BY tour_key_hash
      ORDER BY opc_person_1_employee_id DESC
    ) AS rn
  FROM edw_dev_cognos.cognos_fm.it_smt_personnel
  WHERE opc_person_1_employee_id IS NOT NULL
    AND CAST(opc_person_1_employee_id AS BIGINT) <> 0
) p ON p.tour_key_hash = m.tour_key_hash AND p.rn = 1
WHERE TO_DATE(m.tour_booked_date) BETWEEN DATE '2026-04-01' AND DATE '2026-04-30'
GROUP BY p.opc_person_1_employee_id
ORDER BY tour_count DESC
LIMIT 10;
