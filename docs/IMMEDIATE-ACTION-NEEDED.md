# IMMEDIATE ACTION: Marketing SQL Fixes

**Status:** ❌ SQL generating incorrect results  
**Root Cause:** Mismatch between mock seed data structure and live Cognos data  
**Fix Timeline:** Need live data sample to write corrected SQL

---

## The Problem (In 30 Seconds)

The SQL `16_materialize_marketing_core.sql` was developed/tested against **mock seed data** with:
- Synthetic rep IDs (`MKT-REP-001`, `MKT-REP-002`)
- Clean payout structure ($75 qualified, $20 courtesy)
- Pre-aggregated tour data

Now it's running against **live Cognos data** with:
- Real employee IDs (`1590949`, `2003671`)
- Contract qualification flags (not tour qualification)
- Raw transaction-level records

**Result:** Wrong reps, wrong amounts ($6M+ instead of $3K), wrong logic.

---

## What You Asked Me to Do

> "Re-examine the csv files that we pulled out of databricks for each of the dependency/source tables"

**Finding:** ❌ The CSVs you provided **do NOT contain** the data the SQL needs.

### CSV Files Provided:
- `personnel.csv`, `detail.csv`, `marketing.csv` — Historical 2004-2013 data (no 2026)
- `commissions.csv` — 2026 BGV sales commissions (wrong organization/role)

### Actual "Mock Seed Data":
- `server/marketingTeamSeed.ts` — TypeScript seed file
- `shared/marketingTeamRoster.ts` — Rep roster definition
- `data/comp/edw_dev_hris/06a_seed_marketing_benchmark.sql` — SQL seed

**The CSVs are irrelevant** — they're not the source of your expectations.

---

## What I Need from You (Pick One)

### Option A: Provide Live Cognos Sample (RECOMMENDED)

Run these queries in Databricks SQL against your live Cognos tables and send me the output:

```sql
-- Query 1: Sample 2026 tours (first 50 rows)
SELECT 
  m.tour_id,
  TO_DATE(m.tour_booked_date) AS tour_date,
  m.tour_status_desc,
  m.office_region,
  m.channel,
  p.opc_person_1_employee_id AS rep_id,
  p.opc_person_1_name AS rep_name,
  p.opc_team_code,
  d.qualified,
  d.showed,
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
LIMIT 50;

-- Query 2: Rep aggregation (top 10 reps by tour count)
SELECT 
  CAST(p.opc_person_1_employee_id AS STRING) AS rep_id,
  MAX(p.opc_person_1_name) AS rep_name,
  MAX(p.opc_team_code) AS team_code,
  MAX(m.office_region) AS region,
  COUNT(DISTINCT m.tour_id) AS tour_count,
  SUM(CASE WHEN d.qualified = 1 THEN 1 ELSE 0 END) AS qualified_count,
  SUM(CASE WHEN d.showed = 1 THEN 1 ELSE 0 END) AS showed_count,
  SUM(CASE WHEN m.tour_status_desc = 'SHOW' OR m.tour_status_desc = 'SHOWN' THEN 1 ELSE 0 END) AS status_show_count
FROM edw_dev_cognos.cognos_fm.it_smt_marketing m
INNER JOIN edw_dev_cognos.cognos_fm.it_smt_detail d 
  ON d.tour_key_hash = m.tour_key_hash
INNER JOIN edw_dev_cognos.cognos_fm.it_smt_personnel p 
  ON p.tour_key_hash = m.tour_key_hash
WHERE TO_DATE(m.tour_booked_date) BETWEEN DATE '2026-04-01' AND DATE '2026-04-30'
  AND p.opc_person_1_employee_id IS NOT NULL
  AND CAST(p.opc_person_1_employee_id AS BIGINT) <> 0
GROUP BY p.opc_person_1_employee_id
ORDER BY tour_count DESC
LIMIT 10;

-- Query 3: Tour status distribution
SELECT 
  m.tour_status_desc,
  d.qualified,
  d.showed,
  COUNT(*) AS tour_count,
  AVG(CAST(d.net_volume AS DOUBLE)) AS avg_net_volume
FROM edw_dev_cognos.cognos_fm.it_smt_marketing m
INNER JOIN edw_dev_cognos.cognos_fm.it_smt_detail d 
  ON d.tour_key_hash = m.tour_key_hash
WHERE TO_DATE(m.tour_booked_date) BETWEEN DATE '2026-04-01' AND DATE '2026-04-30'
GROUP BY m.tour_status_desc, d.qualified, d.showed
ORDER BY tour_count DESC;
```

**Export as CSV or paste the results**, then I'll write the corrected SQL within an hour.

---

### Option B: Define Business Rules Explicitly

If you can't run the queries above, answer these questions:

**1. Payout Rates:**
- Qualified tour payout: $75? (or different?)
- Showed but not qualified: $20? or $35?
- No-show: $0?

**2. Tour Qualification:**
- How do I determine if a tour is "qualified"?
  - Is it `it_smt_detail.qualified = 1`?
  - Or `it_smt_marketing.tour_status_desc = 'SHOWN'`?
  - Or some combination?

**3. Rep Attribution:**
- Should I use `it_smt_personnel.opc_person_1_employee_id`? (Currently YES)
- How do I handle tours with multiple OPC reps? (Currently taking first non-NULL)

**4. FPS Potential:**
- Is FPS calculated per tour or per period?
- What's the formula? (Currently: `min(net_volume * 1%, $500)`)

**5. Rep Roster:**
- Do you want real employee IDs in the UI (e.g., `1590949`)?
- Or should I map them to roster IDs (e.g., `MKT-REP-001`)?

---

### Option C: Accept Current Logic, Fix Data Quality

If the **logic is correct** but **data is dirty**, I can:
1. Add validation queries to identify bad data
2. Add filters to exclude outliers (e.g., tours with net_volume > $1M)
3. Add rep name normalization (e.g., `CHEN,RACHEL` → `R. Chen`)

But I still need to know:
- What's a "reasonable" tour count per rep per month? (10? 100? 1,000?)
- What's a "reasonable" earnings range per rep per quarter? ($500-$5,000?)

---

## Files I Created for You

1. **`csv-analysis-findings.md`** — Detailed CSV analysis (they're not useful)
2. **`marketing-sql-corrections-needed.md`** — Full technical breakdown of the issues
3. **`IMMEDIATE-ACTION-NEEDED.md`** (this file) — Quick summary and action items

---

## Next Steps

**You do:** Run queries from Option A above and share results  
**I do:** Write corrected `16_materialize_marketing_core.sql` based on your data  
**Timeline:** 1-2 hours once I have the data

**Or:**

**You do:** Answer questions from Option B above  
**I do:** Write SQL based on your business rules  
**Timeline:** 30 minutes once I have the rules

**Choose your path and reply with either:**
- Query results (Option A) — preferred
- Business rule answers (Option B) — backup
- Data quality threshold (Option C) — if logic is already correct

---

## Questions?

Ping me with:
- Query output from Option A, or
- Answers to Option B questions, or
- "The logic is right, just filter out bad data" (Option C)

I'm ready to fix this as soon as you provide the input.
