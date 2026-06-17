# Simple diagnostic runner for VDI (uses existing databricks auth)
# Usage: .\scripts\run-diagnostics-simple.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Cognos Schema Diagnostic Queries" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Create results directory
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$resultsDir = "diagnostic-results-$timestamp"
New-Item -ItemType Directory -Force -Path $resultsDir | Out-Null

Write-Host "Results will be saved to: $resultsDir" -ForegroundColor Yellow
Write-Host ""

# Query 1: Tour Status Distribution
Write-Host "[1/5] Tour Status Distribution..." -ForegroundColor Yellow
$query1 = @"
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
"@

databricks sql --profile hgv-premium --statement $query1 2>&1 | Tee-Object -FilePath "$resultsDir\query1-tour-status.txt"
Write-Host "  ✓ Complete" -ForegroundColor Green
Write-Host ""

# Query 2: Multi-Rep Summary
Write-Host "[2/5] Multi-Rep Tour Analysis..." -ForegroundColor Yellow
$query2 = @"
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
"@

databricks sql --profile hgv-premium --statement $query2 2>&1 | Tee-Object -FilePath "$resultsDir\query2-multi-rep.txt"
Write-Host "  ✓ Complete" -ForegroundColor Green
Write-Host ""

# Query 3: Sample Tours with Full Context
Write-Host "[3/5] Sample Tours (first 30)..." -ForegroundColor Yellow
$query3 = @"
SELECT 
  m.tour_id,
  TO_DATE(m.tour_booked_date) AS tour_date,
  m.tour_status_desc,
  m.office_region,
  CAST(p.opc_person_1_employee_id AS STRING) AS rep_id,
  p.opc_person_1_name AS rep_name,
  d.qualified AS contract_qualified,
  d.showed AS contract_showed
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
LIMIT 30;
"@

databricks sql --profile hgv-premium --statement $query3 2>&1 | Tee-Object -FilePath "$resultsDir\query3-sample-tours.txt"
Write-Host "  ✓ Complete" -ForegroundColor Green
Write-Host ""

# Query 4: Top 20 Reps by Tour Count
Write-Host "[4/5] Top 20 Reps by Volume..." -ForegroundColor Yellow
$query4 = @"
SELECT 
  CAST(p.opc_person_1_employee_id AS STRING) AS rep_id,
  MAX(p.opc_person_1_name) AS rep_name,
  MAX(p.opc_team_code) AS team_code,
  COUNT(DISTINCT m.tour_id) AS tour_count,
  SUM(CASE WHEN LOWER(m.tour_status_desc) LIKE '%show%' AND LOWER(m.tour_status_desc) NOT LIKE '%no show%' THEN 1 ELSE 0 END) AS show_count,
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
LIMIT 20;
"@

databricks sql --profile hgv-premium --statement $query4 2>&1 | Tee-Object -FilePath "$resultsDir\query4-top-reps.txt"
Write-Host "  ✓ Complete" -ForegroundColor Green
Write-Host ""

# Query 5: Quick Stats Summary
Write-Host "[5/5] Overall Statistics..." -ForegroundColor Yellow
$query5 = @"
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
  AND CAST(p.opc_person_1_employee_id AS BIGINT) <> 0;
"@

databricks sql --profile hgv-premium --statement $query5 2>&1 | Tee-Object -FilePath "$resultsDir\query5-stats-summary.txt"
Write-Host "  ✓ Complete" -ForegroundColor Green
Write-Host ""

# Summary
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "All diagnostics complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Results saved to: $resultsDir" -ForegroundColor Yellow
Write-Host ""
Write-Host "Quick preview of Query 1 (Tour Status):" -ForegroundColor Cyan
Get-Content "$resultsDir\query1-tour-status.txt" | Select-Object -First 25
Write-Host ""
Write-Host "To view all results, check files in: $resultsDir\" -ForegroundColor Yellow
