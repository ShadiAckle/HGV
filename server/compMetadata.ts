import { isProductionCompDataMode } from '../shared/compCatalog.js';
import { DEFAULT_PERIODS } from '../shared/compPeriods.js';

type RunSql = (sql: string) => Promise<Record<string, unknown>[]>;

const MARKETING_CHANNEL_IDENTITIES = [
  { rep_id: 'PERSONA-MKT-REP', rep_name: 'T. Brooks', level_code: 'C2a', team_id: 'TEAM-MKT-LAS', region: 'West', is_active: true, role_title: 'Marketing Representative', persona_id: 'marketing_rep', plan_id: 'PLAN-MKT-REP-2026', identity_group: 'marketing_channel' },
  { rep_id: 'PERSONA-MKT-MGR', rep_name: 'R. Castillo', level_code: 'C2b', team_id: 'TEAM-MKT-LAS', region: 'West', is_active: true, role_title: 'Marketing Manager', persona_id: 'marketing_manager', plan_id: 'PLAN-MKT-MGR-2026', identity_group: 'marketing_channel' },
  { rep_id: 'PERSONA-MKT-DIR', rep_name: 'D. Whitfield', level_code: 'C2c', team_id: 'TEAM-MKT-REG', region: 'West', is_active: true, role_title: 'Marketing Director', persona_id: 'marketing_director', plan_id: 'PLAN-MKT-DIR-2026', identity_group: 'marketing_channel' },
] as const;

const METADATA_PERIOD_LIMIT = 24;

export async function fetchCompMetadata(runSql: RunSql) {
  const production = isProductionCompDataMode();

  async function safeQuery(sql: string) {
    try {
      return await runSql(sql);
    } catch (err) {
      console.warn('metadata query failed:', err instanceof Error ? err.message : err);
      return [];
    }
  }

  // dim_rep expands to a full commissions scan — skip on production marketing deploy.
  const dbReps = production
    ? []
    : await safeQuery(`
    SELECT rep_id, rep_name, level_code, team_id, region, is_active
    FROM workspace.hgv_comp.dim_rep
    ORDER BY rep_name
    LIMIT 500
  `);

  // dim_marketing_rep — lightweight rep picker (do not scan fact_marketing_rep_period for metadata).
  const warehouseMarketingReps = await safeQuery(`
    SELECT
      rep_id,
      COALESCE(rep_name, rep_id) AS rep_name,
      level_code,
      team_id,
      region,
      is_active
    FROM workspace.hgv_comp.dim_marketing_rep
    WHERE rep_id IS NOT NULL
      AND NOT rep_id LIKE 'PERSONA-MKT-%'
    ORDER BY rep_name
    LIMIT 500
  `);

  const marketingIdentities =
    warehouseMarketingReps.length > 0
      ? warehouseMarketingReps.map((r) => ({
          rep_id: String(r.rep_id),
          rep_name: String(r.rep_name),
          level_code: String(r.level_code),
          team_id: String(r.team_id),
          region: String(r.region),
          is_active: r.is_active === true || r.is_active === 'true',
          role_title:
            r.level_code === 'C2c' ? 'Marketing Director' :
            r.level_code === 'C2b' ? 'Marketing Manager' :
            'Marketing Representative',
          persona_id:
            r.level_code === 'C2c' ? 'marketing_director' :
            r.level_code === 'C2b' ? 'marketing_manager' :
            'marketing_rep',
          plan_id:
            r.level_code === 'C2c' ? 'PLAN-MKT-DIR-2026' :
            r.level_code === 'C2b' ? 'PLAN-MKT-MGR-2026' :
            'PLAN-MKT-REP-2026',
          identity_group: 'marketing_channel' as const,
        }))
      : production
        ? []
        : [...MARKETING_CHANNEL_IDENTITIES];

  const marketingIds = new Set(marketingIdentities.map((r) => r.rep_id));

  const salesReps = dbReps
    .filter((r) => !marketingIds.has(String(r.rep_id)))
    .map((r) => ({
      rep_id: String(r.rep_id),
      rep_name: String(r.rep_name),
      level_code: String(r.level_code),
      team_id: String(r.team_id),
      region: String(r.region),
      is_active: r.is_active === true || r.is_active === 'true',
      role_title:
        String(r.rep_id).includes('MGR') || r.level_code === 'L9' ? 'Sales Manager' : 'Sales Executive',
      identity_group:
        String(r.rep_id).includes('MGR') || r.level_code === 'L9'
          ? ('sales_manager' as const)
          : ('sales_executive' as const),
    }));

  const reps = [...marketingIdentities, ...salesReps];

  const teams = production
    ? []
    : await safeQuery(`
    SELECT team_id, team_name, region
    FROM workspace.hgv_comp.dim_team
    ORDER BY team_name
    LIMIT 100
  `);

  const periodsRaw = await safeQuery(`
    SELECT period_id, period_label, is_current
    FROM workspace.hgv_comp.dim_period
    ORDER BY period_start DESC
    LIMIT ${METADATA_PERIOD_LIMIT}
  `);
  const periods =
    periodsRaw.length > 0
      ? periodsRaw.map((p) => ({
          period_id: String(p.period_id),
          period_label: String(p.period_label),
          is_current: p.is_current === true || p.is_current === 'true',
        }))
      : [...DEFAULT_PERIODS];

  const scenarios = await safeQuery(`
    SELECT scenario_id, scenario_name, period_id
    FROM workspace.hgv_comp.scenario_run
    ORDER BY scenario_id
    LIMIT 50
  `);

  const deals = production
    ? []
    : await safeQuery(`
    SELECT deal_id, rep_id, credit_amount AS amount, credit_status AS status, property_display_name AS description
    FROM workspace.hgv_comp.fact_deal_credit
    LIMIT 25
  `);

  const countRows = production
    ? []
    : await safeQuery(`
    SELECT
      (SELECT COUNT(*) FROM workspace.hgv_comp.fact_deal_credit) AS deal_count,
      (SELECT COUNT(*) FROM workspace.hgv_comp.fact_payout) AS payout_count
  `);
  const counts = countRows[0] ?? {};

  return {
    reps,
    teams,
    periods,
    scenarios,
    deals,
    counts: {
      deals: Number(counts.deal_count ?? 0),
      payouts: Number(counts.payout_count ?? 0),
    },
  };
}
