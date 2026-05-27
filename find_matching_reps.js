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
  try {
    const johnson = await runSql(`SELECT rep_id, rep_name, level_code, team_id, is_active FROM workspace.hgv_comp.dim_rep WHERE LOWER(rep_name) LIKE '%johnson%'`);
    console.log("Matching 'johnson' reps:");
    console.log(johnson);

    const shadi = await runSql(`SELECT rep_id, rep_name, level_code, team_id, is_active FROM workspace.hgv_comp.dim_rep WHERE LOWER(rep_name) LIKE '%shadi%'`);
    console.log("Matching 'shadi' reps:");
    console.log(shadi);

    const count = await runSql(`SELECT COUNT(*) FROM workspace.hgv_comp.dim_rep`);
    console.log("Total reps in dim_rep:", count[0][0]);
  } catch (err) {
    console.error("Query failed:", err);
  }
}
run();
