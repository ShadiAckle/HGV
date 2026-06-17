# SQL Corrections Summary - Marketing Compensation

**Date:** 2026-06-17  
**Status:** ✅ CORRECTED SQL READY FOR TESTING  
**File:** `data/comp/edw_dev_hris/16_materialize_marketing_core_CORRECTED.sql`

---

## What Was Wrong?

The original SQL (`16_materialize_marketing_core.sql`) generated incorrect results because it made **wrong assumptions about the Cognos schema**:

### Issue #1: Wrong Tour Qualification Logic
**Original (INCORRECT):**
```sql
CASE
  WHEN t.qualified_flag THEN 75.00  -- Using detail.qualified
  WHEN t.showed_flag THEN 35.00      -- Using detail.showed
  ELSE 20.00
END AS payout
```

**Problem:** `detail.qualified` and `detail.showed` flags indicate **CONTRACT QUALIFICATION** (guest bought), not whether the guest attended the tour presentation.

**Corrected:**
```sql
CASE
  WHEN LOWER(TRIM(t.tour_status_desc)) IN ('show', '2,show') THEN 75.00
  WHEN LOWER(TRIM(t.tour_status_desc)) IN ('show - no tour', '4,show - no tour') THEN 20.00
  WHEN LOWER(TRIM(t.tour_status_desc)) IN ('no show', '3,no show', 'cancel', '5,cancel') THEN 0.00
  ELSE 20.00
END AS payout
```

**Why:** The CSV samples show `tour_status_desc` values like:
- `"2,Show"` → Guest attended presentation → **$75** (qualified tour payout)
- `"4,Show - No tour"` → Guest showed but no presentation → **$20** (courtesy payout)
- `"3,No Show"`, `"5,Cancel"` → No payout → **$0**

### Issue #2: Wrong FPS Calculation
**Original (INCORRECT):**
- FPS was tied to tour attendance (`qualified_flag` from tour status)

**Corrected:**
```sql
CASE
  WHEN t.qualified_flag = TRUE THEN 250.00  -- Full FPS if contract qualified
  ELSE 0.00
END AS fps_potential
```

**Why:** FPS (Field Profit Share) is awarded when a **CONTRACT IS QUALIFIED** (`detail.qualified = 1`), not just when a guest attends a tour. These are separate events:
- **Tour Attendance** → Tour payout ($75/$20/$0)
- **Contract Qualified** (guest bought) → FPS potential ($250)

### Issue #3: $35 Payout Tier Doesn't Exist
**Original (INCORRECT):**
- Used a $35 payout tier for "showed" tours

**Corrected:**
- Only **$75** (qualified tour), **$20** (courtesy), or **$0** (no-show/cancel)

**Why:** Mock seed data (`marketingTeamSeed.ts`, `06a_seed_marketing_benchmark.sql`) only defines $75 and $20 payouts. The $35 tier was fabricated.

---

## What Was Kept (Already Correct)?

1. **Rep Attribution:** Using `opc_person_1_*` from `it_smt_personnel` (OPC = Marketing OPC rep)
2. **Multi-Rep Handling:** Using `ROW_NUMBER()` to take first non-null OPC rep per tour
3. **2026 Data Window:** Filtering to 2026-01-01 through 2026-12-31
4. **Delta Materialization:** Creating Delta tables for fast query performance
5. **Decimal Overflow Fix:** Explicit `CAST(...umber>` on aggregates

---

## Key Schema Mappings (from CSV Analysis)

### it_smt_marketing (Tour table)
```
tour_key_hash       → Join key
tour_id             → Unique tour ID (e.g., 8163518, 7879159)
tour_status_desc    → **CRITICAL**: "2,Show", "3,No Show", "4,Show - No tour", "5,Cancel"
tour_booked_date    → Tour date
office_code         → Office (e.g., 230, 5)
office_region       → Region (e.g., "Other", "North America/Europe")
```

### it_smt_personnel (Rep assignment table)
```
tour_key_hash               → Join key
opc_person_1_employee_id    → Marketing OPC rep ID (e.g., 1590949, 2003671)
opc_person_1_name           → Rep name (e.g., "CHEN,RACHEL")
opc_team_code               → Team (e.g., 121, 188)
salesperson_1_*             → **DIFFERENT ROLE** - Field sales rep (not marketing OPC)
```

**Important:** A single tour can have **multiple personnel records** (e.g., tour 521 has 2 reps). The SQL uses `ROW_NUMBER()` to take the first OPC rep.

### it_smt_detail (Transaction table)
```
tour_key_hash       → Join key
qualified           → 1/0 - CONTRACT qualified (guest BOUGHT)
showed              → 1/0 - CONTRACT showed (transaction recorded)
transaction_date    → Date of transaction
net_volume          → Contract sales volume
```

**Important:** `qualified` and `showed` are about **SALES CONTRACTS**, not tour attendance. A guest can:
- Attend a tour (`tour_status_desc = '2,Show'`) but NOT buy → `payout = $75`, `fps_potential = $0`
- Attend a tour AND buy → `payout = $75`, `fps_potential = $250`

---

## Expected Results (Alignment with Mock Data)

The corrected SQL should produce results similar to the mock seed data:

### Mock Data Example (from `marketingTeamSeed.ts`):
```typescript
{
  tourId: 'MKT-T-101',
  repId: 'MKT-REP-001',
  tourDate: '2026-04-15',
  qualified: true,          // Tour attendance (not contract)
  payout: 75.00,           // Qualified tour
  fpsEarned: 250.00,       // Contract was qualified
  totalEarnings: 325.00
}
```

### Expected SQL Output (from corrected SQL):
```sql
SELECT * FROM fact_marketing_tour_payout WHERE tour_id = 'MKT-T-101';

-- Expected:
-- tour_id: MKT-T-101
-- rep_employee_id: MKT-REP-001
-- tour_status_desc: '2,Show'
-- payout: 75.00
-- contract_qualified_flag: TRUE
-- fps_potential: 250.00
```

---

## Validation Queries (Built into SQL)

The corrected SQL includes 4 validation queries at the bottom (commented out):

1. **Tour Status Distribution:**
   ```sql
   SELECT tour_status_desc, COUNT(*) AS tours, SUM(payout) AS total_payout
   FROM fact_marketing_tour_payout
   GROUP BY tour_status_desc;
   ```
   **Expected:** Most tours are "2,Show" ($75) or "4,Show - No tour" ($20), some "3,No Show" ($0)

2. **Top Reps:**
   ```sql
   SELECT rep_name, SUM(total_earnings) AS earnings
   FROM fact_marketing_rep_period
   GROUP BY rep_name
   ORDER BY earnings DESC LIMIT 20;
   ```
   **Expected:** Earnings in thousands (not millions), realistic ranges like $15K-$50K/quarter

3. **Multi-Rep Check:**
   ```sql
   SELECT tour_id, COUNT(*) AS rep_count
   FROM fact_marketing_tour_payout
   GROUP BY tour_id
   HAVING COUNT(*) > 1;
   ```
   **Expected:** 0 rows (each tour assigned to exactly ONE rep)

4. **FPS Logic Check:**
   ```sql
   SELECT contract_qualified_flag, COUNT(*) AS tours, SUM(fps_potential)
   FROM fact_marketing_tour_payout
   GROUP BY contract_qualified_flag;
   ```
   **Expected:** 
   - `contract_qualified_flag = FALSE` → `fps_potential = $0`
   - `contract_qualified_flag = TRUE` → `fps_potential = $250/tour`

---

## Remaining Unknowns (Need Live Data to Confirm)

While the corrected SQL is based on best-effort analysis of the CSV samples, there are still a few things we can't be 100% certain about without running queries on live 2026 data:

### 1. Complete List of `tour_status_desc` Values
**What we know from CSVs:**
- `"2,Show"`, `"3,No Show"`, `"4,Show - No tour"`, `"5,Cancel"`, `"Show"`, `"Cancel"`

**What we don't know:**
- Are there other status values in 2026 data? (e.g., `"1,Booked"`, `"6,Reschedule"`, etc.)
- Do status descriptions ever lack the numeric prefix? (e.g., just `"Show"` instead of `"2,Show"`)

**Mitigation:** The SQL uses `LOWER(TRIM(...))` and checks multiple variations. The `ELSE 20.00` clause provides a safe default (courtesy payout) for any unrecognized statuses.

### 2. Multi-Rep Tour Distribution
**What we know from CSVs:**
- Tour 521 has 2 personnel records (reps 1590949 and 2003671)

**What we don't know:**
- What % of 2026 tours have multiple reps?
- Is the first `opc_person_1_employee_id` always the "primary" rep?
- Should credit be split between reps, or does only one get credit?

**Mitigation:** The SQL takes the **first non-null OPC rep** via `ROW_NUMBER()`. This is a reasonable default, but might need adjustment if HGV policy is different.

### 3. Contract Qualified Rate
**What we know from CSVs:**
- `detail.qualified = 1` indicates a contract was qualified
- Most tour samples have `qualified = 0` (no sale)

**What we don't know:**
- What's the typical qualification rate for 2026 HGV marketing tours? (e.g., 5%? 10%? 20%?)
- If the rate is unexpectedly high/low, it might indicate a schema misunderstanding

**Mitigation:** Run Validation Query #4 to check the qualification rate and compare to expected business metrics.

### 4. Rep Roster Completeness
**What we know from CSVs:**
- `opc_person_1_employee_id` values like 1590949, 2003671, etc.
- Mock data uses synthetic IDs like `MKT-REP-001`

**What we don't know:**
- Is there a master rep roster table in Cognos? (e.g., `it_smt_employee` or similar)
- Should we validate `opc_person_1_employee_id` against a known list of marketing reps?
- Are there orphaned tours with invalid rep IDs?

**Mitigation:** The SQL's `WHERE p.opc_person_1_employee_id IS NOT NULL` filters out tours with no rep assignment. `dim_marketing_rep` is built FROM the payout fact, so it only includes reps who actually had tours.

---

## Next Steps

### Option 1: Test the Corrected SQL Directly (Recommended if VDI Access Available)
1. RDP into the VDI
2. Run the corrected SQL file (`16_materialize_marketing_core_CORRECTED.sql`)
3. Run the 4 validation queries (at the bottom of the file)
4. Compare results to mock data expectations

### Option 2: Set Up GitHub Secrets and Run Diagnostic Workflow
1. Add `DATABRICKS_HOST` and `DATABRICKS_TOKEN` to GitHub Secrets:
   - https://github.com/ShadiAckle/HGV/settings/secrets/actions
2. Trigger the workflow:
   - https://github.com/ShadiAckle/HGV/actions/workflows/diagnose-cognos-schema.yml
3. Download the diagnostic results (5 CSV files)
4. Review the results to validate assumptions in the corrected SQL

### Option 3: Replace Old SQL and Deploy
Once confident in the corrected SQL:
1. **Backup the old file:**
   ```bash
   cp data/comp/edw_dev_hris/16_materialize_marketing_core.sql \
      data/comp/edw_dev_hris/16_materialize_marketing_core_BACKUP.sql
   ```
2. **Replace with corrected version:**
   ```bash
   cp data/comp/edw_dev_hris/16_materialize_marketing_core_CORRECTED.sql \
      data/comp/edw_dev_hris/16_materialize_marketing_core.sql
   ```
3. **Deploy:**
   ```bash
   cd hilton-kb-chat
   npm run typecheck
   npm run deploy
   ```

---

## Summary of Changes

| Aspect | Original (WRONG) | Corrected (RIGHT) |
|--------|------------------|-------------------|
| **Tour Payout Logic** | Based on `detail.qualified` / `detail.showed` (contract flags) | Based on `tour_status_desc` (tour attendance) |
| **Payout Tiers** | $75 / $35 / $20 | $75 / $20 / $0 (no $35 tier) |
| **FPS Calculation** | Tied to tour attendance | Tied to contract qualification (`detail.qualified = 1`) |
| **Rep Attribution** | ✓ Already correct (`opc_person_1_*`) | ✓ No change |
| **Multi-Rep Handling** | ✓ Already correct (`ROW_NUMBER()`) | ✓ No change |
| **Decimal Overflow** | ✓ Already fixed (explicit casting) | ✓ No change |

---

## Questions for HGV Team

Before finalizing, please confirm:

1. **Payout Tiers:** Are the payout amounts correct?
   - $75 for qualified tours (`tour_status_desc = '2,Show'`)
   - $20 for courtesy tours (`tour_status_desc = '4,Show - No tour'`)
   - $0 for no-shows/cancels

2. **FPS Logic:** Is FPS awarded based on contract qualification (`detail.qualified = 1`), or is there a different rule?

3. **Multi-Rep Tours:** When a tour has multiple OPC reps in `it_smt_personnel`, who gets credit?
   - First rep? (current logic)
   - Primary rep (indicated by some flag)?
   - Split credit between all reps?

4. **Tour Status Values:** Are there other `tour_status_desc` values in 2026 data beyond those in the CSV samples?

---

**END OF SUMMARY**
