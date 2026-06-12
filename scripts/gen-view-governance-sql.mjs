import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(resolve(root, 'data/comp/edw_dev_hris/12_bootstrap_live_source_views.sql'), 'utf8');
const views = new Set([
  '_src_tour_spine',
  '_src_rep_directory',
  '_src_period_calendar',
  'dim_rep',
  'dim_team',
  'dim_period',
  'dim_marketing_rep',
  'fact_payout',
  'fact_deal_credit',
  'fact_quota_attainment',
  'fact_plan_eligibility',
  'fact_chargeback',
  'fact_marketing_tour_payout',
  'fact_marketing_rep_period',
  'fact_rep_market_position',
]);

const blocks = [];
const re = /CREATE OR REPLACE VIEW edw_dev_hris\.hgv_comp\.(\w+)/g;
let m;
while ((m = re.exec(src))) {
  if (!views.has(m[1])) continue;
  const start = m.index;
  const next = src.indexOf('CREATE OR REPLACE VIEW', start + 1);
  const end = next === -1 ? src.length : next;
  blocks.push(src.slice(start, end).trim());
}

const header = `-- =============================================================================
-- ONE-SHOT performance governance patch (supersedes 13 + 14)
-- Catalog: edw_dev_hris.hgv_comp | Run in SQL Editor once
-- TOUR_LOOKBACK=36mo | FIELD_LOOKBACK=60mo | dim_period capped at 24 quarters
-- =============================================================================

`;

const footer = `
-- Smoke (seconds each):
-- SELECT COUNT(*) AS dim_rep FROM edw_dev_hris.hgv_comp.dim_rep;
-- SELECT COUNT(*) AS dim_marketing_rep FROM edw_dev_hris.hgv_comp.dim_marketing_rep;
-- SELECT COUNT(DISTINCT rep_id) AS mkt_rep_period FROM edw_dev_hris.hgv_comp.fact_marketing_rep_period;
-- SELECT COUNT(*) AS dim_period FROM edw_dev_hris.hgv_comp.dim_period;
`;

const out = resolve(root, 'data/comp/edw_dev_hris/15_apply_view_performance_governance.sql');
writeFileSync(out, header + blocks.join('\n\n') + footer);
console.log(`Wrote ${blocks.length} views to ${out}`);
