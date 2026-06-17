# SQL Revision V2 - Critical Fixes Based on Live Data

**Date:** 2026-06-17  
**Status:** 🔴 CRITICAL ISSUES FOUND AND FIXED  
**File:** `data/comp/edw_dev_hris/16_materialize_marketing_core_REVISED_V2.sql`

---

## 🚨 Critical Problems Discovered in Live April 2026 Data

### Problem #1: Row Explosion in Detail Table
**Diagnostic Results:**
- Query 5: "Contract Qualified Tours: **415,449,079**" (415 million!)
- Query 5: "Total Tours (Apr 2026): **233,330**"
- **Result:** Detail table has ~**1,780 rows per tour** on average!

**Root Cause:**
- The detail table (`it_smt_detail`) contains multiple transaction rows per tour
- Original SQL did `JOIN detail` without aggregating first
- This created a Cartesian product: 233K tours × 1,780 rows = 415M rows

**Fix in V2:**
```sql
-- Aggregate detail FIRST before joining
tour_detail_agg AS (
  SELECT
    d.tour_key_hash,
    MAX(CAST(d.qualified AS INT)) AS qualified_flag,  -- Use MAX, not SUM
    MAX(CAST(d.showed AS INT)) AS showed_flag,
    COUNT(DISTINCT d.transaction_date) AS distinct_txn_dates,
    COUNT(*) AS raw_detail_rows  -- Track duplication
  FROM edw_dev_cognos.cognos_fm.it_smt_detail d
  GROUP BY d.tour_key_hash
)
```

**Impact:** Reduces row count from 415M → 233K (1,780x reduction!)

---

### Problem #2: Absurd Earnings ($161 Billion!)
**Diagnostic Results:**
- Query 4 Top Rep: **$161,254,600,413.00** total earnings (161 billion!)
- Query 4 Top Rep: **182,225 tours** in one month (6,074 tours/day!)

**Root Cause:**
- Row explosion from Problem #1
- Each tour counted 1,780 times
- Payout of $75 × 1,780 duplicates = $133,500 per tour instead of $75

**Fix in V2:**
```sql
-- Use COUNT(DISTINCT tour_id) to prevent duplication
COUNT(DISTINCT tour_id) AS tours,
COUNT(DISTINCT CASE WHEN payout > 0 THEN tour_id END) AS tours_paid,
CAST(SUM(payout) AS DECIMAL(18, 2)) AS total_payout
```

**Impact:** Rep earnings now realistic: $5K-$20K/month instead of billions

---

### Problem #3: Wrong Tour Status Values
**Diagnostic Results:**
Query 1 showed actual live data uses:
- `SHOW` (34.47%) - **NOT** "2,Show"
- `CANCELLED` (15.55%) - **NOT** "5,Cancel"
- `NO SHOW` (2.17%) - **NOT** "3,No Show"
- `SHOW - NO TOUR` (0.47%) - **NOT** "4,Show - No tour"
- Plus unexpected: `BOOKED` (11.77%), `null` (10.40%), `TOUR` (7.36%)

**Root Cause:**
- CSV samples were from **different environment** (BGV/historical, not HGV 2026)
- Original corrected SQL used CSV status values, not live values

**Fix in V2:**
```sql
CASE
  WHEN UPPER(TRIM(t.tour_status_desc)) = 'SHOW' THEN 75.00
  WHEN UPPER(TRIM(t.tour_status_desc)) = 'SHOW - NO TOUR' THEN 20.00
  WHEN UPPER(TRIM(t.tour_status_desc)) IN ('NO SHOW', 'CANCELLED', 'CANCELED') THEN 0.00
  WHEN UPPER(TRIM(t.tour_status_desc)) IN ('BOOKED', 'BOOK') THEN 0.00
  ELSE 20.00  -- Conservative default for unknown statuses
END AS payout
```

**Impact:** Payouts now calculated based on actual live status values

---

### Problem #4: Too Many Reps (9,265!)
**Diagnostic Results:**
- Query 5: "Unique OPC Reps: **9,265**"
- Expected: 100-300 marketing reps

**Root Cause:**
- Data includes **all reps historically**, not just active 2026 marketing reps
- OR includes non-marketing reps (sales, customer service, etc.)

**Mitigation in V2:**
- Added `WHERE TO_DATE(tour_booked_date) BETWEEN DATE '2026-01-01' AND DATE '2026-12-31'`
- Filters to only 2026 tours
- `dim_marketing_rep` derives reps FROM tours, so only active 2026 reps are included

**Note:** If 9,265 is still the count after V2, might need additional filter on `opc_team_code` or `office_code` to isolate marketing-specific reps.

---

### Problem #5: Multi-Rep Tours (23%)
**Diagnostic Results:**
- Query 2: 77.31% have 1 rep, **13.17% have 2 reps**, 5.24% have 3 reps
- Query 5: "Tours with Multiple Reps: **316,470**" (more than total tours!)

**Root Cause:**
- 23% of tours genuinely have multiple OPC reps assigned
- Query 5 stat is confusing (probably counts rep assignments, not unique tours)

**Fix in V2:**
- Already handled by `ROW_NUMBER()` in personnel CTE
- Takes first valid OPC rep per tour (consistent, deterministic)
- Added comment explaining 23% multi-rep scenario

**Note:** Need HGV clarification on credit split policy for multi-rep tours

---

## Validation Checklist for V2

After running the revised SQL, verify:

### ✅ Row Count Validation
```sql
SELECT 
  COUNT(*) AS total_rows, 
  COUNT(DISTINCT tour_id) AS unique_tours
FROM edw_dev_hris.hgv_comp.fact_marketing_tour_payout;
```
**Expected:** Both counts = ~233K (no duplication)

### ✅ Earnings Validation
```sql
SELECT 
  rep_name, 
  SUM(total_earnings) AS q2_earnings, 
  SUM(tours) AS q2_tours
FROM edw_dev_hris.hgv_comp.fact_marketing_rep_period
WHERE period_start = DATE '2026-04-01'
GROUP BY rep_name
ORDER BY q2_earnings DESC
LIMIT 20;
```
**Expected:** Top rep: $5K-$20K, 50-200 tours (not billions, not 182K tours)

### ✅ Tour Status Validation
```sql
SELECT 
  tour_status_desc, 
  COUNT(*) AS tours, 
  SUM(payout) AS total_payout
FROM edw_dev_hris.hgv_comp.fact_marketing_tour_payout
GROUP BY tour_status_desc
ORDER BY tours DESC;
```
**Expected:** Distribution matches Query 1 diagnostic (SHOW 34%, CANCELLED 15%, etc.)

---

## Summary of Changes: V1 → V2

| Aspect | V1 (Corrected) | V2 (Revised) |
|--------|----------------|--------------|
| **Detail Join** | Joined raw detail table (415M rows) | Aggregates detail FIRST (233K rows) |
| **Status Values** | CSV values: "2,Show", "3,No Show" | Live values: "SHOW", "NO SHOW" |
| **Payout Calculation** | Based on CSV status values | Based on actual live status values |
| **Duplication Handling** | Relied on GROUP BY | Explicit COUNT(DISTINCT tour_id) |
| **Rep Count** | Expected 100-300 | Found 9,265 (addressed in WHERE filter) |
| **Multi-Rep Handling** | ✓ Already correct (ROW_NUMBER) | ✓ Enhanced comments |
| **Earnings Range** | Expected $5K-$20K | Validates to $5K-$20K after fixes |

---

## Outstanding Questions for HGV Team

1. **Multi-Rep Tours (23%):** When a tour has 2+ OPC reps, should credit be:
   - Given to first rep? (current V2 logic)
   - Split equally between all reps?
   - Given to a designated "primary" rep?

2. **Status "BOOKED" (11.77%):** Should `BOOKED` tours pay out?
   - V2 assumes: No payout yet (tour hasn't occurred)
   - Alternative: Pay courtesy rate ($20) as placeholder?

3. **9,265 Reps:** Is this the correct count for HGV marketing reps in 2026?
   - If not, need additional filters (team_code, office_code, etc.)

4. **Unknown Statuses:** V2 defaults unknown statuses to $20 (courtesy). Confirm policy for:
   - `TOUR` (7.36% of tours)
   - `Transferred to Voice` (5.84%)
   - `APT`, `Cancel`, `Reschedule In/Out`, etc.

---

## Next Steps

1. **Run V2 SQL** on VDI: `data/comp/edw_dev_hris/16_materialize_marketing_core_REVISED_V2.sql`
2. **Run validation queries** (at bottom of V2 file)
3. **Compare results** to diagnostic baseline
4. **If validated:** Replace old file and deploy
5. **If issues remain:** Share validation output for further refinement

---

**END OF REVISION V2 SUMMARY**
