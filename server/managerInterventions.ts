import {
  DEFAULT_QUOTA_RELIEF_PCT,
  MAX_TAKEOVER_DISCOUNT_PCT,
  type ManagerInterventionRecord,
  type SubmitManagerInterventionPayload,
} from '../shared/managerIntervention.js';

type RunSql = (sql: string) => Promise<Record<string, unknown>[]>;

const INTERVENTION_DDL = `
  CREATE TABLE IF NOT EXISTS workspace.hgv_comp.fact_manager_intervention (
    intervention_id   STRING        NOT NULL,
    manager_rep_id    STRING        NOT NULL,
    target_rep_id     STRING        NOT NULL,
    period_id         STRING        NOT NULL,
    intervention_type STRING        NOT NULL,
    status            STRING        NOT NULL,
    discount_pct      DECIMAL(5,2),
    quota_relief_pct  DECIMAL(5,2),
    tour_id           STRING,
    notes             STRING,
    admin_event_id    STRING,
    created_at        TIMESTAMP     NOT NULL
  ) USING DELTA
  COMMENT 'Active manager coaching levers: co-sell pricing auth and quota relief'
`;

function esc(value: string): string {
  return value.replace(/'/g, "''");
}

function n(v: unknown): number {
  return Number(v ?? 0);
}

function newEventId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export async function ensureManagerInterventionTable(runSql: RunSql): Promise<void> {
  try {
    await runSql(INTERVENTION_DDL);
  } catch (err) {
    console.warn('fact_manager_intervention DDL skipped:', err instanceof Error ? err.message : err);
  }
}

function mapInterventionRow(row: Record<string, unknown>): ManagerInterventionRecord {
  return {
    intervention_id: String(row.intervention_id),
    manager_rep_id: String(row.manager_rep_id),
    target_rep_id: String(row.target_rep_id),
    target_rep_name: row.target_rep_name != null ? String(row.target_rep_name) : undefined,
    period_id: String(row.period_id),
    intervention_type: String(row.intervention_type) as ManagerInterventionRecord['intervention_type'],
    status: String(row.status) as ManagerInterventionRecord['status'],
    discount_pct: row.discount_pct != null ? n(row.discount_pct) : null,
    quota_relief_pct: row.quota_relief_pct != null ? n(row.quota_relief_pct) : null,
    tour_id: row.tour_id != null ? String(row.tour_id) : null,
    notes: row.notes != null ? String(row.notes) : null,
    admin_event_id: row.admin_event_id != null ? String(row.admin_event_id) : null,
    created_at: String(row.created_at),
  };
}

export async function fetchActiveInterventions(
  runSql: RunSql,
  targetRepId: string,
  periodId: string,
): Promise<ManagerInterventionRecord[]> {
  const safeRep = esc(targetRepId);
  const safePeriod = esc(periodId);
  const rows = await runSql(`
    SELECT i.*, r.rep_name AS target_rep_name
    FROM workspace.hgv_comp.fact_manager_intervention i
    LEFT JOIN workspace.hgv_comp.dim_rep r ON r.rep_id = i.target_rep_id
    WHERE i.target_rep_id = '${safeRep}'
      AND i.period_id = '${safePeriod}'
      AND i.status = 'ACTIVE'
    ORDER BY i.created_at DESC
  `).catch(() => []);
  return rows.map((r) => mapInterventionRow(r as Record<string, unknown>));
}

/** SQL fragment: effective quota attainment with active QUOTA_SHIELD relief */
export function effectiveAttainmentSql(qaAlias = 'qa', shieldAlias = 'qs'): string {
  return `
    CASE
      WHEN ${shieldAlias}.quota_relief_pct IS NOT NULL AND ${shieldAlias}.quota_relief_pct > 0
           AND ${qaAlias}.quota_amount > 0
        THEN LEAST(
          130,
          ROUND(100.0 * ${qaAlias}.credited_amount
            / (${qaAlias}.quota_amount * (1 - ${shieldAlias}.quota_relief_pct / 100.0)), 2)
        )
      ELSE ${qaAlias}.attainment_pct
    END
  `.trim();
}

/** SQL fragment: LEFT JOIN active quota shield per rep/period */
export function quotaShieldJoinSql(repIdCol: string, periodIdCol: string, alias = 'qs'): string {
  return `
    LEFT JOIN (
      SELECT target_rep_id, period_id, MAX(quota_relief_pct) AS quota_relief_pct
      FROM workspace.hgv_comp.fact_manager_intervention
      WHERE intervention_type = 'QUOTA_SHIELD' AND status = 'ACTIVE'
      GROUP BY target_rep_id, period_id
    ) ${alias} ON ${alias}.target_rep_id = ${repIdCol} AND ${alias}.period_id = ${periodIdCol}
  `.trim();
}

export async function submitManagerInterventions(
  runSql: RunSql,
  payload: SubmitManagerInterventionPayload,
  managerName?: string,
): Promise<{ interventions: ManagerInterventionRecord[]; admin_event_ids: string[] }> {
  const managerRepId = esc(payload.manager_rep_id);
  const targetRepId = esc(payload.target_rep_id);
  const periodId = esc(payload.period_id);
  const approver = esc(managerName ?? payload.manager_rep_id);
  const notes = payload.notes ? esc(payload.notes.slice(0, 500)) : '';

  const repRow = await runSql(
    `SELECT rep_name FROM workspace.hgv_comp.dim_rep WHERE rep_id = '${targetRepId}' LIMIT 1`,
  ).catch(() => []);
  const targetName = repRow[0] ? String((repRow[0] as Record<string, unknown>).rep_name) : payload.target_rep_id;

  const created: ManagerInterventionRecord[] = [];
  const adminEventIds: string[] = [];

  if (payload.takeover_pricing?.enabled) {
    const discount = Math.min(
      MAX_TAKEOVER_DISCOUNT_PCT,
      Math.max(0, Number(payload.takeover_pricing.discount_pct ?? 0)),
    );
    const tourId = payload.takeover_pricing.tour_id?.trim() || null;
    const interventionId = newEventId('INT-TO');
    const adminEventId = newEventId('ADMEVT');
    const tourNote = tourId ? ` Tour ${esc(tourId)}.` : '';
    const reason = esc(
      `Manager co-sell pricing authorization: up to ${discount}% exception for ${targetName}.${tourNote}${notes ? ` Notes: ${payload.notes}` : ''}`,
    );

    await runSql(`
      INSERT INTO workspace.hgv_comp.fact_manager_intervention
        (intervention_id, manager_rep_id, target_rep_id, period_id, intervention_type, status,
         discount_pct, quota_relief_pct, tour_id, notes, admin_event_id, created_at)
      VALUES (
        '${interventionId}', '${managerRepId}', '${targetRepId}', '${periodId}',
        'TAKEOVER_PRICING', 'ACTIVE', ${discount}, NULL,
        ${tourId ? `'${esc(tourId)}'` : 'NULL'},
        ${notes ? `'${notes}'` : 'NULL'},
        '${adminEventId}', CURRENT_TIMESTAMP()
      )
    `);

    await runSql(`
      INSERT INTO workspace.hgv_comp.fact_comp_admin_log
        (event_id, rep_id, period_id, event_type, amount, reason, approved_by, created_at)
      VALUES (
        '${adminEventId}', '${targetRepId}', '${periodId}', 'TAKEOVER_PRICING', NULL,
        '${reason}', '${approver}', CURRENT_TIMESTAMP()
      )
    `);

    adminEventIds.push(adminEventId);
    created.push({
      intervention_id: interventionId,
      manager_rep_id: payload.manager_rep_id,
      target_rep_id: payload.target_rep_id,
      target_rep_name: targetName,
      period_id: payload.period_id,
      intervention_type: 'TAKEOVER_PRICING',
      status: 'ACTIVE',
      discount_pct: discount,
      quota_relief_pct: null,
      tour_id: tourId,
      notes: payload.notes ?? null,
      admin_event_id: adminEventId,
      created_at: new Date().toISOString(),
    });
  }

  if (payload.quota_shield?.enabled) {
    const relief = Math.min(
      25,
      Math.max(1, Number(payload.quota_shield.relief_pct ?? DEFAULT_QUOTA_RELIEF_PCT)),
    );
    const interventionId = newEventId('INT-QS');
    const adminEventId = newEventId('ADMEVT');
    const reason = esc(
      `Quota relief (shield) ${relief}% applied for ${targetName} — effective attainment recalculated against reduced quota baseline.${notes ? ` Notes: ${payload.notes}` : ''}`,
    );

    await runSql(`
      UPDATE workspace.hgv_comp.fact_manager_intervention
      SET status = 'REVOKED'
      WHERE target_rep_id = '${targetRepId}' AND period_id = '${periodId}'
        AND intervention_type = 'QUOTA_SHIELD' AND status = 'ACTIVE'
    `).catch(() => []);

    await runSql(`
      INSERT INTO workspace.hgv_comp.fact_manager_intervention
        (intervention_id, manager_rep_id, target_rep_id, period_id, intervention_type, status,
         discount_pct, quota_relief_pct, tour_id, notes, admin_event_id, created_at)
      VALUES (
        '${interventionId}', '${managerRepId}', '${targetRepId}', '${periodId}',
        'QUOTA_SHIELD', 'ACTIVE', NULL, ${relief}, NULL,
        ${notes ? `'${notes}'` : 'NULL'},
        '${adminEventId}', CURRENT_TIMESTAMP()
      )
    `);

    await runSql(`
      INSERT INTO workspace.hgv_comp.fact_comp_admin_log
        (event_id, rep_id, period_id, event_type, amount, reason, approved_by, created_at)
      VALUES (
        '${adminEventId}', '${targetRepId}', '${periodId}', 'QUOTA_SHIELD', NULL,
        '${reason}', '${approver}', CURRENT_TIMESTAMP()
      )
    `);

    adminEventIds.push(adminEventId);
    created.push({
      intervention_id: interventionId,
      manager_rep_id: payload.manager_rep_id,
      target_rep_id: payload.target_rep_id,
      target_rep_name: targetName,
      period_id: payload.period_id,
      intervention_type: 'QUOTA_SHIELD',
      status: 'ACTIVE',
      discount_pct: null,
      quota_relief_pct: relief,
      tour_id: null,
      notes: payload.notes ?? null,
      admin_event_id: adminEventId,
      created_at: new Date().toISOString(),
    });
  }

  return { interventions: created, admin_event_ids: adminEventIds };
}

const TEAM_AGENT_PERFORMANCE_SQL = `
WITH rep_ffs AS (
  SELECT mix.rep_id, mix.period_id, MAX(CASE WHEN pl.is_ffs THEN mix.mix_pct END) AS ffs_sales_pct
  FROM workspace.hgv_comp.fact_rep_product_mix mix
  JOIN workspace.hgv_comp.dim_product_line pl ON pl.product_line_id = mix.product_line_id
  GROUP BY mix.rep_id, mix.period_id
),
quota_shield AS (
  SELECT target_rep_id, period_id, MAX(quota_relief_pct) AS quota_relief_pct
  FROM workspace.hgv_comp.fact_manager_intervention
  WHERE intervention_type = 'QUOTA_SHIELD' AND status = 'ACTIVE'
  GROUP BY target_rep_id, period_id
)
SELECT r.rep_id, r.rep_name AS agent_name, r.level_code AS level,
  ${effectiveAttainmentSql('qa', 'qs')} AS quota_attainment_pct,
  COALESCE(ffs.ffs_sales_pct, 0.00) AS ffs_sales_pct,
  pay.total_earnings,
  CASE WHEN ${effectiveAttainmentSql('qa', 'qs')} >= 100 THEN 'TOP'
       WHEN ${effectiveAttainmentSql('qa', 'qs')} < 70 THEN 'AT_RISK'
       ELSE 'ON_TRACK' END AS performance_band
FROM workspace.hgv_comp.dim_rep r
JOIN workspace.hgv_comp.fact_quota_attainment qa ON qa.rep_id = r.rep_id
JOIN workspace.hgv_comp.fact_payout pay ON pay.rep_id = r.rep_id AND pay.period_id = qa.period_id
LEFT JOIN rep_ffs ffs ON ffs.rep_id = r.rep_id AND ffs.period_id = qa.period_id
LEFT JOIN quota_shield qs ON qs.target_rep_id = r.rep_id AND qs.period_id = qa.period_id
WHERE r.team_id = '__TEAM__' AND qa.period_id = '__PERIOD__' AND r.manager_rep_id IS NOT NULL
ORDER BY quota_attainment_pct DESC
`;

export async function fetchTeamAgentPerformance(
  runSql: RunSql,
  teamId: string,
  periodId: string,
): Promise<Record<string, unknown>[]> {
  const sql = TEAM_AGENT_PERFORMANCE_SQL
    .replace(/__TEAM__/g, esc(teamId))
    .replace(/__PERIOD__/g, esc(periodId));
  return runSql(sql).catch(() => []);
}
