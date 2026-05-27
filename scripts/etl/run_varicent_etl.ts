// CLI Runner script to test and execute the Varicent ETL pipeline
// Usage: tsx scripts/etl/run_varicent_etl.ts [--dry-run]

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getWorkspaceClient } from '@databricks/appkit';
import { processEtlRecords, generateIngestionSql } from './varicent_etl_processor';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env explicitly if running locally
const envPath = join(__dirname, '..', '..', '.env');
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const parts = line.split('=');
    if (parts.length >= 2) {
      process.env[parts[0].trim()] = parts.slice(1).join('=').trim();
    }
  }
}

const dryRun = process.argv.includes('--dry-run');
const warehouseId = process.env.DATABRICKS_WAREHOUSE_ID;

if (!dryRun && !warehouseId) {
  console.error("❌ Error: DATABRICKS_WAREHOUSE_ID env variable is required unless --dry-run is specified");
  process.exit(1);
}

const wsClient = dryRun ? null : getWorkspaceClient({});

async function executeSql(statement: string) {
  if (!wsClient || !warehouseId) return;
  const result = await wsClient.statementExecution.executeStatement({
    warehouse_id: warehouseId,
    statement,
    wait_timeout: '30s',
    on_wait_timeout: 'CANCEL',
  });

  if (result.status?.state === 'FAILED') {
    throw new Error(result.status?.error?.message ?? 'SQL Execution Failed');
  }
  return result;
}

const mockExportsDir = join(__dirname, '..', '..', 'data', 'comp', 'varicent_mock_exports');

const pipelines = [
  { type: "payees", file: "payees_export.csv" },
  { type: "deals", file: "deals_export.json" },
  { type: "payouts", file: "payouts_export.csv" }
] as const;

async function run() {
  console.log("=====================================================================");
  console.log(`🌀 HGV Compensation Hub — Varicent ETL Ingestion ${dryRun ? '(DRY-RUN)' : ''}`);
  console.log("=====================================================================");

  for (const pipeline of pipelines) {
    const filePath = join(mockExportsDir, pipeline.file);
    if (!existsSync(filePath)) {
      console.warn(`⚠️ Warning: Mock export file not found: ${filePath}. Skipping.`);
      continue;
    }

    console.log(`\n📥 Pipeline: ${pipeline.type.toUpperCase()} (Source: ${pipeline.file})`);
    const rawText = readFileSync(filePath, 'utf8');

    try {
      // 1. Process and Map
      const report = processEtlRecords(pipeline.type, rawText);
      console.log(`   └─ Pre-flight Parse: Mapped ${report.validCount} rows successfully.`);
      
      if (report.invalidCount > 0) {
        console.warn(`   └─ ⚠️ Warnings: ${report.invalidCount} rows contained mapping/constraint errors.`);
        report.preflight.forEach(p => {
          if (p.rowsInvalid > 0) {
            console.warn(`      - Table: ${p.table} - ${p.rowsInvalid} rows failed validation:`);
            p.logs.slice(0, 3).forEach(log => {
              console.warn(`        [Row ${log.row}] ${log.message}`);
            });
          }
        });
      }

      // 2. Generate SQL and Execute
      for (const target of report.targets) {
        const sqls = generateIngestionSql(target);
        console.log(`   └─ SQL Generator: Created ${sqls.length} statements for table ${target.table} [Mode: ${target.mode}]`);
        
        if (dryRun) {
          sqls.forEach((stmt, i) => {
            console.log(`      [Dry-Run SQL #${i+1}] ${stmt.trim().slice(0, 180)}...`);
          });
        } else {
          process.stdout.write(`   └─ Ingesting to Delta Lake: `);
          let index = 1;
          for (const stmt of sqls) {
            await executeSql(stmt);
            process.stdout.write(`${index}/${sqls.length} `);
            index++;
          }
          console.log(`✅ Success!`);
        }
      }
    } catch (err: any) {
      console.error(`❌ Ingestion failed for ${pipeline.type}: ${err.message}`);
      if (!dryRun) process.exit(1);
    }
  }

  console.log("\n=====================================================================");
  console.log(`🎉 Varicent Ingestion Run Complete! ${dryRun ? 'No changes made.' : 'Unity Catalog updated.'}`);
  console.log("=====================================================================");
}

run();
