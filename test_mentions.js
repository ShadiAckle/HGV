import { getWorkspaceClient } from '@databricks/appkit';
import * as fs from 'fs';

// Load env vars manually from .env in same directory
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
  const res = await wsClient.statementExecution.executeStatement({
    warehouse_id: warehouseId,
    statement,
    wait_timeout: '30s',
    on_wait_timeout: 'CANCEL',
  });
  if (res.status?.state === 'FAILED') {
    throw new Error(res.status?.error?.message ?? 'SQL failed');
  }
  const columns = (res.manifest?.schema?.columns ?? []).map((c) => c.name);
  const rows = res.result?.data_array ?? [];
  return rows.map((row) => Object.fromEntries(columns.map((col, i) => [col, row[i]])));
}

async function smokeTestMentions() {
  console.log("=========================================");
  console.log("SMOKE TESTING COPILOT MENTION DATABASE QUERIES");
  console.log("Warehouse ID:", warehouseId);
  console.log("=========================================\n");

  try {
    // 1. Test Autocomplete Search Query for all categories
    console.log("--- 1. Testing mentions-search logic (Autocomplete) ---");
    const repSearch = await runSql(`
      SELECT rep_id, rep_name, level_code, region
      FROM workspace.hgv_comp.dim_rep
      WHERE is_active = true
      LIMIT 3
    `);
    console.log(`Autocomplete Reps retrieved: ${repSearch.length}`);
    repSearch.forEach(r => console.log(`  - @rep:${r.rep_id} (${r.rep_name}, ${r.level_code})`));

    const teamSearch = await runSql(`
      SELECT team_id, team_name, region
      FROM workspace.hgv_comp.dim_team
      LIMIT 3
    `);
    console.log(`\nAutocomplete Teams retrieved: ${teamSearch.length}`);
    teamSearch.forEach(t => console.log(`  - @team:${t.team_id} (${t.team_name})`));

    const scenarioSearch = await runSql(`
      SELECT scenario_id, scenario_name, period_id
      FROM workspace.hgv_comp.scenario_run
      LIMIT 3
    `);
    console.log(`\nAutocomplete Scenarios retrieved: ${scenarioSearch.length}`);
    scenarioSearch.forEach(s => console.log(`  - @scenario:${s.scenario_id} (${s.scenario_name})`));

    const dealSearch = await runSql(`
      SELECT deal_id, property_display_name AS description, credit_amount AS amount, credit_status AS status
      FROM workspace.hgv_comp.fact_deal_credit
      LIMIT 3
    `);
    console.log(`\nAutocomplete Deals retrieved: ${dealSearch.length}`);
    dealSearch.forEach(d => console.log(`  - @deal:${d.deal_id} (${d.description ?? 'Deal'})`));

    console.log("\n--- 2. Testing mentions-lookup logic (Data grounding) ---");

    // 2. Test Rep lookup query
    if (repSearch.length > 0) {
      const repId = repSearch[0].rep_id;
      console.log(`\nLooking up @rep:${repId}...`);
      const repInfo = await runSql(`
        SELECT r.rep_id, r.rep_name, r.level_code, r.team_id, r.manager_rep_id, r.region, r.is_active
        FROM workspace.hgv_comp.dim_rep r
        WHERE r.rep_id = '${repId}'
      `);
      const payouts = await runSql(`
        SELECT base_pay, commission, bonus, total_earnings, total_paid AS paid_to_date
        FROM workspace.hgv_comp.fact_payout
        WHERE rep_id = '${repId}'
      `);
      const quotas = await runSql(`
        SELECT quota_amount, credited_amount, attainment_pct AS quota_attainment_pct, deals_closed_count
        FROM workspace.hgv_comp.fact_quota_attainment
        WHERE rep_id = '${repId}'
      `);
      console.log("Rep Lookup Result Object:");
      console.log(JSON.stringify({
        profile: repInfo[0] || null,
        earnings: payouts[0] || null,
        quota: quotas[0] || null
      }, null, 2));
    }

    // 3. Test Team lookup query
    if (teamSearch.length > 0) {
      const teamId = teamSearch[0].team_id;
      console.log(`\nLooking up @team:${teamId}...`);
      const teamInfo = await runSql(`
        SELECT team_id, team_name, region
        FROM workspace.hgv_comp.dim_team
        WHERE team_id = '${teamId}'
      `);
      const stats = await runSql(`
        SELECT team_attainment_pct AS avg_quota_attainment_pct, top_performer_count AS top_performers_count, at_risk_count, ffs_sales_pct, ffs_target_pct
        FROM workspace.hgv_comp.fact_team_snapshot
        WHERE team_id = '${teamId}'
      `);
      console.log("Team Lookup Result Object:");
      console.log(JSON.stringify({
        team: teamInfo[0] || null,
        stats: stats[0] || null
      }, null, 2));
    }

    // 4. Test Scenario lookup query
    if (scenarioSearch.length > 0) {
      const scenarioId = scenarioSearch[0].scenario_id;
      console.log(`\nLooking up @scenario:${scenarioId}...`);
      const scenarioInfo = await runSql(`
        SELECT scenario_id, scenario_name, period_id, quota_change_pct, commission_rate_pct, bonus_rate_change_pct, accelerator_change_pct, created_by
        FROM workspace.hgv_comp.scenario_run
        WHERE scenario_id = '${scenarioId}'
      `);
      const resultsData = await runSql(`
        SELECT projected_payouts, budget_impact, projected_cost, expected_performance_pct
        FROM workspace.hgv_comp.scenario_result
        WHERE scenario_id = '${scenarioId}'
      `);
      console.log("Scenario Lookup Result Object:");
      console.log(JSON.stringify({
        scenario: scenarioInfo[0] || null,
        results: resultsData[0] || null
      }, null, 2));
    }

    // 5. Test Deal lookup query
    if (dealSearch.length > 0) {
      const dealId = dealSearch[0].deal_id;
      console.log(`\nLooking up @deal:${dealId}...`);
      const dealInfo = await runSql(`
        SELECT deal_id, rep_id, period_id, product_line_id AS product_id, property_code AS sku,
               property_display_name AS description,
               credit_amount AS amount,
               credit_status AS status,
               credit_date AS close_date
        FROM workspace.hgv_comp.fact_deal_credit
        WHERE deal_id = '${dealId}'
      `);
      console.log("Deal Lookup Result Object:");
      console.log(JSON.stringify(dealInfo[0] || null, null, 2));
    }

    console.log("\n=========================================");
    console.log("SMOKE TEST COMPLETED SUCCESSFULLY!");
    console.log("All mention schemas and columns parsed perfectly!");
    console.log("=========================================");

  } catch (err) {
    console.error("\n[CRITICAL ERROR] Smoke test failed:", err);
  }
}

smokeTestMentions();
