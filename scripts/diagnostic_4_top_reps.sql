-- Diagnostic Query 4: Top 20 Reps by Tour Count
-- Purpose: Validate rep volume and earnings ranges
-- Expected: Top reps should have 50-200 tours/month, earnings $5K-$20K

SELECT 
  CAST(p.opc_person_1_employee_id AS STRING) AS rep_id,
  MAX(p.opc_person_1_name) AS rep_name,
  MAX(p.opc_team_code) AS team_code,
  COUNT(DISTINCT m.tour_id) AS tour_count,
  
  -- Count tours by status
  SUM(CASE WHEN LOWER(m.tour_status_desc) LIKE '%show%' 
           AND LOWER(m.tour_status_desc) NOT LIKE '%no show%' 
      THEN 1 ELSE 0 END) AS show_count,
  
  SUM(CASE WHEN d.qualified = 1 THEN 1 ELSE 0 END) AS contract_qualified_count,
  
  -- Calculate estimated earnings based on CORRECTED logic
  SUM(
    CASE
      WHEN LOWER(TRIM(m.tour_status_desc)) IN ('show', '2,show', '2, show') THEN 75.00
      WHEN LOWER(TRIM(m.tour_status_desc)) IN ('show - no tour', '4,show - no tour') THEN 20.00
      WHEN LOWER(TRIM(m.tour_status_desc)) IN ('no show', '3,no show', 'cancel', '5,cancel') THEN 0.00
      ELSE 20.00
    END
  ) AS estimated_tour_payouts,
  
  SUM(CASE WHEN d.qualified = 1 THEN 250.00 ELSE 0.00 END) AS estimated_fps_earnings,
  
  SUM(
    CASE
      WHEN LOWER(TRIM(m.tour_status_desc)) IN ('show', '2,show', '2, show') THEN 75.00
      WHEN LOWER(TRIM(m.tour_status_desc)) IN ('show - no tour', '4,show - no tour') THEN 20.00
      WHEN LOWER(TRIM(m.tour_status_desc)) IN ('no show', '3,no show', 'cancel', '5,cancel') THEN 0.00
      ELSE 20.00
    END
    +
    CASE WHEN d.qualified = 1 THEN 250.00 ELSE 0.00 END
  ) AS estimated_total_earnings

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
LIMIT 20;
