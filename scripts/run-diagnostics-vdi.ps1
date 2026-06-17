# PowerShell script to run diagnostic queries on VDI
# Usage: .\scripts\run-diagnostics-vdi.ps1

Write-Host "Running Cognos Schema Diagnostic Queries..." -ForegroundColor Cyan
Write-Host ""

# Create results directory
$resultsDir = "diagnostic-results-vdi"
New-Item -ItemType Directory -Force -Path $resultsDir | Out-Null

# Query 1: Tour Status Distribution
Write-Host "[1/5] Running Tour Status Distribution..." -ForegroundColor Yellow
databricks sql `
  --profile hgv-premium `
  --statement "
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
" > "$resultsDir\query1-tour-status.txt" 2>&1

Write-Host "✓ Query 1 complete" -ForegroundColor Green

# Query 2: Multi-Rep Summary
Write-Host "[2/5] Running Multi-Rep Analysis..." -ForegroundColor Yellow
databricks sql `
  --profile hgv-premium `
  --statement "
SELECT 
  rep_count,
  COUNT(*) AS tour_count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*) ) OVER (), 2) AS pct_of_tours
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
" > "$resultsDir\query2-multi-rep-summary.txt" 2>&1

Write-Host "✓ Query 2 complete" -ForegroundColor Green

# Query 3: Multi-Rep Examples
Write-Host "[3/5] Running Multi-Rep Examples..." -ForegroundColor Yellow
databricks sql `
  --profile hgv-premium `
  --statement "
SELECT 
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
" > "$resultsDir\query3-multi-rep-examples.txt" 2>&1

Write-Host "✓ Query 3 complete" -ForegroundColor Green

# Query 4: Sample Tours
Write-Host "[4/5] Running Sample Tours with Full Context..." -ForegroundColor Yellow
databricks sql `
  --profile hgv-premium `
  --statement "
SELECT 
  m.tour_id,
  TO_DATE(m.tour_booked_date) AS tour_date,
  m.tour_status_desc,
  m.office_region,
  CAST(p.opc_person_1_employee_id AS STRING) AS rep_id,
  p.opc_person_1_name AS rep_name,
  d.qualified AS contract_qualified,
  d.showed AS contract_showed,
  CAST(d.net_volume AS DECIMAL(18,2)) AS net_volume
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
" > "$resultsDir\query4-sample-tours.txt" 2>&1

Write-Host "✓ Query 4 complete" -ForegroundColor Green

# Query 5: Top Reps
Write-Host "[5/5] Running Top Reps Summary..." -ForegroundColor Yellow
databricks sql `
  --profile hgv-premium `
  --statement "
SELECT 
  CAST(p.opc_person_1_employee_id AS STRING) AS rep_id,
  MAX(p.opc_person_1_name) AS rep_name,
  MAX(p.opc_team_code) AS team_code,
  MAX(m.office_region) AS region,
  COUNT(DISTINCT m.tour_id) AS tour_count,
  SUM(CASE WHEN LOWER(m.tour_status_desc) LIKE '%show%' THEN 1 ELSE 0 END) AS show_count,
  SUM(CASE WHEN d.qualified = 1 THEN 1 ELSE 0 END) AS contract_qualified_count
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
" > "$resultsDir\query5-top-reps.txt" 2>&1

Write-Host "✓ Query 5 complete" -ForegroundColor Green
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Diagnostic queries complete!" -ForegroundColor Green
Write-Host "Results saved to: $resultsDir" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Display results
Write-Host "Preview of Query 1 (Tour Status Distribution):" -ForegroundColor Yellow
Get-Content "$resultsDir\query1-tour-status.txt" | Select-Object -First 30

Write-Host ""
Write-Host "Preview of Query 5 (Top Reps):" -ForegroundColor Yellow
Get-Content "$resultsDir\query5-top-reps.txt" | Select-Object -First 30

Write-Host ""
Write-Host "To view full results, check files in: $resultsDir\" -ForegroundColor Cyan
