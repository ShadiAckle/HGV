# GitHub Actions Setup for Cognos Diagnostics

## Overview
The diagnostic workflow (`diagnose-cognos-schema.yml`) runs SQL queries against your Databricks environment to extract live Cognos schema data for analysis.

## Required GitHub Secrets

You need to add two secrets to your GitHub repository:

### 1. Navigate to GitHub Secrets
Go to: **https://github.com/ShadiAckle/HGV/settings/secrets/actions**

### 2. Add DATABRICKS_HOST
- Click **"New repository secret"**
- Name: `DATABRICKS_HOST`
- Value: Your Databricks workspace URL
  - Example: `https://your-workspace.cloud.databricks.com`
  - **Important**: Include `https://` and do NOT include trailing slash
  
### 3. Add DATABRICKS_TOKEN
- Click **"New repository secret"**
- Name: `DATABRICKS_TOKEN`
- Value: Your Databricks Personal Access Token
  - Generate from your workspace: **User Settings → Developer → Access Tokens**
  - Token must have permissions to:
    - Execute SQL queries on the warehouse
    - Access the `edw_dev_cognos.cognos_fm` catalog/schema

## Running the Workflow

### Option 1: Via GitHub UI
1. Go to: **https://github.com/ShadiAckle/HGV/actions/workflows/diagnose-cognos-schema.yml**
2. Click **"Run workflow"**
3. (Optional) Override inputs:
   - `warehouse_id`: Your SQL Warehouse ID (default: auto-detected)
   - `profile`: Databricks CLI profile name (default: `hgv-premium`)
4. Click **"Run workflow"** button

### Option 2: Via GitHub CLI
```bash
gh workflow run diagnose-cognos-schema.yml \
  --repo ShadiAckle/HGV \
  --field warehouse_id=your-warehouse-id \
  --field profile=hgv-premium
```

### Option 3: Via API (PowerShell)
```powershell
$headers = @{
    'Authorization' = 'token YOUR_PAT_HERE'
    'Accept' = 'application/vnd.github.v3+json'
}
$body = @{
    'ref' = 'main'
    'inputs' = @{
        'warehouse_id' = 'your-warehouse-id'
        'profile' = 'hgv-premium'
    }
} | ConvertTo-Json

Invoke-RestMethod `
  -Uri 'https://api.github.com/repos/ShadiAckle/HGV/actions/workflows/diagnose-cognos-schema.yml/dispatches' `
  -Method Post `
  -Headers $headers `
  -Body $body `
  -ContentType 'application/json'
```

## Output

The workflow will:
1. Run 5 diagnostic queries against live Cognos 2026 data
2. Save results as CSV files in `diagnostic-results/` directory
3. Upload results as GitHub Actions artifacts (accessible for 30 days)

### Downloading Results
1. Go to the workflow run page
2. Scroll to **"Artifacts"** section at the bottom
3. Download **"cognos-diagnostic-results"** zip file
4. Extract and review the CSV files:
   - `query1-tour-status.csv` - Tour status distribution
   - `query2-personnel-dedupe.csv` - Personnel deduplication patterns
   - `query3-multi-rep.csv` - Examples of multi-rep tours
   - `query4-sample-tours.csv` - Sample tours with full context
   - `query5-top-reps.csv` - Top rep aggregation summary

## What's Next?

Once you have the diagnostic results:
1. Review the CSV files to understand the live Cognos schema
2. Use insights to finalize SQL corrections in `16_materialize_marketing_core.sql`
3. The corrected SQL will properly map:
   - `tour_status_desc` → Payout tiers ($75/$20)
   - Multi-rep tours → Primary rep attribution
   - Contract vs. tour qualification → Accurate FPS calculation

## Troubleshooting

### Workflow fails with "Missing GitHub Secrets"
- Ensure both `DATABRICKS_HOST` and `DATABRICKS_TOKEN` are set in GitHub repository secrets
- Check that the token hasn't expired

### Workflow fails with "workspace access" error
- Verify the token has correct permissions
- Ensure the workspace URL is correct (with `https://`)

### Query timeout errors
- The queries are optimized for 2026-04 data window
- If still timing out, contact Databricks admin to check warehouse size

### "databricks sql" command errors
- This uses the modern Databricks CLI syntax (not legacy `databricks-cli`)
- Workflow installs `databricks-cli==0.18.0` automatically

## Local Execution (Alternative)

If you prefer to run locally instead of GitHub Actions:

```bash
# On your VDI machine (with RDP access)
cd c:\Users\Shadi\Desktop\databricks_ai\hilton-kb-chat
bash scripts/run-diagnostics-local.sh
```

This requires:
- Databricks CLI configured locally (`~/.databrickscfg` with `hgv-premium` profile)
- Access to the VDI machine
