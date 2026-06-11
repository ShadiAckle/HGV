import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcDir = join(__dirname, '..', 'data', 'comp');
const outDir = join(srcDir, 'edw_dev_hris');
const CATALOG = 'edw_dev_hris';

mkdirSync(outDir, { recursive: true });

const files = readdirSync(srcDir).filter((f) => f.endsWith('.sql'));

function remap(content, filename) {
  let s = content;
  s = s.replaceAll('workspace.hgv_comp', `${CATALOG}.hgv_comp`);
  s = s.replaceAll('ON CATALOG workspace ', `ON CATALOG ${CATALOG} `);
  if (filename === '01_create_schema.sql') {
    const body = s.replace(/^[\s\S]*?(?=CREATE SCHEMA)/, '');
    s = `-- Catalog: ${CATALOG} | Schema: hgv_comp
-- Generated copy — originals remain in data/comp/
-- Regenerate: node scripts/gen-edw-dev-hris-sql.mjs
--
-- HGV Sales Compensation — star schema DDL
-- Run once on a SQL warehouse (${CATALOG} catalog must already exist).

${body}`;
  }
  return s;
}

for (const f of files.sort()) {
  const content = readFileSync(join(srcDir, f), 'utf8');
  writeFileSync(join(outDir, f), remap(content, f), 'utf8');
}

const runOrder = `-- =============================================================================
-- HGV Compensation Hub — SQL run order for catalog ${CATALOG}
-- Schema: ${CATALOG}.hgv_comp
-- =============================================================================
-- DDL (structure only — production go-live):
--   01_create_schema.sql
--   05_extend_admin_finance.sql
--   05b_extend_finance_reference.sql
--   06_create_marketing_benchmark.sql
--   07_create_regional_bonus.sql
--   09_create_guest_registry.sql
--   10_create_plan_assessment.sql
--   09_alter_scenario_tour_volume.sql
--   11_alter_scenario_conversion.sql
--
-- Optional demo seeds (skip for real data):
--   02_seed_synthetic_data.sql, 02a_seed_core_dims.sql, 02b_seed_sales_core.sql,
--   02c_seed_sales_diversity.sql, 04_seed_semantic_definitions.sql,
--   05a_seed_admin_finance.sql, 06a_seed_marketing_benchmark.sql,
--   07a_seed_regional_bonus.sql, 09a_seed_guest_registry.sql, 10a_seed_plan_assessment.sql
--
-- After app deploy — replace app service principal ID in grant scripts:
--   03c_grant_catalog.sql, 03a_grant_use_schema.sql, 03b_grant_select.sql,
--   03d_grant_use_schema.sql, 03e_grant_select.sql, 03_grant_app_sp.sql,
--   08_grant_app_permissions.sql
-- =============================================================================
`;

writeFileSync(join(outDir, '00_run_order.sql'), runOrder, 'utf8');

const ddlFiles = [
  '01_create_schema.sql',
  '05_extend_admin_finance.sql',
  '05b_extend_finance_reference.sql',
  '06_create_marketing_benchmark.sql',
  '07_create_regional_bonus.sql',
  '09_create_guest_registry.sql',
  '10_create_plan_assessment.sql',
  '09_alter_scenario_tour_volume.sql',
  '11_alter_scenario_conversion.sql',
];

const bootstrapParts = [
  `-- One-shot DDL bootstrap for edw_dev_hris.hgv_comp`,
  `-- Paste into SQL Editor and Run All, or use scripts/setup-comp-data-edw-dev-hris.ps1`,
  `-- Catalog ${CATALOG} must already exist.`,
  '',
];

for (const f of ddlFiles) {
  const body = readFileSync(join(outDir, f), 'utf8');
  const stripped = body.replace(/^--[^\n]*\n/gm, (line) =>
    line.startsWith('-- ===') || line.includes('Generated copy') || line.includes('Regenerate:')
      ? ''
      : line,
  );
  bootstrapParts.push(`-- ----- ${f} -----`, stripped.trim(), '');
}

writeFileSync(join(outDir, '00_bootstrap_all_ddl.sql'), bootstrapParts.join('\n\n'), 'utf8');
console.log(`Wrote ${files.length + 2} files to ${outDir}`);
