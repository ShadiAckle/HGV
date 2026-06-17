# Marketing Compensation SQL — Root Cause Analysis & Corrections

**Date:** 2026-06-17  
**Issue:** SQL `16_materialize_marketing_core.sql` generates incorrect results when applied to live Cognos data  
**Root Cause:** Mock seed data structure doesn't align with Cognos source table structure

---

## The Complete Picture: Mock vs. Live Data

### Mock Seed Data (What You Tested Against)

**Source Files:**
- `server/marketingTeamSeed.ts`
- `shared/marketingTeamRoster.ts`
- `data/comp/edw_dev_hris/06a_seed_marketing_benchmark.sql`

**Structure:**
```typescript
// Synthetic Rep IDs
rep_id: 'MKT-REP-001', 'MKT-REP-002', 'MKT-REP-003', ...
rep_name: 'M. Chen', 'J. Rivera', 'A. Patel', ...

// Synthetic Tour IDs  
tour_id: 'MKT-T-101', 'MKT-T-102', 'MKT-T-201', ...

// Clean Payout Structure
qualified_tour_pay: $675 for 9 tours = $75/tour
courtesy_tour_pay: $40 for 2 tours = $20/tour
penetration_spiff: $250
chargebacks: -$25
total_payout: $3,180

// Tour Quality Metrics
showed_flag: true/false
closed_flag: true/false
net_sales_volume: 3400, 3200, 2200, ...
```

**Key Observation:** Mock data is **pre-aggregated** at the rep-period level. Individual tours (`MKT-T-101`) are stored in `fact_tour_quality`, not `fact_marketing_tour_payout`.

### Live Cognos Data (What SQL Reads Now)

**Source Tables:**
- `edw_dev_cognos.cognos_fm.it_smt_marketing` — Tours (tour_key_hash, tour_id, tour_booked_date, office_region)
- `edw_dev_cognos.cognos_fm.it_smt_detail` — Tour metrics (qualified, showed, net_volume)
- `edw_dev_cognos.cognos_fm.it_smt_personnel` — Rep assignment (opc_person_1_employee_id, opc_person_1_name)

**Structure:**
```
// Real Rep IDs (Employee IDs)
opc_person_1_employee_id: 1590949, 2003671, ...
opc_person_1_name: 'CHEN,RACHEL', 'POPPLE,VICKY', ...

// Real Tour IDs
tour_id: 8163518, 7879159, ...

// Raw Transaction Flags
qualified: 1, showed: 1
net_volume: 0E-12 (often zero or massive contract values like $50K)
```

**Key Problem:** The SQL tries to calculate per-tour payouts ($75, $20) from Cognos raw transaction data, but:
1. **Rep IDs don't match** — Real employee IDs vs. synthetic `MKT-REP-*` IDs
2. **Tour structures differ** — Mock uses pre-calculated payouts; SQL tries to derive them
3. **Data quality issues** — Multiple personnel records per tour, NULL values, zero volumes

---

## What `16_materialize_marketing_core.sql` Currently Does

**Step 1-2:** Creates staging tables
```sql
-- Seeds from it_smt_marketing (2026 tours only)
-- Joins it_smt_detail to get qualified/showed flags
-- Joins it_smt_personnel to get opc_person_1_employee_id
```

**Step 3:** Calculates per-tour payouts
```sql
-- Current logic:
CASE
  WHEN t.qualified_flag THEN 75.00  -- Qualified tour
  WHEN t.showed_flag THEN 35.00      -- Showed but not qualified
  ELSE 20.00                          -- Courtesy (no-show)
END AS payout
```

**Step 4:** Builds `dim_marketing_rep` from tour payouts
```sql
-- Derives rep roster from tours (bottom-up)
SELECT tp.rep_id, MAX(tp.rep_name), 'MKT', ...
FROM fact_marketing_tour_payout tp
GROUP BY tp.rep_id
```

**Step 5:** Aggregates to rep-period level
```sql
-- Rolls up tours to fact_marketing_rep_period
SUM(tp.payout) AS tour_payout
```

---

## The Fundamental Disconnect

### Issue #1: Rep Roster Mismatch
**Mock Data:** `MKT-REP-001`, `MKT-REP-002`, ... (pre-seeded in `dim_rep`)  
**SQL Output:** Real employee IDs like `1590949`, `2003671` (derived from tours)  
**UI Impact:** "Wrong reps" — Shows real employee IDs instead of curated rep roster

### Issue #2: Payout Calculation Wrong
**Mock Data:** Pre-calculated at rep-period level  
```
qualified_tour_pay: $675 = 9 tours × $75
courtesy_tour_pay: $40 = 2 tours × $20
```

**SQL Logic:** Tries to calculate per-tour, but:
- Uses `qualified` and `showed` flags from `it_smt_detail`
- **Problem:** These flags are about contract/transaction qualification, NOT tour qualification for OPC pay
- **Result:** Wrong classification → wrong payouts

**Example from Cognos CSV:**
```
Tour 521: qualified=1, showed=1, net_volume=0
```
This is a **contract qualification flag** (guest bought), not a marketing tour qualification. OPC rep still gets paid $75 regardless of whether guest bought.

### Issue #3: No-Show/Showed Logic Broken
**Current SQL:**
```sql
WHEN t.qualified_flag THEN 75.00
WHEN t.showed_flag THEN 35.00   -- THIS IS WRONG
ELSE 20.00
```

**Correct Logic (Per Mock Data):**
- Qualified tour (guest qualified for presentation): **$75**
- Courtesy tour (guest didn't qualify but showed): **$20**
- No-show: **$0** (not $35)

**There is no $35 payout tier** in the mock data.

### Issue #4: FPS Potential Unrealistic
**Current SQL:**
```sql
LEAST(GREATEST(t.net_volume, 0) * 0.01, 500.00) AS fps_potential
```

**Problem:** `net_volume` is the contract sales volume (e.g., $3,400), not a tour metric. When multiplied by 1%, FPS potential is $34-$36 per tour, which is correct. But when summed across many tours OR when `net_volume` is incorrectly a massive number, you get millions.

**From Mock Data:**
```
FPS potential per tour: $420, $380, $480 (calculated separately based on package type and guest profile)
```

**FPS is NOT a simple percentage of net_volume** — it's a complex calculation based on guest qualification, package sold, and other business rules not captured in the current SQL.

---

## Why $6M+ Earnings Appeared

**Theory:** The SQL ran against live 2026 Cognos data where:
1. **Many tours per rep** — A real rep might have 500-1,000 tours over Q2 2026
2. **Net volume misuse** — If `net_volume` contains contract values (e.g., $50K), then:
   ```
   500 tours × $50,000 × 0.25% = $625,000 (wrong calc)
   ```
3. **Duplicate tours** — The join to `it_smt_personnel` creates duplicates (multiple personnel records per tour)
4. **Wrong period aggregation** — Tours from multiple quarters summed incorrectly

---

## Required Corrections

### Correction #1: Don't Derive Rep Roster from Tours

The SQL should **NOT** build `dim_marketing_rep` from `fact_marketing_tour_payout`. Instead:
- Pre-seed `dim_marketing_rep` with the curated roster from `marketingTeamSeed.ts`
- Map real Cognos employee IDs to these roster IDs via a lookup table

**Option A (Quick Fix):** Insert a mapping table
```sql
CREATE TABLE edw_dev_hris.hgv_comp._map_employee_to_roster (
  cognos_employee_id STRING,
  roster_rep_id STRING,
  rep_name STRING
);

-- Map real employee IDs to roster
INSERT INTO _map_employee_to_roster VALUES
  ('1590949', 'MKT-REP-001', 'M. Chen'),
  ('2003671', 'MKT-REP-002', 'J. Rivera'),
  ...
```

**Option B (Proper Solution):** Sync `dim_marketing_rep` with HR system
- Pull active marketing OPC reps from HR/personnel system
- Assign roster IDs (MKT-REP-XXX) to each
- Store mapping in a reference table

### Correction #2: Fix Payout Calculation

**Remove the $35 tier:**
```sql
-- WRONG:
WHEN t.showed_flag THEN 35.00

-- CORRECT:
WHEN t.qualified_flag THEN 75.00
ELSE 20.00  -- Courtesy OR no-show (both get $20 base)
```

**Clarify qualified vs. showed:**
- `qualified` in `it_smt_detail` = **Contract qualified** (guest bought)
- Marketing tour qualification = **Guest attended presentation** (different metric)

**Where is the real tour qualification flag?**
- Check `it_smt_marketing.tour_status_desc` or `it_smt_detail` for attendance status
- Likely need to map `tour_status_desc` values like 'SHOWN', 'NO_SHOW', 'CANCELLED'

### Correction #3: FPS Potential Calculation

**Option 1:** Remove FPS from tour-level calculation
```sql
-- Set to NULL or 0 in fact_marketing_tour_payout
fps_potential: NULL
```
Then calculate FPS separately in a dedicated table/module using proper business rules.

**Option 2:** Use a simplified FPS logic (if business rules are known)
```sql
-- Example: FPS based on package type, not net_volume
CASE 
  WHEN t.package_type = 'Flex' THEN 480.00
  WHEN t.package_type = 'Preview' THEN 420.00
  WHEN t.package_type = 'Discovery' THEN 380.00
  ELSE 0
END AS fps_potential
```

### Correction #4: Tour Qualification Mapping

**Identify the correct source for marketing tour qualification:**

Query to investigate:
```sql
SELECT 
  m.tour_status_desc,
  d.qualified,
  d.showed,
  COUNT(*) AS tour_count,
  AVG(d.net_volume) AS avg_volume
FROM edw_dev_cognos.cognos_fm.it_smt_marketing m
INNER JOIN edw_dev_cognos.cognos_fm.it_smt_detail d 
  ON d.tour_key_hash = m.tour_key_hash
WHERE TO_DATE(m.tour_booked_date) BETWEEN '2026-01-01' AND '2026-01-31'
GROUP BY m.tour_status_desc, d.qualified, d.showed
ORDER BY tour_count DESC;
```

**Expected result:** Identify which combination of flags represents:
- Qualified tours (get $75)
- Courtesy tours (get $20)
- No-shows (get $0)

### Correction #5: Deduplicate Personnel Joins

**Current issue:** Multiple `it_smt_personnel` records per tour create duplicates.

**Fix:** The SQL already handles this with `ROW_NUMBER()`, but verify:
```sql
-- In Step 2 (_stg_tour_enriched):
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

-- Then filter: WHERE rn = 1
```

**Verification query:**
```sql
SELECT tour_key_hash, COUNT(*) AS dup_count
FROM edw_dev_hris.hgv_comp._stg_tour_enriched
GROUP BY tour_key_hash
HAVING COUNT(*) > 1;
-- Should return 0 rows
```

---

## Recommended Approach

### Phase 1: Understand Live Data (Do This First)
Run diagnostic queries against live Cognos data to understand the actual structure:

```sql
-- 1. Sample 2026 tours with rep and tour status
SELECT 
  m.tour_id,
  m.tour_booked_date,
  m.tour_status_desc,
  p.opc_person_1_employee_id,
  p.opc_person_1_name,
  p.opc_team_code,
  d.qualified,
  d.showed,
  d.net_volume
FROM edw_dev_cognos.cognos_fm.it_smt_marketing m
INNER JOIN edw_dev_cognos.cognos_fm.it_smt_detail d 
  ON d.tour_key_hash = m.tour_key_hash
INNER JOIN edw_dev_cognos.cognos_fm.it_smt_personnel p 
  ON p.tour_key_hash = m.tour_key_hash
WHERE TO_DATE(m.tour_booked_date) BETWEEN '2026-04-01' AND '2026-04-30'
  AND p.opc_person_1_employee_id IS NOT NULL
  AND CAST(p.opc_person_1_employee_id AS BIGINT) <> 0
LIMIT 100;

-- 2. Rep aggregation (how many tours per rep?)
SELECT 
  p.opc_person_1_employee_id AS rep_id,
  MAX(p.opc_person_1_name) AS rep_name,
  COUNT(DISTINCT m.tour_id) AS tour_count,
  SUM(CASE WHEN d.qualified = 1 THEN 1 ELSE 0 END) AS qualified_count,
  SUM(CASE WHEN d.showed = 1 THEN 1 ELSE 0 END) AS showed_count
FROM edw_dev_cognos.cognos_fm.it_smt_marketing m
INNER JOIN edw_dev_cognos.cognos_fm.it_smt_detail d 
  ON d.tour_key_hash = m.tour_key_hash
INNER JOIN edw_dev_cognos.cognos_fm.it_smt_personnel p 
  ON p.tour_key_hash = m.tour_key_hash
WHERE TO_DATE(m.tour_booked_date) BETWEEN '2026-04-01' AND '2026-04-30'
  AND p.opc_person_1_employee_id IS NOT NULL
GROUP BY p.opc_person_1_employee_id
ORDER BY tour_count DESC
LIMIT 20;
```

**Share the output of these queries with me** so I can:
1. Identify the correct tour qualification logic
2. Determine proper payout mapping
3. Build an employee-to-roster mapping

### Phase 2: Create Mapping Tables

Once I see the live data structure, I'll create:
1. `_map_employee_to_roster` — Maps Cognos employee IDs to roster rep IDs
2. `_map_tour_status_to_payout` — Maps tour status to payout amount
3. Updated `16_materialize_marketing_core.sql` with corrected joins and logic

### Phase 3: Rebuild SQL with Corrections

---

## Summary: Why Results Are Wrong

1. **Rep IDs don't match** — SQL uses real employee IDs; UI expects roster IDs (MKT-REP-*)
2. **Payout logic is incorrect** — Using wrong flags (contract qualified vs. tour qualified)
3. **$35 tier doesn't exist** — Should be $75 qualified, $20 courtesy, $0 no-show
4. **FPS calculation is broken** — Using net_volume (contract value) instead of package-based logic
5. **No mapping layer** — SQL directly reads Cognos without transforming to expected structure

**What I need from you:**
Run the Phase 1 diagnostic queries and share the output. With that, I can write the corrected SQL that will produce results matching your "mock seeded data" expectations.
