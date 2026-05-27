// Run new schema tables + seed data for Comp Admin + Finance agents
// Usage: node --experimental-vm-modules run_admin_finance_schema.mjs

import { getWorkspaceClient } from '@databricks/appkit';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const warehouseId = process.env.DATABRICKS_WAREHOUSE_ID;
if (!warehouseId) throw new Error('DATABRICKS_WAREHOUSE_ID env var is required');

const wsClient = getWorkspaceClient({});

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
  return result;
}

async function runFile(filePath) {
  console.log(`\nRunning: ${filePath}`);
  const sql = readFileSync(filePath, 'utf8');

  // Filter out lines that are comments
  const cleanSql = sql
    .split('\n')
    .filter(line => !line.trim().startsWith('--'))
    .join('\n');

  // Split by semicolon, respecting single quotes
  const statements = [];
  let current = '';
  let inString = false;
  let escape = false;

  for (let i = 0; i < cleanSql.length; i++) {
    const char = cleanSql[i];
    if (char === "'" && !escape) {
      inString = !inString;
    }
    if (char === "\\" && inString) {
      escape = !escape;
    } else {
      escape = false;
    }

    if (char === ';' && !inString) {
      statements.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim().length > 5) {
    statements.push(current.trim());
  }

  let success = 0;
  let failed = 0;
  for (const stmt of statements) {
    if (stmt.length < 5) continue;
    try {
      await runSql(stmt);
      process.stdout.write('.');
      success++;
    } catch (err) {
      console.warn(`\n  WARN: ${err.message?.slice(0, 120)}`);
      failed++;
    }
  }
  console.log(`\n  Done: ${success} succeeded, ${failed} warned/failed`);
}

const dataDir = join(__dirname, 'data', 'comp');

try {
  await runFile(join(dataDir, '05_extend_admin_finance.sql'));
  await runFile(join(dataDir, '05a_seed_admin_finance.sql'));
  console.log('\n✅ Admin + Finance schema setup complete!');
} catch (err) {
  console.error('\n❌ Fatal error:', err.message);
  process.exit(1);
}
