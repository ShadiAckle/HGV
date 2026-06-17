# Complete Database Setup - Run These 2 Files IN ORDER

This is the FULL sweep solution. Schema now matches app expectations.

## What Was Fixed

**Schema Alignment**: All tables now use the app's expected column names:
- `rep_id` (not `rep_employee_id`)
- `period_id` (not `period_start`)
- `team_id` (not `rep_team_code`)

**Missing columns added** to `dim_marketing_rep`:
- `level_code`, `manager_rep_id`, `region`, `is_active`

## What These Scripts Do

### 00_CLEAN_AND_REBUILD.sql
- Drops ALL existing views (views block table creation)
- Drops ALL existing tables
- Creates ALL config tables (dim_tour_status_config, dim_comp_rule_config, etc.)
- Seeds default config data
- Grants permissions

### 01_MATERIALIZE_ALL_TABLES.sql
- Creates ALL fact and dimension tables with correct column names
- Materializes marketing compensation data
- Creates convenience views

## Run Instructions

**In Databricks SQL Editor, run these TWO files in order:**

1. Run `data/comp/edw_dev_hris/00_CLEAN_AND_REBUILD.sql` first
   - Wait for it to complete (should be fast, < 1 minute)
   
2. Run `data/comp/edw_dev_hris/01_MATERIALIZE_ALL_TABLES.sql` second
   - This will take 10-15 minutes (it scans large Cognos tables)

## After SQL Completes

Start the app:

```powershell
cd C:\Users\jbarso\Downloads\HGV-v1.5.1-deployment-ready
.\scripts\vdi-start.ps1
```

The app should start without errors.

## What Gets Created

**Config Tables:**
- dim_tour_status_config (tour status → payout mapping)
- dim_comp_rule_config (global comp rules)
- dim_rep_filter_config (rep inclusion/exclusion)
- fact_comp_config_audit_log (change tracking)
- fact_marketing_chargeback
- fact_marketing_arrival

**Core Tables:**
- _stg_marketing_tour_detail (staging)
- _stg_tour_enriched (staging with personnel)
- fact_marketing_tour_payout (tour-level payouts)
- dim_marketing_rep (rep dimension)
- fact_marketing_rep_period (period rollup)
- dim_period (period dimension)
- dim_rep (unified rep dimension)

**Views:**
- fact_marketing_rep_metric (convenience view for API)

## Expected Row Counts

After completion, you should see:
- fact_marketing_tour_payout: ~233K rows (2026 tours)
- dim_marketing_rep: ~9,265 unique reps
- fact_marketing_rep_period: ~37K rows (reps × quarters)

No more view conflicts. No more column errors. Full sweep done.
