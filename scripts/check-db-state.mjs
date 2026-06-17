#!/usr/bin/env node
/**
 * Check current database state on VDI
 */
import { WorkspaceClient } from '@databricks/sdk';

const client = new WorkspaceClient({
  host: 'https://adb-7405610243855520.0.azuredatabricks.net',
  authType: 'databricks-cli',
});

const warehouseId = '9e9c06ad1c397404';

async function checkState() {
  try {
    // Check what tables exist
    console.log('Checking tables in edw_dev_hris.hgv_comp...\n');
    
    const result = await client.statementExecution.executeStatement({
      warehouse_id: warehouseId,
      statement: 'SHOW TABLES IN edw_dev_hris.hgv_comp',
      wait_timeout: '30s',
    });
    
    const tables = result.result?.data_array || [];
    console.log('Existing tables:');
    tables.forEach(row => {
      const [db, name, isTemp] = row;
      console.log(`  - ${name} (type: ${isTemp ? 'TEMP' : 'TABLE/VIEW'})`);
    });
    
    // Check if config tables exist
    console.log('\n\nChecking for config tables...');
    const configTables = ['dim_tour_status_config', 'dim_comp_rule_config', 'dim_rep_filter_config', 'fact_comp_config_audit_log'];
    
    for (const table of configTables) {
      try {
        const check = await client.statementExecution.executeStatement({
          warehouse_id: warehouseId,
          statement: `SELECT COUNT(*) as cnt FROM edw_dev_hris.hgv_comp.${table} LIMIT 1`,
          wait_timeout: '10s',
        });
        const count = check.result?.data_array?.[0]?.[0] || 0;
        console.log(`  ✓ ${table} exists (${count} rows)`);
      } catch (err) {
        console.log(`  ✗ ${table} does NOT exist`);
      }
    }
    
    // Check fact_marketing_chargeback
    console.log('\n\nChecking fact_marketing_chargeback...');
    try {
      const check = await client.statementExecution.executeStatement({
        warehouse_id: warehouseId,
        statement: `DESCRIBE TABLE edw_dev_hris.hgv_comp.fact_marketing_chargeback`,
        wait_timeout: '10s',
      });
      console.log('  ✓ fact_marketing_chargeback exists');
      console.log('  Type:', check.result?.data_array?.[0]?.[1]);
    } catch (err) {
      console.log('  ✗ fact_marketing_chargeback does NOT exist');
      console.log('  Error:', err.message);
    }
    
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

checkState();
