/**
 * Compensation Configuration API
 *
 * CRUD endpoints for admin self-service configuration of compensation rules.
 * Enables stakeholders to adjust tour status payouts, multi-rep credit policies,
 * and rep filtering rules without SQL changes.
 */

import { randomUUID } from 'crypto';
import type { Request, Response } from 'express';
import { rewriteCompCatalogSql } from '../shared/compCatalog.js';
import type {
  TourStatusConfig,
  TourStatusConfigInput,
  CompRuleConfig,
  CompRuleConfigInput,
  RepFilterConfig,
  RepFilterConfigInput,
  CompConfigAuditLog,
} from '../shared/compConfigTypes.js';

// Type for runSql function (defined in server.ts)
type RunSql = (statement: string) => Promise<Record<string, unknown>[]>;

// ─────────────────────────────────────────────────────────────────────────────
// Tour Status Config CRUD
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchTourStatusConfigs(runSql: RunSql, _req: Request, res: Response): Promise<void> {
  try {
    const sql = rewriteCompCatalogSql(`
      SELECT 
        config_id,
        CASE WHEN tour_status_desc = '__NULL__' THEN NULL ELSE tour_status_desc END as tour_status_desc,
        payout_amount,
        is_active,
        CAST(effective_date AS STRING) as effective_date,
        CAST(end_date AS STRING) as end_date,
        rule_description,
        modified_by,
        CAST(modified_at AS STRING) as modified_at,
        CAST(created_at AS STRING) as created_at
      FROM workspace.hgv_comp.dim_tour_status_config
      ORDER BY 
        is_active DESC,
        CASE WHEN tour_status_desc = '__NULL__' THEN 'zzz' ELSE tour_status_desc END
    `);
    const rows = await runSql(sql) as unknown as TourStatusConfig[];
    res.json({ configs: rows });
  } catch (err) {
    console.error('[Config API] Fetch tour status configs failed:', err);
    res.status(500).json({ error: 'Failed to fetch tour status configs' });
  }
}

export async function createTourStatusConfig(runSql: RunSql, req: Request, res: Response): Promise<void> {
  try {
    const input: TourStatusConfigInput = req.body;
    const configId = `TS-${randomUUID().substring(0, 8).toUpperCase()}`;
    const now = new Date().toISOString();
    
    // Convert null to '__NULL__' for SQL join compatibility
    const statusForSql = input.tour_status_desc === null ? '__NULL__' : input.tour_status_desc;

    const sql = rewriteCompCatalogSql(`
      INSERT INTO workspace.hgv_comp.dim_tour_status_config
        (config_id, tour_status_desc, payout_amount, is_active, effective_date, end_date, 
         rule_description, modified_by, modified_at, created_at)
      VALUES (
        '${configId}',
        ${statusForSql === '__NULL__' ? "'__NULL__'" : `'${statusForSql.replace(/'/g, "''")}'`},
        ${input.payout_amount},
        ${input.is_active ?? true},
        DATE '${input.effective_date}',
        ${input.end_date ? `DATE '${input.end_date}'` : 'NULL'},
        ${input.rule_description ? `'${input.rule_description.replace(/'/g, "''")}'` : 'NULL'},
        '${input.modified_by.replace(/'/g, "''")}',
        TIMESTAMP '${now}',
        TIMESTAMP '${now}'
      )
    `);

    await runSql(sql);
    await logConfigAudit(runSql, 'dim_tour_status_config', configId, 'INSERT', null, JSON.stringify(input), input.modified_by);

    res.json({ success: true, config_id: configId });
  } catch (err) {
    console.error('[Config API] Create tour status config failed:', err);
    res.status(500).json({ error: 'Failed to create tour status config' });
  }
}

export async function updateTourStatusConfig(runSql: RunSql, req: Request, res: Response): Promise<void> {
  try {
    const configId = String(req.params.config_id);
    const input: TourStatusConfigInput = req.body;
    const now = new Date().toISOString();

    // Fetch old value for audit
    const oldRows = await runSql(rewriteCompCatalogSql(`
      SELECT * FROM workspace.hgv_comp.dim_tour_status_config WHERE config_id = '${configId}'
    `)) as unknown as TourStatusConfig[];
    const oldValue = oldRows[0] ? JSON.stringify(oldRows[0]) : null;

    const statusForSql = input.tour_status_desc === null ? '__NULL__' : input.tour_status_desc;

    const sql = rewriteCompCatalogSql(`
      UPDATE workspace.hgv_comp.dim_tour_status_config
      SET 
        tour_status_desc = ${statusForSql === '__NULL__' ? "'__NULL__'" : `'${statusForSql.replace(/'/g, "''")}'`},
        payout_amount = ${input.payout_amount},
        is_active = ${input.is_active ?? true},
        effective_date = DATE '${input.effective_date}',
        end_date = ${input.end_date ? `DATE '${input.end_date}'` : 'NULL'},
        rule_description = ${input.rule_description ? `'${input.rule_description.replace(/'/g, "''")}'` : 'NULL'},
        modified_by = '${input.modified_by.replace(/'/g, "''")}',
        modified_at = TIMESTAMP '${now}'
      WHERE config_id = '${configId}'
    `);

    await runSql(sql);
    await logConfigAudit(runSql, 'dim_tour_status_config', configId, 'UPDATE', oldValue, JSON.stringify(input), input.modified_by);

    res.json({ success: true });
  } catch (err) {
    console.error('[Config API] Update tour status config failed:', err);
    res.status(500).json({ error: 'Failed to update tour status config' });
  }
}

export async function deleteTourStatusConfig(runSql: RunSql, req: Request, res: Response): Promise<void> {
  try {
    const configId = String(req.params.config_id);
    const { modified_by } = req.body;

    const oldRows = await runSql(rewriteCompCatalogSql(`
      SELECT * FROM workspace.hgv_comp.dim_tour_status_config WHERE config_id = '${configId}'
    `)) as unknown as TourStatusConfig[];
    const oldValue = oldRows[0] ? JSON.stringify(oldRows[0]) : null;

    const sql = rewriteCompCatalogSql(`
      DELETE FROM workspace.hgv_comp.dim_tour_status_config WHERE config_id = '${configId}'
    `);

    await runSql(sql);
    await logConfigAudit(runSql, 'dim_tour_status_config', configId, 'DELETE', oldValue, null, modified_by);

    res.json({ success: true });
  } catch (err) {
    console.error('[Config API] Delete tour status config failed:', err);
    res.status(500).json({ error: 'Failed to delete tour status config' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Comp Rule Config CRUD
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchCompRuleConfigs(runSql: RunSql, _req: Request, res: Response): Promise<void> {
  try {
    const sql = rewriteCompCatalogSql(`
      SELECT 
        config_id, rule_name, rule_value, rule_parameters, is_active,
        CAST(effective_date AS STRING) as effective_date,
        CAST(end_date AS STRING) as end_date,
        rule_description, modified_by,
        CAST(modified_at AS STRING) as modified_at,
        CAST(created_at AS STRING) as created_at
      FROM workspace.hgv_comp.dim_comp_rule_config
      ORDER BY is_active DESC, rule_name
    `);
    const rows = await runSql(sql) as unknown as CompRuleConfig[];
    res.json({ configs: rows });
  } catch (err) {
    console.error('[Config API] Fetch comp rule configs failed:', err);
    res.status(500).json({ error: 'Failed to fetch comp rule configs' });
  }
}

export async function createCompRuleConfig(runSql: RunSql, req: Request, res: Response): Promise<void> {
  try {
    const input: CompRuleConfigInput = req.body;
    const configId = `CR-${randomUUID().substring(0, 8).toUpperCase()}`;
    const now = new Date().toISOString();

    const sql = rewriteCompCatalogSql(`
      INSERT INTO workspace.hgv_comp.dim_comp_rule_config
        (config_id, rule_name, rule_value, rule_parameters, is_active, effective_date, end_date,
         rule_description, modified_by, modified_at, created_at)
      VALUES (
        '${configId}',
        '${input.rule_name.replace(/'/g, "''")}',
        '${input.rule_value.replace(/'/g, "''")}',
        ${input.rule_parameters ? `'${input.rule_parameters.replace(/'/g, "''")}'` : 'NULL'},
        ${input.is_active ?? true},
        DATE '${input.effective_date}',
        ${input.end_date ? `DATE '${input.end_date}'` : 'NULL'},
        ${input.rule_description ? `'${input.rule_description.replace(/'/g, "''")}'` : 'NULL'},
        '${input.modified_by.replace(/'/g, "''")}',
        TIMESTAMP '${now}',
        TIMESTAMP '${now}'
      )
    `);

    await runSql(sql);
    await logConfigAudit(runSql, 'dim_comp_rule_config', configId, 'INSERT', null, JSON.stringify(input), input.modified_by);

    res.json({ success: true, config_id: configId });
  } catch (err) {
    console.error('[Config API] Create comp rule config failed:', err);
    res.status(500).json({ error: 'Failed to create comp rule config' });
  }
}

export async function updateCompRuleConfig(runSql: RunSql, req: Request, res: Response): Promise<void> {
  try {
    const configId = String(req.params.config_id);
    const input: CompRuleConfigInput = req.body;
    const now = new Date().toISOString();

    const oldRows = await runSql(rewriteCompCatalogSql(`
      SELECT * FROM workspace.hgv_comp.dim_comp_rule_config WHERE config_id = '${configId}'
    `)) as unknown as CompRuleConfig[];
    const oldValue = oldRows[0] ? JSON.stringify(oldRows[0]) : null;

    const sql = rewriteCompCatalogSql(`
      UPDATE workspace.hgv_comp.dim_comp_rule_config
      SET 
        rule_name = '${input.rule_name.replace(/'/g, "''")}',
        rule_value = '${input.rule_value.replace(/'/g, "''")}',
        rule_parameters = ${input.rule_parameters ? `'${input.rule_parameters.replace(/'/g, "''")}'` : 'NULL'},
        is_active = ${input.is_active ?? true},
        effective_date = DATE '${input.effective_date}',
        end_date = ${input.end_date ? `DATE '${input.end_date}'` : 'NULL'},
        rule_description = ${input.rule_description ? `'${input.rule_description.replace(/'/g, "''")}'` : 'NULL'},
        modified_by = '${input.modified_by.replace(/'/g, "''")}',
        modified_at = TIMESTAMP '${now}'
      WHERE config_id = '${configId}'
    `);

    await runSql(sql);
    await logConfigAudit(runSql, 'dim_comp_rule_config', configId, 'UPDATE', oldValue, JSON.stringify(input), input.modified_by);

    res.json({ success: true });
  } catch (err) {
    console.error('[Config API] Update comp rule config failed:', err);
    res.status(500).json({ error: 'Failed to update comp rule config' });
  }
}

export async function deleteCompRuleConfig(runSql: RunSql, req: Request, res: Response): Promise<void> {
  try {
    const configId = String(req.params.config_id);
    const { modified_by } = req.body;

    const oldRows = await runSql(rewriteCompCatalogSql(`
      SELECT * FROM workspace.hgv_comp.dim_comp_rule_config WHERE config_id = '${configId}'
    `)) as unknown as CompRuleConfig[];
    const oldValue = oldRows[0] ? JSON.stringify(oldRows[0]) : null;

    const sql = rewriteCompCatalogSql(`
      DELETE FROM workspace.hgv_comp.dim_comp_rule_config WHERE config_id = '${configId}'
    `);

    await runSql(sql);
    await logConfigAudit(runSql, 'dim_comp_rule_config', configId, 'DELETE', oldValue, null, modified_by);

    res.json({ success: true });
  } catch (err) {
    console.error('[Config API] Delete comp rule config failed:', err);
    res.status(500).json({ error: 'Failed to delete comp rule config' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Rep Filter Config CRUD
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchRepFilterConfigs(runSql: RunSql, _req: Request, res: Response): Promise<void> {
  try {
    const sql = rewriteCompCatalogSql(`
      SELECT 
        config_id, filter_type, filter_value, filter_parameters, is_active,
        CAST(effective_date AS STRING) as effective_date,
        CAST(end_date AS STRING) as end_date,
        rule_description, modified_by,
        CAST(modified_at AS STRING) as modified_at,
        CAST(created_at AS STRING) as created_at
      FROM workspace.hgv_comp.dim_rep_filter_config
      ORDER BY is_active DESC, filter_type, filter_value
    `);
    const rows = await runSql(sql) as unknown as RepFilterConfig[];
    res.json({ configs: rows });
  } catch (err) {
    console.error('[Config API] Fetch rep filter configs failed:', err);
    res.status(500).json({ error: 'Failed to fetch rep filter configs' });
  }
}

export async function createRepFilterConfig(runSql: RunSql, req: Request, res: Response): Promise<void> {
  try {
    const input: RepFilterConfigInput = req.body;
    const configId = `RF-${randomUUID().substring(0, 8).toUpperCase()}`;
    const now = new Date().toISOString();

    const sql = rewriteCompCatalogSql(`
      INSERT INTO workspace.hgv_comp.dim_rep_filter_config
        (config_id, filter_type, filter_value, filter_parameters, is_active, effective_date, end_date,
         rule_description, modified_by, modified_at, created_at)
      VALUES (
        '${configId}',
        '${input.filter_type.replace(/'/g, "''")}',
        '${input.filter_value.replace(/'/g, "''")}',
        ${input.filter_parameters ? `'${input.filter_parameters.replace(/'/g, "''")}'` : 'NULL'},
        ${input.is_active ?? true},
        DATE '${input.effective_date}',
        ${input.end_date ? `DATE '${input.end_date}'` : 'NULL'},
        ${input.rule_description ? `'${input.rule_description.replace(/'/g, "''")}'` : 'NULL'},
        '${input.modified_by.replace(/'/g, "''")}',
        TIMESTAMP '${now}',
        TIMESTAMP '${now}'
      )
    `);

    await runSql(sql);
    await logConfigAudit(runSql, 'dim_rep_filter_config', configId, 'INSERT', null, JSON.stringify(input), input.modified_by);

    res.json({ success: true, config_id: configId });
  } catch (err) {
    console.error('[Config API] Create rep filter config failed:', err);
    res.status(500).json({ error: 'Failed to create rep filter config' });
  }
}

export async function updateRepFilterConfig(runSql: RunSql, req: Request, res: Response): Promise<void> {
  try {
    const configId = String(req.params.config_id);
    const input: RepFilterConfigInput = req.body;
    const now = new Date().toISOString();

    const oldRows = await runSql(rewriteCompCatalogSql(`
      SELECT * FROM workspace.hgv_comp.dim_rep_filter_config WHERE config_id = '${configId}'
    `)) as unknown as RepFilterConfig[];
    const oldValue = oldRows[0] ? JSON.stringify(oldRows[0]) : null;

    const sql = rewriteCompCatalogSql(`
      UPDATE workspace.hgv_comp.dim_rep_filter_config
      SET 
        filter_type = '${input.filter_type.replace(/'/g, "''")}',
        filter_value = '${input.filter_value.replace(/'/g, "''")}',
        filter_parameters = ${input.filter_parameters ? `'${input.filter_parameters.replace(/'/g, "''")}'` : 'NULL'},
        is_active = ${input.is_active ?? true},
        effective_date = DATE '${input.effective_date}',
        end_date = ${input.end_date ? `DATE '${input.end_date}'` : 'NULL'},
        rule_description = ${input.rule_description ? `'${input.rule_description.replace(/'/g, "''")}'` : 'NULL'},
        modified_by = '${input.modified_by.replace(/'/g, "''")}',
        modified_at = TIMESTAMP '${now}'
      WHERE config_id = '${configId}'
    `);

    await runSql(sql);
    await logConfigAudit(runSql, 'dim_rep_filter_config', configId, 'UPDATE', oldValue, JSON.stringify(input), input.modified_by);

    res.json({ success: true });
  } catch (err) {
    console.error('[Config API] Update rep filter config failed:', err);
    res.status(500).json({ error: 'Failed to update rep filter config' });
  }
}

export async function deleteRepFilterConfig(runSql: RunSql, req: Request, res: Response): Promise<void> {
  try {
    const configId = String(req.params.config_id);
    const { modified_by } = req.body;

    const oldRows = await runSql(rewriteCompCatalogSql(`
      SELECT * FROM workspace.hgv_comp.dim_rep_filter_config WHERE config_id = '${configId}'
    `)) as unknown as RepFilterConfig[];
    const oldValue = oldRows[0] ? JSON.stringify(oldRows[0]) : null;

    const sql = rewriteCompCatalogSql(`
      DELETE FROM workspace.hgv_comp.dim_rep_filter_config WHERE config_id = '${configId}'
    `);

    await runSql(sql);
    await logConfigAudit(runSql, 'dim_rep_filter_config', configId, 'DELETE', oldValue, null, modified_by);

    res.json({ success: true });
  } catch (err) {
    console.error('[Config API] Delete rep filter config failed:', err);
    res.status(500).json({ error: 'Failed to delete rep filter config' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Audit Logging
// ─────────────────────────────────────────────────────────────────────────────

async function logConfigAudit(
  runSql: RunSql,
  configTable: string,
  configId: string,
  actionType: CompConfigAuditLog['action_type'],
  oldValue: string | null,
  newValue: string | null,
  modifiedBy: string
): Promise<void> {
  try {
    const auditId = `AUDIT-${randomUUID()}`;
    const now = new Date().toISOString();

    const sql = rewriteCompCatalogSql(`
      INSERT INTO workspace.hgv_comp.fact_comp_config_audit_log
        (audit_id, config_table, config_id, action_type, old_value, new_value, modified_by, modified_at, client_ip, user_agent)
      VALUES (
        '${auditId}',
        '${configTable}',
        '${configId}',
        '${actionType}',
        ${oldValue ? `'${oldValue.replace(/'/g, "''")}'` : 'NULL'},
        ${newValue ? `'${newValue.replace(/'/g, "''")}'` : 'NULL'},
        '${modifiedBy.replace(/'/g, "''")}',
        TIMESTAMP '${now}',
        NULL,
        NULL
      )
    `);

    await runSql(sql);
  } catch (err) {
    console.error('[Config API] Audit log failed:', err);
  }
}
