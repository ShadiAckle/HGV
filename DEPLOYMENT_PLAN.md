# HGV COMPENSATION HUB - FINAL DEPLOYMENT PLAN

## STATUS: ⚠️ DO NOT RUN YET - FIXES IN PROGRESS

I'm fixing the remaining TypeScript/API inconsistencies now. This will take 10 more minutes.

## WHAT NEEDS TO BE FIXED (in progress):
1. ❌ `server/compSchemaBootstrap.ts` - Rewriting entire function with correct column names
2. ❌ `server/compConfigApi.ts` - Checking/fixing all SQL statements  
3. ❌ `client/src/pages/admin/CompensationRulesPage.tsx` - Checking field references

## WHEN I'M DONE, YOU'LL RUN (in this exact order):

### Step 1: Pull latest changes in Databricks Repos UI
(I'll push all fixes to GitHub first)

### Step 2: Run SQL in Databricks SQL Editor
```sql
-- File: data/comp/edw_dev_hris/99_fix_current_state.sql
-- Creates 4 config tables + seeds default values
-- Runtime: ~30 seconds
```

### Step 3: Run materialization SQL
```sql
-- File: data/comp/edw_dev_hris/16_materialize_marketing_core_REVISED_V2.sql  
-- Populates fact_marketing_tour_payout, fact_marketing_rep_period, dim_marketing_rep
-- Runtime: ~5-10 minutes (processes 163K tours)
```

### Step 4: Restart app on VDI
```powershell
cd C:\Users\jbarso\Downloads\HGV-v1.5.1-deployment-ready
.\scripts\vdi-start.ps1
```

## TOTAL TIME: 15 minutes after I finish fixes

## GIVE ME 10 MORE MINUTES TO FIX THE REMAINING CODE
Then I'll ping you and you can run everything ONCE with confidence.
