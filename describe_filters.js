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
    const desc = await runSql(`DESCRIBE TABLE EXTENDED workspace.hgv_comp.dim_rep`);
    console.log("DESCRIBE TABLE EXTENDED:");
    for (const r of desc) {
      console.log(`${r[0]} | ${r[1]} | ${r[2]}`);
    }
  } catch (err) {
    console.error("Describe failed:", err);
  }
}
run();
