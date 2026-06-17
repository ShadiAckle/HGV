# Cognos Schema Diagnostic Queries

Run these SQL files in Databricks to validate the corrected marketing compensation SQL.

## Files

1. **`diagnostic_1_tour_status.sql`** - Tour status distribution
   - Shows all `tour_status_desc` values and their frequencies
   - **Look for:** "Show", "No Show", "Show - No tour", "Cancel"

2. **`diagnostic_2_multi_rep.sql`** - Multi-rep tour analysis
   - Shows how many tours have 1 rep, 2 reps, 3+ reps
   - **Look for:** % of tours with multiple OPC reps

3. **`diagnostic_3_sample_tours.sql`** - Sample tours with full context
   - Shows 50 example tours with all fields
   - **Includes:** Calculated payout and FPS based on corrected logic
   - **Look for:** Realistic values, correct rep names

4. **`diagnostic_4_top_reps.sql`** - Top 20 reps by volume
   - Shows estimated earnings for top reps
   - **Look for:** Earnings in $5K-$20K range (not millions)

5. **`diagnostic_5_stats_summary.sql`** - Overall statistics
   - High-level metrics (total tours, unique reps, etc.)
   - **Look for:** Data completeness issues

## How to Run

### Option 1: Databricks SQL Editor (Recommended)
1. Open Databricks workspace
2. Go to SQL Editor
3. Copy/paste each query
4. Run and save results

### Option 2: Databricks CLI
```bash
databricks sql execute --profile hgv-premium --file scripts/diagnostic_1_tour_status.sql
databricks sql execute --profile hgv-premium --file scripts/diagnostic_2_multi_rep.sql
databricks sql execute --profile hgv-premium --file scripts/diagnostic_3_sample_tours.sql
databricks sql execute --profile hgv-premium --file scripts/diagnostic_4_top_reps.sql
databricks sql execute --profile hgv-premium --file scripts/diagnostic_5_stats_summary.sql
```

## What to Look For

### Query 1: Tour Status
- [ ] Most common status is "Show" or "2,Show"
- [ ] "No Show" / "3,No Show" and "Cancel" / "5,Cancel" present
- [ ] "Show - No tour" / "4,Show - No tour" exists (courtesy tours)
- [ ] No unexpected status values

### Query 2: Multi-Rep
- [ ] >90% of tours have exactly 1 rep
- [ ] <10% have 2+ reps
- [ ] If high % multi-rep, need to validate first-rep logic

### Query 3: Sample Tours
- [ ] Rep names look correct (e.g., "CHEN,RACHEL")
- [ ] `calculated_payout` is $0, $20, or $75 (no $35)
- [ ] `calculated_fps` is $0 or $250
- [ ] `contract_qualified` = 1 when `calculated_fps` = $250

### Query 4: Top Reps
- [ ] `estimated_total_earnings` in $5K-$20K range (for 1 month)
- [ ] Top rep has 50-200 tours
- [ ] `contract_qualified_count` is small % of `tour_count` (5-15%)

### Query 5: Stats
- [ ] Total tours ~10K-20K for April 2026
- [ ] >95% of tours have OPC rep assigned
- [ ] 100-300 unique OPC reps
- [ ] Multi-rep tours are <10% of total

## Next Steps

After running diagnostics:
1. Share results with the agent
2. Validate assumptions in corrected SQL
3. Run corrected SQL: `data/comp/edw_dev_hris/16_materialize_marketing_core_CORRECTED.sql`
4. Compare results to mock data expectations
