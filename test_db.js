import { getWorkspaceClient } from '@databricks/appkit';
import * as fs from 'fs';

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

async function run() {
  try {
    const execBody = await wsClient.statementExecution.executeStatement({
      warehouse_id: warehouseId,
      statement: `
        SELECT team_id, team_name, region
        FROM workspace.hgv_comp.dim_team
      `,
      wait_timeout: '30s',
      on_wait_timeout: 'CANCEL',
    });
    console.log("Statement state:", execBody.status?.state);
    if (execBody.status?.state === 'FAILED') {
      console.error("Error detail:", JSON.stringify(execBody.status.error));
    }
    console.log("Data array:", JSON.stringify(execBody.result?.data_array));
  } catch (err) {
    console.error("Query failed with error:", err.message || err);
  }
}
run();
