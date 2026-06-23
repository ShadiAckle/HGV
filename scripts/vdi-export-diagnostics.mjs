#!/usr/bin/env node
/**
 * VDI → repo diagnostics export (run on VDI where Databricks is reachable).
 * Writes JSON under data/comp/diagnostics/ — commit + push, then pull on dev machine for Cursor analysis.
 *
 *   node scripts/vdi-export-diagnostics.mjs
 *   npm run export:diagnostics
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { getWorkspaceClient } from '@databricks/appkit';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, '..');
const outRoot = join(root, 'data/comp/diagnostics');

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

function gitHead() {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: root, encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

async function runSql(wsClient, warehouseId, statement) {
  const started = Date.now();
  const result = await wsClient.statementExecution.executeStatement({
    warehouse_id: warehouseId,
    statement,
    wait_timeout: '180s',
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
    columns: cols,
    row_count: rows.length,
    rows,
    elapsed_ms: Date.now() - started,
    status: result.status?.state ?? 'UNKNOWN',
  };
}

/** @type {{ id: string, path: string, sql: string }[]} */
const EXPORTS = [
  {
    id: 'catalog_tables',
    path: 'catalog_snapshot/tables.json',
    sql: `
SELECT table_catalog, table_schema, table_name, table_type
FROM system.information_schema.tables
WHERE (
  (table_catalog = 'edw_dev_cognos' AND table_schema = 'cognos_fm')
  OR (table_catalog = 'edw_dev_hris' AND table_schema IN ('hgv_comp', 'pwcmodels'))
)
ORDER BY 1, 2, 3`,
  },
  {
    id: 'cognos_name_columns',
    path: 'catalog_snapshot/cognos_name_columns.json',
    sql: `
SELECT table_name, column_name, data_type
FROM system.information_schema.columns
WHERE table_catalog = 'edw_dev_cognos' AND table_schema = 'cognos_fm'
  AND (
    LOWER(column_name) LIKE '%name%'
    OR LOWER(column_name) LIKE '%lead%'
    OR LOWER(column_name) LIKE '%guest%'
    OR LOWER(column_name) LIKE '%first%'
    OR LOWER(column_name) LIKE '%last%'
  )
ORDER BY table_name, column_name`,
  },
  {
    id: 'hgv_comp_objects',
    path: 'hgv_comp/objects.json',
    sql: `
SELECT table_name, table_type
FROM system.information_schema.tables
WHERE table_catalog = 'edw_dev_hris' AND table_schema = 'hgv_comp'
ORDER BY table_name`,
  },
  {
    id: 'hgv_comp_row_counts',
    path: 'hgv_comp/row_counts.json',
    sql: `
SELECT 'dim_marketing_rep' AS table_name, COUNT(*) AS row_count FROM edw_dev_hris.hgv_comp.dim_marketing_rep
UNION ALL SELECT 'dim_period', COUNT(*) FROM edw_dev_hris.hgv_comp.dim_period
UNION ALL SELECT 'dim_location', COUNT(*) FROM edw_dev_hris.hgv_comp.dim_location
UNION ALL SELECT 'fact_marketing_tour_payout', COUNT(*) FROM edw_dev_hris.hgv_comp.fact_marketing_tour_payout
UNION ALL SELECT 'fact_marketing_rep_period', COUNT(*) FROM edw_dev_hris.hgv_comp.fact_marketing_rep_period
UNION ALL SELECT 'fact_marketing_rep_metric', COUNT(*) FROM edw_dev_hris.hgv_comp.fact_marketing_rep_metric
UNION ALL SELECT 'fact_marketing_chargeback', COUNT(*) FROM edw_dev_hris.hgv_comp.fact_marketing_chargeback
UNION ALL SELECT 'fact_marketing_arrival', COUNT(*) FROM edw_dev_hris.hgv_comp.fact_marketing_arrival
UNION ALL SELECT 'dim_tour_status_config', COUNT(*) FROM edw_dev_hris.hgv_comp.dim_tour_status_config`,
  },
  {
    id: 'detail_lead_name_stats_2026',
    path: 'cognos_probes/detail_lead_name_stats_2026.json',
    sql: `
SELECT
  COUNT(*) AS rows_checked,
  COUNT(lead_name) AS lead_name_not_null,
  COUNT(CASE WHEN TRIM(COALESCE(lead_name, '')) <> '' AND LOWER(TRIM(lead_name)) <> 'null' THEN 1 END) AS lead_name_nonblank,
  COUNT(CASE WHEN enterprise_lead_id IS NOT NULL THEN 1 END) AS has_enterprise_lead_id,
  COUNT(DISTINCT tour_key_hash) AS distinct_tours
FROM edw_dev_cognos.cognos_fm.it_smt_detail
WHERE TO_DATE(transaction_date) >= DATE '2026-01-01'`,
  },
  {
    id: 'uni_lead_name_stats',
    path: 'cognos_probes/uni_lead_name_stats.json',
    sql: `
SELECT
  COUNT(*) AS lead_rows,
  COUNT(CASE WHEN TRIM(COALESCE(lead_first_name_1, '')) <> '' THEN 1 END) AS first_name_nonblank,
  COUNT(CASE WHEN TRIM(COALESCE(lead_last_name_1, '')) <> '' THEN 1 END) AS last_name_nonblank
FROM edw_dev_cognos.cognos_fm.it_uni_lead
WHERE TO_DATE(date_lead_created) >= DATE '2020-01-01'`,
  },
  {
    id: 'uni_lead_sample_2026_tours',
    path: 'cognos_probes/uni_lead_sample_2026_tours.json',
    sql: `
SELECT
  ul.enterprise_lead_id,
  ul.lead_first_name_1,
  ul.lead_last_name_1,
  ul.lead_title_1,
  ul.lead_city,
  ul.lead_state_desc,
  ul.fmt_enterprise_lead_id
FROM edw_dev_cognos.cognos_fm.it_uni_lead ul
WHERE ul.enterprise_lead_id IN (
  SELECT DISTINCT enterprise_lead_id
  FROM edw_dev_cognos.cognos_fm.it_smt_detail
  WHERE TO_DATE(transaction_date) >= DATE '2026-01-01'
    AND enterprise_lead_id IS NOT NULL
  LIMIT 100
)
LIMIT 100`,
  },
  {
    id: 'detail_lead_name_sample_2026',
    path: 'cognos_probes/detail_lead_name_sample_2026.json',
    sql: `
SELECT tour_id, tour_key_hash, enterprise_lead_id, lead_id_formatted, lead_name,
       lead_title_1, lead_title_2, ownership_status
FROM edw_dev_cognos.cognos_fm.it_smt_detail
WHERE TO_DATE(transaction_date) >= DATE '2026-01-01'
  AND (
    TRIM(COALESCE(lead_name, '')) <> ''
    OR enterprise_lead_id IS NOT NULL
  )
LIMIT 100`,
  },
  {
    id: 'warehouse_tour_payout_guest_sample',
    path: 'hgv_comp/tour_payout_guest_sample.json',
    sql: `
SELECT tour_id, rep_id, period_id, guest_name, guest_type, tour_status, payout, arrival_date
FROM edw_dev_hris.hgv_comp.fact_marketing_tour_payout
ORDER BY arrival_date DESC NULLS LAST
LIMIT 100`,
  },
  {
    id: 'marketing_tour_status_2026',
    path: 'cognos_probes/marketing_tour_status_2026.json',
    sql: `
SELECT tour_status_desc, COUNT(*) AS tour_count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) AS pct
FROM edw_dev_cognos.cognos_fm.it_smt_marketing
WHERE TO_DATE(tour_booked_date) BETWEEN DATE '2026-01-01' AND DATE '2026-12-31'
GROUP BY tour_status_desc
ORDER BY tour_count DESC
LIMIT 30`,
  },
  {
    id: 'commissions_schema',
    path: 'pwcmodels/commissions_columns.json',
    sql: `
SELECT column_name, data_type
FROM system.information_schema.columns
WHERE table_catalog = 'edw_dev_hris' AND table_schema = 'pwcmodels' AND table_name = 'commissions'
ORDER BY ordinal_position`,
  },
  {
    id: 'commissions_sample',
    path: 'pwcmodels/commissions_sample.json',
    sql: `
SELECT participant, title, name, orderId, value, commissionAmount, businessUnit, payDate, gd1SoldDate
FROM edw_dev_hris.pwcmodels.commissions
WHERE payDate >= DATE '2026-01-01'
LIMIT 50`,
  },
];

async function main() {
  loadDotEnv();
  const profile = process.env.DATABRICKS_CONFIG_PROFILE || 'hgv-edw';
  if (!process.env.DATABRICKS_CONFIG_PROFILE) process.env.DATABRICKS_CONFIG_PROFILE = profile;

  const warehouseId = process.env.DATABRICKS_WAREHOUSE_ID || '9e9c06ad1c397404';
  const host = process.env.DATABRICKS_HOST || 'https://adb-7405610243855520.0.azuredatabricks.net';

  mkdirSync(outRoot, { recursive: true });

  const wsClient = getWorkspaceClient({});
  const manifest = {
    generated_at: new Date().toISOString(),
    git_commit: gitHead(),
    host,
    profile,
    warehouse_id: warehouseId,
    exports: [],
  };

  let failed = 0;
  for (const exp of EXPORTS) {
    const relPath = exp.path.replace(/\\/g, '/');
    const absPath = join(outRoot, exp.path);
    mkdirSync(dirname(absPath), { recursive: true });
    process.stderr.write(`[export] ${exp.id} … `);
    try {
      const data = await runSql(wsClient, warehouseId, exp.sql.trim());
      const payload = { id: exp.id, ...data };
      writeFileSync(absPath, JSON.stringify(payload, null, 2), 'utf8');
      manifest.exports.push({
        id: exp.id,
        path: `data/comp/diagnostics/${relPath}`,
        status: data.status,
        row_count: data.row_count,
        elapsed_ms: data.elapsed_ms,
      });
      process.stderr.write(`ok (${data.row_count} rows)\n`);
    } catch (err) {
      failed += 1;
      const msg = err instanceof Error ? err.message : String(err);
      writeFileSync(
        absPath,
        JSON.stringify({ id: exp.id, error: msg }, null, 2),
        'utf8',
      );
      manifest.exports.push({
        id: exp.id,
        path: `data/comp/diagnostics/${relPath}`,
        status: 'FAILED',
        error: msg,
      });
      process.stderr.write(`FAILED\n`);
    }
  }

  writeFileSync(join(outRoot, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
  process.stderr.write(`\nWrote data/comp/diagnostics/manifest.json (${manifest.exports.length} exports, ${failed} failed)\n`);
  if (failed) process.stderr.write(`git add data/comp/diagnostics && git commit -m "diagnostics export" && git push\n`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
