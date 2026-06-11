type RunSql = (sql: string) => Promise<Record<string, unknown>[]>;

export interface MentionSearchItem {
  key: string;
  label: string;
  category: string;
}

export async function searchCompMentions(
  runSql: RunSql,
  query: string,
  type = 'all',
): Promise<MentionSearchItem[]> {
  const q = query.trim().replace(/'/g, "''").toLowerCase();
  const items: MentionSearchItem[] = [];

  async function safeQuery(sql: string) {
    try {
      return await runSql(sql);
    } catch {
      return [];
    }
  }

  if (type === 'all' || type === 'rep') {
    const rows = await safeQuery(`
      SELECT rep_id, rep_name, level_code, region
      FROM workspace.hgv_comp.dim_rep
      WHERE is_active = true
        AND (LOWER(rep_name) LIKE '%${q}%' OR LOWER(rep_id) LIKE '%${q}%' OR LOWER(region) LIKE '%${q}%')
      LIMIT 6
    `);
    for (const r of rows) {
      items.push({
        key: `rep:${r.rep_id}`,
        label: `@rep:${r.rep_id} (${r.rep_name}, ${r.level_code})`,
        category: 'Reps',
      });
    }
  }

  if (type === 'all' || type === 'team') {
    const rows = await safeQuery(`
      SELECT team_id, team_name, region
      FROM workspace.hgv_comp.dim_team
      WHERE LOWER(team_name) LIKE '%${q}%' OR LOWER(team_id) LIKE '%${q}%' OR LOWER(region) LIKE '%${q}%'
      LIMIT 4
    `);
    for (const t of rows) {
      items.push({
        key: `team:${t.team_id}`,
        label: `@team:${t.team_id} (${t.team_name})`,
        category: 'Teams',
      });
    }
  }

  if (type === 'all' || type === 'scenario') {
    const rows = await safeQuery(`
      SELECT scenario_id, scenario_name, period_id
      FROM workspace.hgv_comp.scenario_run
      WHERE LOWER(scenario_name) LIKE '%${q}%' OR LOWER(scenario_id) LIKE '%${q}%'
      LIMIT 4
    `);
    for (const s of rows) {
      items.push({
        key: `scenario:${s.scenario_id}`,
        label: `@scenario:${s.scenario_id} (${s.scenario_name})`,
        category: 'Scenarios',
      });
    }
  }

  if (type === 'all' || type === 'deal') {
    const rows = await safeQuery(`
      SELECT deal_id, property_display_name AS description, property_code AS sku, credit_status AS status
      FROM workspace.hgv_comp.fact_deal_credit
      WHERE LOWER(property_display_name) LIKE '%${q}%' OR LOWER(deal_id) LIKE '%${q}%' OR LOWER(property_code) LIKE '%${q}%'
      LIMIT 4
    `);
    for (const d of rows) {
      items.push({
        key: `deal:${d.deal_id}`,
        label: `@deal:${d.deal_id} (${d.description ?? d.sku})`,
        category: 'Deals',
      });
    }
  }

  return items;
}
