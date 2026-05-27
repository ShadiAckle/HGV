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

interface StatementQuery {
  statement: string;
  catalog?: string;
  schema?: string;
}

const queries: StatementQuery[] = [
  { statement: "SHOW TABLES IN serving", catalog: "system" },
  { statement: "SHOW TABLES IN ai", catalog: "system" }
];

async function run() {
  for (const q of queries) {
    try {
      console.log(`Running statement: "${q.statement}" inside catalog "${q.catalog || 'default'}"`);
      const execBody = await wsClient.statementExecution.executeStatement({
        warehouse_id: warehouseId,
        statement: q.statement,
        catalog: q.catalog,
        schema: q.schema,
        wait_timeout: '50s',
        on_wait_timeout: 'CANCEL',
      });
      console.log("Statement state:", execBody.status?.state);
      if (execBody.result?.data_array) {
        console.log("Result rows:", execBody.result.data_array.length);
        console.log("Sample rows:", JSON.stringify(execBody.result.data_array, null, 2));
      } else {
        console.log("Result structure:", JSON.stringify(execBody, null, 2));
      }
    } catch (err: any) {
      console.error("Query failed with error:", err.message || err);
    }
    console.log("-----------------------------------------");
  }
}
run();
