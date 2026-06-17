# CSV Data Analysis & SQL Alignment Issues

**Date:** 2026-06-17  
**Purpose:** Identify why SQL queries generate incorrect results vs. expected "mock seeded data"

---

## Executive Summary

**CRITICAL FINDING:** The provided CSV files do NOT contain HGV 2026 marketing OPC compensation data. They contain:
1. Historical 2004-2013 tour/sales data (personnel, detail, marketing, uni_lead, uni_contract)
2. 2026 BGV (Bluegreen) sales commission data (commissions.csv) for sales executives, NOT marketing OPC reps

The SQL script `16_materialize_marketing_core.sql` is designed to generate **HGV Marketing OPC Rep Compensation for 2026**, but there is no comparable reference data in the CSVs to validate against.

---

## CSV File Inventory & Contents

### 1. personnel.csv (1,001 rows including header)
- **Date Range:** Historical data (2004-2013 era)
- **Key Columns:**
  - `opc_person_1_employee_id`, `opc_person_1_name` - Marketing OPC rep
  - `salesperson_1_employee_id`, `salesperson_1_name` - Sales rep
  - `tour_key_hash` - Links to tours
- **Sample Record:**
  ```
  Tour 521: OPC Rep 1590949 (CHEN,RACHEL) | Sales Rep 2026849 (ROJAS,LAUREN)
  ```
- **Issue:** Multiple personnel records per tour (duplicates requiring deduplication)

### 2. detail.csv (1,001 rows)
- **Date Range:** Historical 2004-2013
- **Key Columns:** `tour_key_hash`, `qualified`, `showed`, `net_volume`, `transaction_date`
- **Sample Record:**
  ```
  Tour 521: Qualified=1, Showed=1, Net Volume=0
  ```
- **Issue:** No 2026 records found

### 3. marketing.csv (1,001 rows)
- **Date Range:** Historical 2004-2013 (DRI properties, European locations)
- **Key Columns:** `tour_key_hash`, `tour_id`, `tour_booked_date`, `office_code`, `office_region`
- **Sample Record:**
  ```
  Tour 8163518: Date=2004-08-12, Office=230, Region=Other
  ```
- **Issue:** No 2026 records, data is from defunct DRI properties

### 4. uni_lead.csv & uni_contract.csv (1,001 rows each)
- **Date Range:** Historical 2006-2013
- **Purpose:** Lead and contract details
- **Issue:** No 2026 records

### 5. commissions.csv (1,001 rows)
- **Date Range:** **April 2026** (THIS IS THE ONLY 2026 DATA)
- **Organization:** **BGV (Bluegreen Vacations)** - NOT HGV
- **Roles:** Sales Executives, Take-Over Managers (e.g., `BGV_SALESEXECUTIVE_HARBOURLIGHTS`, `BGV_TO_EILAN`)
- **Sample Records:**
  ```
  SwavekApanowicz | BGV_TO_HARBOURLIGHTS | $153.88 | Sold: 2026-04-21 | Pay: 2026-04-30
  MitchellWeinberg | BGV_SALESEXECUTIVE_HARBOURLIGHTS | $577.06 | Sold: 2026-04-21
  AlejandroJuarez | BGV_SALESEXECUTIVE_EILAN | $1,100.00 | Sold: 2026-04-21
  ```
- **Commission Structure:** Rate-based (e.g., 1.2%, 4.5%, 6%) on order values
- **Critical Issue:** This is for **BGV sales reps**, NOT **HGV marketing OPC reps**

---

## The Fundamental Disconnect

### What the SQL Does (16_materialize_marketing_core.sql)
```
PURPOSE: Generate HGV Marketing OPC Rep Compensation for Calendar Year 2026
DATA SOURCES: edw_dev_cognos.cognos_fm.it_smt_marketing, it_smt_detail, it_smt_personnel
OUTPUT: fact_marketing_tour_payout, dim_marketing_rep, fact_marketing_rep_period
PAYOUT LOGIC: 
  - $75.00 for qualified tours
  - $35.00 for showed tours
  - $20.00 for courtesy tours
  - FPS potential: min(net_volume * 1%, $500)
REP ATTRIBUTION: opc_person_1_employee_id from it_smt_personnel
```

### What the CSVs Contain
1. **Historical 2004-2013 HGV/DRI tour data** - No relevance to 2026 compensation
2. **2026 BGV sales commission data** - Wrong organization, wrong role (sales vs. marketing), wrong comp structure

### Why Results Are Wrong
The SQL was likely developed/tested against **seeded/mocked 2026 HGV marketing data in Databricks tables**, NOT the provided CSVs. When you now run it against live Cognos data:
- Rep attribution logic may be incorrect for live data
- Payout calculations don't match business rules
- Tour qualification logic is wrong
- Data quality issues (e.g., NULL rep IDs, wrong rep names)

---

## Questions to Resolve

### 1. Where Is the Real "Mock Seeded Data"?
The CSVs provided don't contain the data you're referring to. Was there a separate seed script or SQL that populated `edw_dev_hris.hgv_comp` tables with mock 2026 marketing data?

**Action Needed:** Point me to the actual seed data SQL or Delta tables that contain the expected 2026 marketing rep tour payouts.

### 2. What Are the Correct Business Rules?
Based on the UI screenshots showing $6M+ earnings, the current logic is clearly wrong. I need to know:

**a. Payout Rates:**
- What is the per-tour payout for qualified tours? (Currently $75)
- What is the per-tour payout for showed tours? (Currently $35)
- What is the per-tour payout for courtesy tours? (Currently $20)

**b. FPS (Front Person Sales) Potential:**
- Is this based on net_volume (contract value)?
- What is the rate? (Currently 1% capped at $500)
- Or is FPS a separate metric not related to tours?

**c. Rep Attribution:**
- Should we use `opc_person_1_employee_id` from `it_smt_personnel`? (Currently YES)
- Or a different column?
- How do we handle tours with multiple OPC reps? (Currently taking first non-NULL)

**d. Tour Qualification:**
- What makes a tour "qualified" vs. "showed" vs. "courtesy"?
- Are we reading the right columns from `it_smt_detail`? (`qualified`, `showed` flags)

### 3. Why Are Rep Names/IDs Wrong?
The UI showed "wrong reps". This suggests:
- The join to `it_smt_personnel` on `tour_key_hash` is incorrect
- Or the `opc_person_1_employee_id` column is not the right rep identifier
- Or there's a data quality issue in Cognos

**Action Needed:** Provide a sample tour from live Cognos with expected rep attribution:
```sql
-- Example: Tour ID X should be attributed to Rep Y because...
```

---

## Recommended Next Steps

### Option 1: Provide Actual Seed Data
If there's a SQL script or Delta table dump that represents the "original mock seeded data" for 2026 HGV marketing compensation, provide:
1. The seed SQL script
2. Or a CSV export of `fact_marketing_tour_payout` with expected results
3. Or a sample of ~100 tours with expected rep attribution and payouts

### Option 2: Define Business Rules Explicitly
Document:
1. Payout calculation formula (per tour type)
2. FPS potential calculation
3. Rep attribution logic (which column, how to dedupe)
4. Period rollup logic (how to aggregate tours to rep-period)

### Option 3: Work from Live Data Sample
Pull a sample of 2026 tours from live Cognos and manually calculate expected payouts, then I'll reverse-engineer the correct SQL logic:
```sql
SELECT m.tour_id, m.tour_booked_date, p.opc_person_1_employee_id, p.opc_person_1_name,
       d.qualified, d.showed, d.net_volume, m.office_region
FROM edw_dev_cognos.cognos_fm.it_smt_marketing m
INNER JOIN edw_dev_cognos.cognos_fm.it_smt_detail d ON d.tour_key_hash = m.tour_key_hash
INNER JOIN edw_dev_cognos.cognos_fm.it_smt_personnel p ON p.tour_key_hash = m.tour_key_hash
WHERE TO_DATE(m.tour_booked_date) BETWEEN '2026-01-01' AND '2026-01-31'
  AND p.opc_person_1_employee_id IS NOT NULL
LIMIT 50;
```

---

## Summary

The provided CSVs **cannot** be used to rebuild/validate the SQL because they don't contain 2026 HGV marketing data. The SQL needs to be corrected based on either:
1. The actual seeded data you were testing against originally
2. Explicit business rules for how marketing OPC rep compensation works
3. Manual validation against live 2026 Cognos tour data

**What I need from you:**
- Confirm whether there was a separate seed script/data for 2026
- Provide business rules for payout calculations
- Or provide a sample query result from live Cognos with expected vs. actual payouts

Once I have this, I can rebuild the SQL logic correctly.
