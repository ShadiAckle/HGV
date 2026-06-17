# Marketing SQL Corrections — Based on Actual Cognos Schema

**Date:** 2026-06-17  
**Context:** CSVs are 1000-row samples from live Cognos tables (billions of records)  
**Objective:** Correct `16_materialize_marketing_core.sql` to work with actual Cognos FM schema

---

## Actual Cognos Schema (from CSV samples)

### it_smt_personnel
```
tour_key_hash          | Join key to marketing/detail
opc_person_1_employee_id | Marketing OPC rep ID (e.g., 1590949)
opc_person_1_name      | Rep name (e.g., "CHEN,RACHEL")
opc_team_code          | Team (e.g., 121, 188)
salesperson_1_employee_id | DIFFERENT ROLE - Field sales rep
salesperson_1_name     | Sales rep name
```

**Issue observed:** Multiple rows per tour_key_hash (e.g., tour 521 has 2 personnel records)

### it_smt_detail
```
tour_key_hash     | Join key
qualified         | 1/0 - CONTRACT qualified (guest bought)
showed            | 1/0 - CONTRACT showed (transaction recorded)
net_volume        | Contract sales volume (often 0E-12)
transaction_date  | Date of transaction
```

**Issue observed:** qualified/showed are about SALES, not tour attendance

### it_smt_marketing
```
tour_key_hash        | Join key
tour_id              | Unique tour ID
tour_booked_date     | Tour date
tour_status_code     | Numeric code
tour_status_desc     | Status description (e.g., "2,Show", "3,No Show")
office_code          | Office (e.g., 230, 5)
office_region        | Region (e.g., "Other", "North America/Europe")
channel              | null in samples
```

**Critical:** `tour_status_desc` is likely the real tour qualification indicator

---

## Current SQL Issues Mapped to Schema

### Issue #1: Wrong Rep Attribution
**Current SQL (Step 2):**
```sql
FROM edw_dev_hris.hgv_comp._stg_marketing_tour_detail d
INNER JOIN personnel_one p
  ON d.tour_key_hash = p.tour_key_hash
  AND p.rn = 1  -- Takes first non-null OPC rep
WHERE p.opc_person_1_employee_id IS NOT NULL
```

**Problem:** When tour 521 has TWO personnel records:
- Employee 1590949 (CHEN,RACHEL)
- Employee 2003671 (POPPLE,VICKY)

Who gets credit? The ROW_NUMBER() logic takes the first, but is that correct?

**Questions:**
1. Do multiple OPC reps split credit?
2. Is there a "primary" indicator?
3. Should we only take tours where personnel count = 1?

### Issue #2: Wrong Tour Qualification Logic
**Current SQL (Step 3):**
```sql
CASE
  WHEN t.qualified_flag THEN 75.00
  WHEN t.showed_flag THEN 35.00
  ELSE 20.00
END AS payout
```

**Problem:** Based on CSV samples:
- `detail.qualified = 1` means guest BOUGHT (contract)
- `detail.showed = 1` means transaction recorded
- These are NOT the same as "guest attended presentation"

**Correct Logic Should Be:**
```sql
-- Need to check marketing.tour_status_desc instead
CASE
  WHEN m.tour_status_desc IN ('2,Show', 'SHOWN', 'Show') THEN 75.00  -- Qualified tour
  WHEN m.tour_status_desc IN ('4,Show - No tour', ...) THEN 20.00      -- Courtesy
  WHEN m.tour_status_desc IN ('3,No Show', 'NO_SHOW') THEN 0.00       -- No show
  ELSE 20.00  -- Default courtesy
END
```

**Questions:**
1. What are ALL possible `tour_status_desc` values in 2026 data?
2. Which ones map to $75 qualified?
3. Which ones map to $20 courtesy?
4. Which ones map to $0 no-show?

### Issue #3: FPS Potential Calculation
**Current SQL:**
```sql
CAST(
  CASE
    WHEN t.qualified_flag THEN LEAST(GREATEST(t.net_volume, 0) * 0.01, 500.00)
    ELSE 0
  END AS DECIMAL(14, 2)
) AS fps_potential
```

**Problem:** From CSV samples, `net_volume` is often `0E-12` (zero). When a tour has no sale:
- Should FPS potential still be calculated?
- Is FPS based on tour characteristics (package type, guest profile) rather than actual sales?

**Questions:**
1. Is FPS potential calculated even when net_volume = 0?
2. What's the correct FPS formula? Based on mock data, it varies by tour ($380, $420, $480)

---

## Corrected SQL Logic (Draft)

### Step 2: Tour Enrichment with Correct Rep Logic

```sql
CREATE OR REPLACE TABLE edw_dev_hris.hgv_comp._stg_tour_enriched
USING DELTA
AS
WITH personnel_dedupe AS (
  -- Deduplicate personnel: take first valid OPC rep, prioritize by employee_id
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
        opc_person_1_employee_id DESC  -- Consistent tie-breaker
    ) AS rn
  FROM edw_dev_cognos.cognos_fm.it_smt_personnel
),
tours_with_single_rep AS (
  -- OPTIONAL: Filter to tours with exactly 1 OPC rep to avoid ambiguity
  SELECT tour_key_hash
  FROM edw_dev_cognos.cognos_fm.it_smt_personnel
  WHERE opc_person_1_employee_id IS NOT NULL
    AND CAST(opc_person_1_employee_id AS BIGINT) <> 0
  GROUP BY tour_key_hash
  HAVING COUNT(*) = 1
)
SELECT
  d.tour_key_hash,
  d.tour_id,
  d.tour_key,
  d.enterprise_lead_id,
  d.tour_date,
  -- CORRECTED: Use tour_status_desc instead of detail flags
  CASE 
    WHEN d.tour_status_desc IN ('2,Show', 'SHOWN', 'Show') THEN TRUE
    ELSE FALSE
  END AS showed_flag,
  CASE
    WHEN d.tour_status_desc IN ('2,Show', 'SHOWN', 'Show') THEN TRUE
    ELSE FALSE
  END AS qualified_flag,  -- Simplified: all shows are qualified for $75
  d.net_volume,
  d.lead_source,
  d.abc_score,
  d.tour_status_desc,
  d.tour_booked_date,
  d.office_code,
  d.office_region,
  d.channel,
  d.marketing_program,
  d.package_type,
  p.opc_person_1_employee_id,
  p.opc_person_1_name,
  COALESCE(NULLIF(TRIM(p.opc_team_code), ''), 'TEAM-MKT') AS opc_team_code
FROM edw_dev_hris.hgv_comp._stg_marketing_tour_detail d
INNER JOIN personnel_dedupe p
  ON d.tour_key_hash = p.tour_key_hash
  AND p.rn = 1
WHERE p.opc_person_1_employee_id IS NOT NULL
  AND CAST(p.opc_person_1_employee_id AS BIGINT) <> 0;
  -- OPTIONAL: Add join to tours_with_single_rep to exclude multi-rep tours
  -- INNER JOIN tours_with_single_rep sr ON d.tour_key_hash = sr.tour_key_hash
```

### Step 3: Payout Calculation with Correct Logic

```sql
CREATE OR REPLACE TABLE edw_dev_hris.hgv_comp.fact_marketing_tour_payout
USING DELTA
AS
SELECT
  CAST(t.tour_id AS STRING) AS tour_id,
  COALESCE(CAST(t.opc_person_1_employee_id AS STRING), 'UNASSIGNED') AS rep_id,
  CONCAT(
    CAST(YEAR(t.tour_date) AS STRING),
    '-Q',
    CAST(CAST(CEIL(MONTH(t.tour_date) / 3.0) AS INT) AS STRING)
  ) AS period_id,
  CONCAT('Lead-', CAST(t.enterprise_lead_id AS STRING)) AS guest_name,
  
  -- CORRECTED: Payout based on tour_status_desc
  CASE
    WHEN t.tour_status_desc IN ('2,Show', 'SHOWN', 'Show') THEN 'Qualified'
    WHEN t.tour_status_desc IN ('4,Show - No tour') THEN 'Courtesy'
    WHEN t.tour_status_desc IN ('3,No Show', 'NO_SHOW', '5,Cancel') THEN 'No-Show'
    ELSE 'Courtesy'  -- Default
  END AS guest_type,
  
  t.tour_date AS arrival_date,
  COALESCE(t.tour_status_desc, 'Scheduled') AS tour_status,
  COALESCE(t.channel, 'MKT') AS code,
  
  -- CORRECTED: Payout rates
  CAST(
    CASE
      WHEN t.tour_status_desc IN ('2,Show', 'SHOWN', 'Show') THEN 75.00
      WHEN t.tour_status_desc IN ('4,Show - No tour') THEN 20.00
      WHEN t.tour_status_desc IN ('3,No Show', 'NO_SHOW', '5,Cancel') THEN 0.00
      ELSE 20.00
    END AS DECIMAL(14, 2)
  ) AS payout,
  
  -- FPS eligibility: only for qualified shows
  CASE
    WHEN t.tour_status_desc IN ('2,Show', 'SHOWN', 'Show') THEN TRUE
    ELSE FALSE
  END AS fps_eligible,
  
  -- CORRECTED: FPS potential (simplified - may need business rule adjustment)
  CAST(
    CASE
      WHEN t.tour_status_desc IN ('2,Show', 'SHOWN', 'Show') 
        AND t.net_volume > 0 
      THEN LEAST(GREATEST(t.net_volume, 0) * 0.01, 500.00)
      ELSE 0
    END AS DECIMAL(14, 2)
  ) AS fps_potential,
  
  COALESCE(t.marketing_program, '') AS notes,
  CAST(t.enterprise_lead_id AS STRING) AS guest_id,
  CONCAT('HH-', CAST(t.enterprise_lead_id AS STRING)) AS household_id,
  CONCAT('LOC-', t.office_code) AS planned_tour_location_id,
  CAST(NULL AS STRING) AS current_stay_location_id,
  t.lead_source,
  t.abc_score,
  t.package_type,
  CAST(t.tour_key AS STRING) AS xref_tour_id,
  TO_DATE(t.tour_booked_date) AS tour_booked_date,
  
  -- CORRECTED: Rep name formatting
  COALESCE(NULLIF(TRIM(t.opc_person_1_name), ''), CAST(t.opc_person_1_employee_id AS STRING)) AS rep_name,
  COALESCE(t.office_region, 'Other') AS rep_region,
  COALESCE(t.opc_team_code, 'TEAM-MKT') AS rep_team_id
FROM edw_dev_hris.hgv_comp._stg_tour_enriched t;
```

---

## Critical Questions to Answer

Run these queries against your LIVE 2026 data:

### Query 1: Tour Status Distribution
```sql
SELECT 
  tour_status_desc,
  COUNT(*) AS tour_count,
  COUNT(DISTINCT tour_id) AS unique_tours
FROM edw_dev_cognos.cognos_fm.it_smt_marketing
WHERE TO_DATE(tour_booked_date) BETWEEN DATE '2026-04-01' AND DATE '2026-04-30'
GROUP BY tour_status_desc
ORDER BY tour_count DESC;
```

**Purpose:** Identify ALL tour status values and their frequencies to correctly map to payout tiers.

### Query 2: Personnel Deduplication Check
```sql
WITH dup_tours AS (
  SELECT 
    tour_key_hash,
    COUNT(*) AS rep_count,
    STRING_AGG(CAST(opc_person_1_employee_id AS STRING), ', ') AS all_reps
  FROM edw_dev_cognos.cognos_fm.it_smt_personnel
  WHERE opc_person_1_employee_id IS NOT NULL
    AND CAST(opc_person_1_employee_id AS BIGINT) <> 0
  GROUP BY tour_key_hash
  HAVING COUNT(*) > 1
)
SELECT 
  COUNT(*) AS tours_with_multiple_reps,
  AVG(rep_count) AS avg_rep_count_when_dup
FROM dup_tours;
```

**Purpose:** Understand the scale of multi-rep tours and decide if we need to split credit or filter.

### Query 3: Sample Tours with All Context
```sql
SELECT 
  m.tour_id,
  TO_DATE(m.tour_booked_date) AS tour_date,
  m.tour_status_desc,
  m.office_region,
  p.opc_person_1_employee_id AS rep_id,
  p.opc_person_1_name AS rep_name,
  p.opc_team_code,
  d.qualified AS contract_qualified,
  d.showed AS contract_showed,
  d.net_volume
FROM edw_dev_cognos.cognos_fm.it_smt_marketing m
INNER JOIN edw_dev_cognos.cognos_fm.it_smt_detail d 
  ON d.tour_key_hash = m.tour_key_hash
INNER JOIN edw_dev_cognos.cognos_fm.it_smt_personnel p 
  ON p.tour_key_hash = m.tour_key_hash
WHERE TO_DATE(m.tour_booked_date) BETWEEN DATE '2026-04-01' AND DATE '2026-04-30'
  AND p.opc_person_1_employee_id IS NOT NULL
  AND CAST(p.opc_person_1_employee_id AS BIGINT) <> 0
ORDER BY m.tour_booked_date, m.tour_id
LIMIT 100;
```

**Purpose:** See real examples to validate the corrected logic.

---

## Next Steps

1. **Run the 3 queries above** against your live 2026 data
2. **Share the results** so I can finalize the tour_status_desc mapping
3. **I'll provide the final corrected SQL** that works with your exact Cognos schema

Once I see the actual tour status values and personnel patterns from 2026, I can give you production-ready SQL.
