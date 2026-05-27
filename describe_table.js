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

async function run() {
  try {
    console.log("Querying warehouse id:", warehouseId);
    
    const sql1 = `
      DESCRIBE QUERY SELECT
        deal_id,
        credit_date AS close_date,
        property_display_name AS description,
        credit_amount AS contract_volume,
        credit_amount AS commission_earned,
        credit_status AS status
      FROM workspace.hgv_comp.fact_deal_credit
      WHERE rep_id = ''
        AND period_id = ''
      ORDER BY close_date DESC
    `;
    const res1 = await wsClient.statementExecution.executeStatement({
      warehouse_id: warehouseId,
      statement: sql1,
      wait_timeout: '30s',
      on_wait_timeout: 'CANCEL',
    });
    console.log("Result 1 State:", res1.status.state);
    if (res1.status.error) console.log("Result 1 Error:", res1.status.error);

    const sql2 = `
      DESCRIBE QUERY SELECT
        month(credit_date) as month_num,
        date_format(credit_date, 'MMM') as month_name,
        sum(credit_amount) as monthly_sales,
        sum(credit_amount) as monthly_credit
      FROM workspace.hgv_comp.fact_deal_credit
      WHERE rep_id = ''
      GROUP BY 1, 2
      ORDER BY month_num
    `;
    const res2 = await wsClient.statementExecution.executeStatement({
      warehouse_id: warehouseId,
      statement: sql2,
      wait_timeout: '30s',
      on_wait_timeout: 'CANCEL',
    });
    console.log("Result 2 State:", res2.status.state);
    if (res2.status.error) console.log("Result 2 Error:", res2.status.error);
    
  } catch (err) {
    console.error("Query failed:", err);
  }
}
run();
