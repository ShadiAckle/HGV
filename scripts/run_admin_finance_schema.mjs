// Run new schema tables + seed data for Comp Admin + Finance agents
// Usage: node scripts/run_admin_finance_schema.mjs

import { getWorkspaceClient } from '@databricks/appkit';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const envPath = join(dirname(fileURLToPath(import.meta.url)), '../.env');
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const parts = line.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim();
      process.env[key] = val;
    }
  }
}

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

function splitSqlStatements(sql) {
  const statements = [];
  let current = '';
  let inString = false;
  let inDoubleQuote = false;
  let inComment = false;
  let i = 0;
  
  while (i < sql.length) {
    const char = sql[i];
    const nextChar = sql[i + 1];
    
    // Handle comments starting with --
    if (!inString && !inDoubleQuote && char === '-' && nextChar === '-') {
      inComment = true;
      i += 2;
      continue;
    }
    
    if (inComment) {
      if (char === '\n' || char === '\r') {
        inComment = false;
        // Keep the newline character so we don't accidentally merge adjacent tokens
        current += '\n';
      }
      i++;
      continue;
    }
    
    // Handle string literals with single quotes
    if (char === "'" && !inDoubleQuote) {
      // Check for escaped quote ''
      if (inString && nextChar === "'") {
        current += "''";
        i += 2;
        continue;
      }
      inString = !inString;
      current += char;
      i++;
      continue;
    }
    
    // Handle double quotes
    if (char === '"' && !inString) {
      inDoubleQuote = !inDoubleQuote;
      current += char;
      i++;
      continue;
    }
    
    // Handle semicolon separator
    if (char === ';' && !inString && !inDoubleQuote) {
      if (current.trim().length > 0) {
        statements.push(current.trim());
      }
      current = '';
      i++;
      continue;
    }
    
    current += char;
    i++;
  }
  
  if (current.trim().length > 0) {
    statements.push(current.trim());
  }
  
  return statements;
}

async function runFile(filePath) {
  console.log(`\nRunning: ${filePath}`);
  const sql = readFileSync(filePath, 'utf8');

  // Use robust state-machine parser to split SQL statements correctly
  const statements = splitSqlStatements(sql);

  let success = 0;
  let failed = 0;
  for (const stmt of statements) {
    try {
      await runSql(stmt);
      process.stdout.write('.');
      success++;
    } catch (err) {
      console.warn(`\n  WARN: Statement failed:\n${stmt.slice(0, 200)}...\nError: ${err.message}`);
      failed++;
    }
  }
  console.log(`\n  Done: ${success} succeeded, ${failed} warned/failed`);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', 'data', 'comp');

try {
  await runFile(join(dataDir, '05_extend_admin_finance.sql'));
  await runFile(join(dataDir, '05a_seed_admin_finance.sql'));
  console.log('\n✅ Admin + Finance schema setup complete!');
} catch (err) {
  console.error('\n❌ Fatal error:', err.message);
  process.exit(1);
}
