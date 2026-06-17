-- Diagnostic Query 3: Sample Tours with Full Context
-- Purpose: See real examples to validate corrected logic
-- Shows: tour_status_desc, rep info, contract_qualified flag

SELECT 
  m.tour_id,
  TO_DATE(m.tour_booked_date) AS tour_date,
  m.tour_status_desc,
  m.office_region,
  CAST(p.opc_person_1_employee_id AS STRING) AS rep_id,
  p.opc_person_1_name AS rep_name,
  d.qualified AS contract_qualified,
  d.showed AS contract_showed,
  
  -- Show what the CORRECTED SQL would calculate
  CASE
    WHEN LOWER(TRIM(m.tour_status_desc)) IN ('show', '2,show', '2, show') THEN 75.00
    WHEN LOWER(TRIM(m.tour_status_desc)) IN ('show - no tour', '4,show - no tour', '4, show - no tour') THEN 20.00
    WHEN LOWER(TRIM(m.tour_status_desc)) IN ('no show', '3,no show', '3, no show', 'cancel', '5,cancel', '5, cancel') THEN 0.00
    ELSE 20.00
  END AS calculated_payout,
  
  CASE WHEN d.qualified = 1 THEN 250.00 ELSE 0.00 END AS calculated_fps
  
FROM edw_dev_cognos.cognos_fm.it_smt_marketing m
INNER JOIN edw_dev_cognos.cognos_fm.it_smt_detail d 
  ON d.tour_key_hash = m.tour_key_hash
INNER JOIN (
  SELECT 
    tour_key_hash,
    opc_person_1_employee_id,
    opc_person_1_name,
    ROW_NUMBER() OVER (
      PARTITION BY tour_key_hash
      ORDER BY
        CASE WHEN opc_person_1_employee_id IS NOT NULL 
             AND CAST(opc_person_1_employee_id AS BIGINT) <> 0
        THEN 0 ELSE 1 END,
        opc_person_1_employee_id DESC
    ) AS rn
  FROM edw_dev_cognos.cognos_fm.it_smt_personnel
) p ON p.tour_key_hash = m.tour_key_hash AND p.rn = 1
WHERE TO_DATE(m.tour_booked_date) BETWEEN DATE '2026-04-01' AND DATE '2026-04-30'
  AND p.opc_person_1_employee_id IS NOT NULL
  AND CAST(p.opc_person_1_employee_id AS BIGINT) <> 0
ORDER BY m.tour_booked_date, m.tour_id
LIMIT 50;
