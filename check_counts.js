import { getWorkspaceClient } from '@databricks/appkit';
import * as fs from 'fs';

// Load env vars manually
const envPath = './.env';
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const parts = line.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim();
      process.env[key] = val;
    }
  }
}

const wsClient = getWorkspaceClient({});
const warehouseId = process.env.DATABRICKS_WAREHOUSE_ID;

async function runSql(statement) {
  const result = await wsClient.statementExecution.executeStatement({
    warehouse_id: warehouseId,
    statement,
    wait_timeout: '30s',
    on_wait_timeout: 'CANCEL',
  });
  if (result.status?.state === 'FAILED') {
    throw new Error(result.status?.error?.message ?? 'SQL failed');
  }
  return result.result?.data_array ?? [];
}

async function run() {
  const tables = [
    'dim_rep',
    'dim_team',
    'dim_period',
    'dim_plan_version',
    'dim_product_line',
    'fact_quota_attainment',
    'fact_payout',
    'fact_deal_credit',
    'fact_team_snapshot',
    'fact_rep_product_mix',
    'fact_plan_eligibility',
    'fact_comp_admin_log',
    'fact_chargeback',
    'fact_tour_quality',
    'scenario_run',
    'scenario_result',
    'scenario_payout_series'
  ];

  console.log("Database status check on warehouse:", warehouseId);
  for (const t of tables) {
    try {
      const res = await runSql(`SELECT COUNT(*) FROM workspace.hgv_comp.${t}`);
      console.log(`Table workspace.hgv_comp.${t}: ${res[0][0]} rows`);
      if (t === 'dim_rep') {
        const reps = await runSql(`SELECT rep_id, rep_name, level_code FROM workspace.hgv_comp.dim_rep LIMIT 10`);
        console.log(`Sample reps:`, reps.map(r => `${r[0]} (${r[1]}, ${r[2]})`).join(', '));
      }
    } catch (err) {
      console.log(`Table workspace.hgv_comp.${t}: ERROR: ${err.message}`);
    }
  }
}
run();
