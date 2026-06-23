#!/usr/bin/env node
/**
 * Run ad-hoc SQL on the HGV warehouse for Cursor agent / local diagnostics.
 * Uses the same auth as the app: DATABRICKS_CONFIG_PROFILE + CLI OAuth (no PAT).
 *
 * Usage:
 *   node scripts/agent-warehouse-query.mjs "SELECT 1 AS ok"
 *   node scripts/agent-warehouse-query.mjs --file data/comp/edw_dev_hris/99_diagnostic_guest_names.sql
 *   node scripts/agent-warehouse-query.mjs --file query.sql --out data/comp/diagnostics/guest_names.json
 *
 * Requires: npm install, databricks auth login --profile hgv-edw, .env with warehouse id.
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { getWorkspaceClient } from '@databricks/appkit';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, '..');

function loadDotEnv() {
  const envPath = join(root, '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 1) continue;
    const key = t.slice(0, eq).trim();
    const val = t.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

function parseArgs(argv) {
  let file = null;
  let out = null;
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--file' || a === '-f') file = argv[++i];
    else if (a === '--out' || a === '-o') out = argv[++i];
    else if (a === '--help' || a === '-h') {
      console.log(`Usage: node scripts/agent-warehouse-query.mjs [--file path.sql] [--out path.json] "SQL"`);
      process.exit(0);
    } else positional.push(a);
  }
  return { file, out, sql: positional.join(' ').trim() };
}

function stripSqlComments(sql) {
  return sql
    .split('\n')
    .filter((line) => !/^\s*--/.test(line))
    .join('\n')
    .trim();
}

function splitStatements(sql) {
  const cleaned = stripSqlComments(sql);
  if (!cleaned) return [];
  return cleaned
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
}

async function executeOne(wsClient, warehouseId, statement) {
  const started = Date.now();
  const result = await wsClient.statementExecution.executeStatement({
    warehouse_id: warehouseId,
    statement,
    wait_timeout: '120s',
  });
  const cols = (result.manifest?.schema?.columns ?? []).map((c) => c.name);
  const rows = (result.result?.data_array ?? []).map((row) => {
    const obj = {};
    cols.forEach((name, i) => {
      obj[name] = row[i];
    });
    return obj;
  });
  return {
    statement: statement.slice(0, 500),
    row_count: rows.length,
    columns: cols,
    rows,
    elapsed_ms: Date.now() - started,
    status: result.status?.state ?? 'UNKNOWN',
  };
}

async function main() {
  loadDotEnv();

  const profile = process.env.DATABRICKS_CONFIG_PROFILE || 'hgv-edw';
  if (!process.env.DATABRICKS_CONFIG_PROFILE) {
    process.env.DATABRICKS_CONFIG_PROFILE = profile;
  }

  const warehouseId = process.env.DATABRICKS_WAREHOUSE_ID || '9e9c06ad1c397404';
  const { file, out, sql: inlineSql } = parseArgs(process.argv.slice(2));

  let sql = inlineSql;
  if (file) {
    const path = resolve(root, file);
    if (!existsSync(path)) {
      console.error(`File not found: ${path}`);
      process.exit(1);
    }
    sql = readFileSync(path, 'utf8');
  }

  if (!sql) {
    console.error('Provide SQL as an argument or --file path.sql');
    process.exit(1);
  }

  const wsClient = getWorkspaceClient({});
  const statements = splitStatements(sql);
  const results = [];

  for (const statement of statements) {
    try {
      results.push(await executeOne(wsClient, warehouseId, statement));
    } catch (err) {
      results.push({
        statement: statement.slice(0, 500),
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const payload = {
    profile,
    warehouse_id: warehouseId,
    host: process.env.DATABRICKS_HOST,
    executed_at: new Date().toISOString(),
    result_count: results.length,
    results,
  };

  const json = JSON.stringify(payload, null, 2);
  if (out) {
    const outPath = resolve(root, out);
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, json, 'utf8');
    console.log(`Wrote ${outPath} (${results.length} statement(s))`);
  } else {
    console.log(json);
  }

  const failed = results.some((r) => r.error);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  console.error('\nAuth tip: databricks auth login --host https://adb-7405610243855520.0.azuredatabricks.net --profile hgv-edw');
  process.exit(1);
});
