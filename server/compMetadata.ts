import { DEFAULT_PERIODS } from '../shared/compPeriods.js';

type RunSql = (sql: string) => Promise<Record<string, unknown>[]>;

const MARKETING_CHANNEL_IDENTITIES = [
  { rep_id: 'PERSONA-MKT-REP', rep_name: 'T. Brooks', level_code: 'C2a', team_id: 'TEAM-MKT-LAS', region: 'West', is_active: true, role_title: 'Marketing Representative', persona_id: 'marketing_rep', plan_id: 'PLAN-MKT-REP-2026', identity_group: 'marketing_channel' },
  { rep_id: 'PERSONA-MKT-MGR', rep_name: 'R. Castillo', level_code: 'C2b', team_id: 'TEAM-MKT-LAS', region: 'West', is_active: true, role_title: 'Marketing Manager', persona_id: 'marketing_manager', plan_id: 'PLAN-MKT-MGR-2026', identity_group: 'marketing_channel' },
  { rep_id: 'PERSONA-MKT-DIR', rep_name: 'D. Whitfield', level_code: 'C2c', team_id: 'TEAM-MKT-REG', region: 'West', is_active: true, role_title: 'Marketing Director', persona_id: 'marketing_director', plan_id: 'PLAN-MKT-DIR-2026', identity_group: 'marketing_channel' },
] as const;

export async function fetchCompMetadata(runSql: RunSql) {
  async function safeQuery(sql: string) {
    try {
      return await runSql(sql);
    } catch {
      return [];
    }
  }

  const dbReps = await safeQuery(`
    SELECT rep_id, rep_name, level_code, team_id, region, is_active
    FROM workspace.hgv_comp.dim_rep
    ORDER BY rep_name
  `);

  const reps = [
    ...MARKETING_CHANNEL_IDENTITIES,
    ...dbReps.map((r) => ({
      ...r,
      role_title: String(r.rep_id).includes('MGR') || r.level_code === 'L9' ? 'Sales Manager' : 'Sales Executive',
      identity_group: String(r.rep_id).includes('MGR') || r.level_code === 'L9' ? 'sales_manager' : 'sales_executive',
    })),
  ];

  const teams = await safeQuery(`
    SELECT team_id, team_name, region
    FROM workspace.hgv_comp.dim_team
    ORDER BY team_name
  `);

  const periodsRaw = await safeQuery(`
    SELECT period_id, period_label, is_current
    FROM workspace.hgv_comp.dim_period
    ORDER BY period_start DESC
  `);
  const allowedPeriodIds = new Set(DEFAULT_PERIODS.map((p) => p.period_id));
  const filteredPeriods = periodsRaw.filter((p) => allowedPeriodIds.has(String(p.period_id)));
  const periods = filteredPeriods.length > 0 ? filteredPeriods : periodsRaw.length > 0 ? periodsRaw : [...DEFAULT_PERIODS];

  const scenarios = await safeQuery(`
    SELECT scenario_id, scenario_name, period_id
    FROM workspace.hgv_comp.scenario_run
    ORDER BY scenario_id
  `);

  const deals = await safeQuery(`
    SELECT deal_id, rep_id, credit_amount AS amount, credit_status AS status, property_display_name AS description
    FROM workspace.hgv_comp.fact_deal_credit
    LIMIT 25
  `);

  const countRows = await safeQuery(`
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
