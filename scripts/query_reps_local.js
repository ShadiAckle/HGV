import { getWorkspaceClient } from '@databricks/appkit';
import * as fs from 'fs';
import * as path from 'path';

const envPath = path.resolve(import.meta.dirname, '../.env');
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
  const execBody = await wsClient.statementExecution.executeStatement({
    warehouse_id: warehouseId,
    statement,
    wait_timeout: '30s',
    on_wait_timeout: 'CANCEL',
  });
  if (execBody.status?.state === 'FAILED') {
    throw new Error(execBody.status?.error?.message ?? 'SQL failed');
  }
  const columns = (execBody.manifest?.schema?.columns ?? []).map((c) => c.name);
  const rows = execBody.result?.data_array ?? [];
  return rows.map((row) => Object.fromEntries(columns.map((col, i) => [col, row[i]])));
}

async function testAll() {
  const queries = {
    reps: `
      SELECT rep_id, rep_name, level_code, team_id, region, is_active
      FROM workspace.hgv_comp.dim_rep
      ORDER BY rep_name
    `,
    teams: `
      SELECT team_id, team_name, region
      FROM workspace.hgv_comp.dim_team
      ORDER BY team_name
    `,
    periods: `
      SELECT period_id, period_label, is_current
      FROM workspace.hgv_comp.dim_period
      ORDER BY period_start DESC
    `,
    scenarios: `
      SELECT scenario_id, scenario_name, period_id
      FROM workspace.hgv_comp.scenario_run
      ORDER BY scenario_id
    `,
    deals: `
      SELECT deal_id, rep_id, credit_amount AS amount, credit_status AS status, property_display_name AS description
      FROM workspace.hgv_comp.fact_deal_credit
      LIMIT 25
    `
  };

  for (const [name, sql] of Object.entries(queries)) {
    try {
      console.log(`Running query [${name}]...`);
      const res = await runSql(sql);
      console.log(`Query [${name}] succeeded, returned ${res.length} rows.`);
      if (res.length > 0) {
        console.log(`Sample row from [${name}]:`, res[0]);
      }
    } catch (err) {
      console.error(`Query [${name}] FAILED:`, err.message);
    }
  }
}

testAll();
