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

const queries = [
  "SELECT ai_query('databricks-claude-sonnet-4', 'Confirm you are online and tell me your model name') as response",
  "SELECT ai_query('databricks-meta-llama-3-3-70b-instruct', 'Confirm you are online') as response"
];

async function run() {
  for (const statement of queries) {
    try {
      console.log(`Running statement:\n${statement}`);
      const execBody = await wsClient.statementExecution.executeStatement({
        warehouse_id: warehouseId,
        statement,
        wait_timeout: '50s',
        on_wait_timeout: 'CANCEL',
      });
      console.log("Statement state:", execBody.status?.state);
      console.log("Result:", JSON.stringify(execBody.result?.data_array || execBody, null, 2));
    } catch (err: any) {
      console.error("Query failed with error:", err.message || err);
    }
    console.log("-----------------------------------------");
  }
}
run();
