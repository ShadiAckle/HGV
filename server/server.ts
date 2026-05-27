import { createApp, analytics, server, serving, getWorkspaceClient } from '@databricks/appkit';
import { processEtlRecords, generateIngestionSql } from '../scripts/etl/varicent_etl_processor.js';
import { buildManagerWorkspace, formatManagerGroundingContext, formatCompactManagerInsightContext, formatManagerCoachingSignalsContext } from './managerWorkspace.js';
import { buildManagerInsightPrompt, extractAssistantContent, type ManagerInsightFocus } from './managerInsights.js';
import {
  buildRepInsightPayload,
  buildMarketingRepInsightPrompt,
  buildSalesRepInsightPrompt,
  formatCompactRepInsightContext,
  isMarketingRepId,
} from './repInsights.js';
import {
  buildBenchmarkImpactPrompt,
  parseCompImpactLines,
  resolveBenchmarkRoleKey,
} from './benchmarkImpactInsights.js';
import { ensureCompExtensionsOnce } from './compSchemaBootstrap.js';
import {
  fetchActiveInterventions,
  fetchTeamAgentPerformance,
  submitManagerInterventions,
} from './managerInterventions.js';
import { loadFinancePeriodConfig } from './financeReferenceSeed.js';
import {
  buildMarketingRepWorkspace,
  fetchIndustryBenchmarks,
  fetchRepMarketPositions,
  fetchRegionalBonusArea,
} from './marketingRepWorkspace.js';
import { fetchPlanAssessment } from './planAssessment.js';
import { mapWarehouseTeamMarket } from '../shared/benchmarkGrounding.js';
import { sanitizeInsightText } from '../shared/sanitizeInsightText.js';
import {
  applyHgvBrandFramingToImpactLines,
  applyHgvRepBrandFramingFilter,
  isFrontlineRepRoleKey,
} from '../shared/hgvRepBrandFraming.js';
import { projectScenario } from '../shared/scenarioProjection.js';
import {
  appendGenerationVariation,
  buildGenerationMeta,
  invokeServingModelDetailed,
} from './llmInvoke.js';
import { getModelServingInfo, modelInfoFromEndpoint } from './modelInfo.js';
import { fetchPlanCatalogContext } from './compCatalogSeed.js';
import { buildInterpretationPrompt, isRepFacingInterpretationKind, type InterpretationKind } from './compInterpretationInsights.js';
import { CURRENT_PERIOD_ID, DEFAULT_PERIODS } from '../shared/compPeriods.js';

function setServingResponseHeaders(
  res: { setHeader: (k: string, v: string) => void },
  endpoint: string,
): void {
  const info = modelInfoFromEndpoint(endpoint);
  res.setHeader('X-Serving-Endpoint', endpoint);
  res.setHeader('X-Serving-Is-Sonnet', info.is_sonnet_family ? 'true' : 'false');
  res.setHeader('X-Serving-Is-Fallback', info.is_fallback_model ? 'true' : 'false');
  if (info.is_fallback_model) {
    console.warn(`[LLM] Response served by fallback model: ${endpoint}`);
  }
}

let wsClient: ReturnType<typeof getWorkspaceClient> | null = null;

function planRowsForPersona(personaId: string | null) {
  if (personaId === 'marketing_manager') {
    return [
      { attribute: 'Total Comp Range (TCC)', hgvPlan: 'Average ~$130k | Top $255k–$278k' },
      { attribute: 'Metrics / Weights', hgvPlan: 'Contribution 15–20%, LM NSV 15–20%, LM Tours 15–35%, Club Pen 20–70%' },
    ];
  }
  if (personaId === 'marketing_director') {
    return [
      { attribute: 'Total Comp Range (TCC)', hgvPlan: 'Average ~$205k–$250k | Top $489k–$527k' },
      { attribute: 'Metrics / Weights', hgvPlan: 'Total NSV 40%, New Owner NSV 20%, Regional NSV 10%, DC Contribution 30%' },
    ];
  }
  return [
    { attribute: 'Total Comp Range (TCC)', hgvPlan: 'Average ~$130k–$180k | Top $250k–$300k' },
    { attribute: 'Metrics / Weights', hgvPlan: 'Team NSV 35%, Direct Report Attainment 25%, FFS Mix 15%, VPG 10%, Override/TO 15%' },
  ];
}

const MARKETING_CHANNEL_IDENTITIES = [
  { rep_id: 'PERSONA-MKT-REP', rep_name: 'T. Brooks', level_code: 'C2a', team_id: 'TEAM-MKT-LAS', region: 'West', is_active: true, role_title: 'Marketing Representative', persona_id: 'marketing_rep', plan_id: 'PLAN-MKT-REP-2026', identity_group: 'marketing_channel' },
  { rep_id: 'PERSONA-MKT-MGR', rep_name: 'R. Castillo', level_code: 'C2b', team_id: 'TEAM-MKT-LAS', region: 'West', is_active: true, role_title: 'Marketing Manager', persona_id: 'marketing_manager', plan_id: 'PLAN-MKT-MGR-2026', identity_group: 'marketing_channel' },
  { rep_id: 'PERSONA-MKT-DIR', rep_name: 'D. Whitfield', level_code: 'C2c', team_id: 'TEAM-MKT-REG', region: 'West', is_active: true, role_title: 'Marketing Director', persona_id: 'marketing_director', plan_id: 'PLAN-MKT-DIR-2026', identity_group: 'marketing_channel' },
] as const;

const appkit = await createApp({
  plugins: [
    analytics({ timeout: 120_000 }),
    server({ autoStart: false }),
    serving(),
  ],
});

// ─── Comp Copilot ────────────────────────────────────────────────────────────
// Uses app service principal (not user OBO) — avoids model-serving scope issue.
appkit.server.extend((app) => {
  app.post('/api/comp/copilot/invoke', async (req, res) => {
    try {
      const { payload, endpoint } = await invokeServingModelDetailed(appkit, req.body as Record<string, unknown>);
      setServingResponseHeaders(res, endpoint);
      res.json(payload);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invocation failed';
      res.status(502).json({ error: message });
    }
  });

  // GET /api/comp/model-info — configured Foundation Model endpoint (verify Sonnet vs fallback)
  app.get('/api/comp/model-info', async (_req, res) => {
    try {
      const info = await getModelServingInfo();
      res.json(info);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Model info failed';
      res.status(502).json({ error: message });
    }
  });

  app.post('/api/comp/copilot/mentions-lookup', async (req, res) => {
    try {
      const { mentions } = req.body as { mentions?: string[] };
      if (!mentions || !Array.isArray(mentions)) {
        res.json({});
        return;
      }

      const results: Record<string, string> = {};

      for (const mention of mentions) {
        const [type, id] = mention.split(':');
        if (!type || !id) continue;

        const cleanId = id.replace(/'/g, "''");

        if (type === 'rep') {
          const repInfo = await runSql(`
            SELECT r.rep_id, r.rep_name, r.level_code, r.team_id, r.manager_rep_id, r.region, r.is_active
            FROM workspace.hgv_comp.dim_rep r
            WHERE r.rep_id = '${cleanId}'
          `);
          if (repInfo.length > 0) {
            const rep = repInfo[0];
            const marketingPeriod = await runSql(`
              SELECT qtd_earnings, total_payout, qualified_tours, tours_shown, show_rate_pct,
                     penetration_pct, chargebacks, plan_id, assigned_area
              FROM workspace.hgv_comp.fact_marketing_rep_period
              WHERE rep_id = '${cleanId}'
              ORDER BY period_id DESC LIMIT 1
            `);
            if (marketingPeriod.length > 0) {
              results[mention] = JSON.stringify({
                profile: rep,
                channel: 'marketing',
                period: marketingPeriod[0],
              }, null, 2);
              continue;
            }
            const payouts = await runSql(`
              SELECT base_pay, commission, bonus, total_earnings, total_paid AS paid_to_date
              FROM workspace.hgv_comp.fact_payout
              WHERE rep_id = '${cleanId}'
            `);
            const quotas = await runSql(`
              SELECT quota_amount, credited_amount, attainment_pct AS quota_attainment_pct, deals_closed_count, next_tier_threshold_pct, next_tier_gap_amount
              FROM workspace.hgv_comp.fact_quota_attainment
              WHERE rep_id = '${cleanId}'
            `);
            results[mention] = JSON.stringify({
              profile: rep,
              channel: 'sales',
              earnings: payouts[0] || null,
              quota: quotas[0] || null
            }, null, 2);
          } else {
            results[mention] = `Rep ID ${id} not found in database.`;
          }
        } else if (type === 'team') {
          const teamInfo = await runSql(`
            SELECT team_id, team_name, region
            FROM workspace.hgv_comp.dim_team
            WHERE team_id = '${cleanId}'
          `);
          if (teamInfo.length > 0) {
            const team = teamInfo[0];
            const stats = await runSql(`
              SELECT team_attainment_pct AS avg_quota_attainment_pct, top_performer_count AS top_performers_count, at_risk_count, ffs_sales_pct, ffs_target_pct
              FROM workspace.hgv_comp.fact_team_snapshot
              WHERE team_id = '${cleanId}'
            `);
            results[mention] = JSON.stringify({
              team,
              stats: stats[0] || null
            }, null, 2);
          } else {
            results[mention] = `Team ID ${id} not found in database.`;
          }
        } else if (type === 'scenario') {
          const scenarioInfo = await runSql(`
            SELECT scenario_id, scenario_name, period_id, quota_change_pct, commission_rate_pct, bonus_rate_change_pct, accelerator_change_pct, created_by
            FROM workspace.hgv_comp.scenario_run
            WHERE scenario_id = '${cleanId}'
          `);
          if (scenarioInfo.length > 0) {
            const scn = scenarioInfo[0];
            const resultsData = await runSql(`
              SELECT projected_payouts, budget_impact, projected_cost, expected_performance_pct
              FROM workspace.hgv_comp.scenario_result
              WHERE scenario_id = '${cleanId}'
            `);
            results[mention] = JSON.stringify({
              scenario: scn,
              results: resultsData[0] || null
            }, null, 2);
          } else {
            results[mention] = `Scenario ID ${id} not found in database.`;
          }
        } else if (type === 'deal') {
          const dealInfo = await runSql(`
            SELECT deal_id, rep_id, period_id, product_line_id AS product_id, property_code AS sku,
                   property_display_name AS description,
                   credit_amount AS amount,
                   credit_status AS status,
                   credit_date AS close_date
            FROM workspace.hgv_comp.fact_deal_credit
            WHERE deal_id = '${cleanId}'
          `);
          if (dealInfo.length > 0) {
            results[mention] = JSON.stringify(dealInfo[0], null, 2);
          } else {
            // Also check for partial descriptions/guest name
            const searchResults = await runSql(`
              SELECT deal_id, rep_id, period_id, property_code AS sku,
                     property_display_name AS description,
                     credit_amount AS amount,
                     credit_status AS status,
                     credit_date AS close_date
              FROM workspace.hgv_comp.fact_deal_credit
              WHERE deal_id = '${cleanId}' OR UPPER(property_display_name) LIKE UPPER('%${cleanId}%')
            `);
            if (searchResults.length > 0) {
              results[mention] = JSON.stringify(searchResults, null, 2);
            } else {
              results[mention] = `Deal/Guest ID or Name ${id} not found in database.`;
            }
          }
        }
      }

      res.json(results);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lookup failed';
      res.status(502).json({ error: message });
    }
  });

  // GET /api/comp/copilot/mentions-search?q=&type= — live mention autocomplete search
  // Called as user types after `@` in the copilot input box. Returns up to 10 matching items.
  app.get('/api/comp/copilot/mentions-search', async (req, res) => {
    try {
      const q = String(req.query.q ?? '').trim().replace(/'/g, "''").toLowerCase();
      const type = String(req.query.type ?? 'all');

      const items: { key: string; label: string; category: string }[] = [];

      async function safeQuery(sql: string) {
        try { return await runSql(sql); } catch { return []; }
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

      res.json(items);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Search failed';
      res.status(502).json({ error: message });
    }
  });

  // GET /api/comp/user-profile — dynamically inspects Databricks App identity headers and maps to DB rep
  app.get('/api/comp/user-profile', async (req, res) => {
    try {
      const usernameHeader = req.headers['x-user-username'] || req.headers['x-forwarded-user'] || req.headers['x-user-email'] || '';
      const rawUser = String(usernameHeader).trim();

      // For offline/local development, fallback to 'REP-MGR-01' to allow full role testing/impersonation
      let matchedRepId = 'REP-MGR-01';
      const cleanUser = rawUser.toLowerCase();

      if (cleanUser) {
        if (cleanUser.includes('jason')) matchedRepId = 'REP-JASON';
        else if (cleanUser.includes('smith')) matchedRepId = 'REP-RSMITH';
        else if (cleanUser.includes('carter')) matchedRepId = 'REP-ECARTER';
        else if (cleanUser.includes('lee')) matchedRepId = 'REP-DLEE';
        else if (cleanUser.includes('nguyen')) matchedRepId = 'REP-KNGUYEN';
        else if (cleanUser.includes('barsoum') || cleanUser.includes('john') || cleanUser.includes('ackle')) matchedRepId = 'REP-MGR-01';
        else if (cleanUser.includes('vance') || cleanUser.includes('mgr') || cleanUser.includes('admin') || cleanUser.includes('vp') || cleanUser.includes('director') || cleanUser.includes('lead') || cleanUser.includes('ops')) matchedRepId = 'REP-MGR-01';
        else {
          // Look up dynamically by matching name in the database
          try {
            const searchRep = await runSql(`
              SELECT rep_id FROM workspace.hgv_comp.dim_rep
              WHERE LOWER(rep_name) LIKE '%${cleanUser.replace(/'/g, "''")}%' OR LOWER(rep_id) = '${cleanUser.replace(/'/g, "''")}'
              LIMIT 1
            `);
            if (searchRep.length > 0) {
              matchedRepId = String(searchRep[0].rep_id);
            }
          } catch (err) {
            console.error('Failed to lookup rep by username header:', err);
          }
        }
      }

      const repRows = await runSql(`
        SELECT rep_id, rep_name, level_code, team_id, manager_rep_id, region, is_active
        FROM workspace.hgv_comp.dim_rep
        WHERE rep_id = '${matchedRepId}'
      `);

      if (repRows.length === 0) {
        const marketing = MARKETING_CHANNEL_IDENTITIES.find((m) => m.rep_id === matchedRepId);
        if (marketing) {
          const isManager = marketing.persona_id === 'marketing_manager' || marketing.persona_id === 'marketing_director';
          res.json({
            rep_id: marketing.rep_id,
            rep_name: marketing.rep_name,
            level_code: marketing.level_code,
            team_id: marketing.team_id,
            team_name: marketing.persona_id === 'marketing_director' ? 'Regional Marketing' : 'Las Vegas Marketing',
            region: marketing.region,
            is_manager: isManager,
            role_title: marketing.role_title,
            persona_id: marketing.persona_id,
            plan_id: marketing.plan_id,
            username: rawUser || 'local_development',
          });
          return;
        }
        res.json({
          rep_id: 'REP-MGR-01',
          rep_name: 'M. Vance',
          level_code: 'L9',
          team_id: 'TEAM-WEST',
          team_name: 'West Coast Sales',
          region: 'West',
          is_manager: true,
          username: rawUser || 'local_development'
        });
        return;
      }

      const rep = repRows[0];
      const isManager = String(rep.rep_id).includes('MGR') || String(rep.level_code) === 'L9';
      const roleTitle = isManager ? 'Sales Manager' : 'Sales Executive';

      const teamRows = await runSql(`
        SELECT team_name, region FROM workspace.hgv_comp.dim_team
        WHERE team_id = '${String(rep.team_id).replace(/'/g, "''")}'
      `);
      const teamName = teamRows.length > 0 ? String(teamRows[0].team_name) : 'West Coast Sales';
      const region = teamRows.length > 0 ? String(teamRows[0].region) : String(rep.region);

      res.json({
        rep_id: rep.rep_id,
        rep_name: rep.rep_name,
        level_code: rep.level_code,
        team_id: rep.team_id,
        team_name: teamName,
        region: region,
        is_manager: isManager,
        role_title: roleTitle,
        username: rawUser || 'local_development'
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Profile lookup failed';
      res.status(502).json({ error: message });
    }
  });

  // GET /api/comp/manager/workspace — manager comp, direct reports, tours, AI action items
  app.get('/api/comp/manager/workspace', async (req, res) => {
    const managerRepId = String(req.query.manager_rep_id ?? '').replace(/'/g, "''");
    const periodId = String(req.query.period_id ?? CURRENT_PERIOD_ID).replace(/'/g, "''");
    if (!managerRepId) {
      res.status(400).json({ error: 'manager_rep_id is required' });
      return;
    }
    try {
      const payload = await buildManagerWorkspace(runSql, managerRepId, periodId);
      const planRows = planRowsForPersona(payload.persona_id);
      res.json({
        ...payload,
        grounding_context: formatManagerGroundingContext(payload, planRows),
        insights_context: formatCompactManagerInsightContext(payload, planRows),
        coaching_signals_context: formatManagerCoachingSignalsContext(payload),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Manager workspace failed';
      res.status(502).json({ error: message });
    }
  });

  // GET /api/comp/manager/interventions?target_rep_id=&period_id=
  app.get('/api/comp/manager/interventions', async (req, res) => {
    const targetRepId = String(req.query.target_rep_id ?? '').replace(/'/g, "''");
    const periodId = String(req.query.period_id ?? CURRENT_PERIOD_ID).replace(/'/g, "''");
    if (!targetRepId) {
      res.status(400).json({ error: 'target_rep_id is required' });
      return;
    }
    try {
      await ensureCompExtensionsOnce(runSql);
      const interventions = await fetchActiveInterventions(runSql, targetRepId, periodId);
      res.json({ interventions, period_id: periodId, target_rep_id: targetRepId });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Intervention query failed';
      res.status(502).json({ error: message });
    }
  });

  // POST /api/comp/manager/interventions — persist co-sell pricing auth + quota relief
  app.post('/api/comp/manager/interventions', async (req, res) => {
    const body = req.body as {
      manager_rep_id?: string;
      target_rep_id?: string;
      period_id?: string;
      manager_name?: string;
      takeover_pricing?: { enabled: boolean; discount_pct: number; tour_id?: string | null };
      quota_shield?: { enabled: boolean; relief_pct?: number };
      notes?: string;
    };
    const managerRepId = String(body.manager_rep_id ?? '').trim();
    const targetRepId = String(body.target_rep_id ?? '').trim();
    const periodId = String(body.period_id ?? CURRENT_PERIOD_ID).trim();
    if (!managerRepId || !targetRepId) {
      res.status(400).json({ error: 'manager_rep_id and target_rep_id are required' });
      return;
    }
    if (!body.takeover_pricing?.enabled && !body.quota_shield?.enabled) {
      res.status(400).json({ error: 'Enable at least one lever: takeover_pricing or quota_shield' });
      return;
    }
    try {
      await ensureCompExtensionsOnce(runSql);
      const result = await submitManagerInterventions(
        runSql,
        {
          manager_rep_id: managerRepId,
          target_rep_id: targetRepId,
          period_id: periodId,
          takeover_pricing: body.takeover_pricing,
          quota_shield: body.quota_shield,
          notes: body.notes,
        },
        body.manager_name,
      );
      res.json({
        ok: true,
        interventions: result.interventions,
        admin_event_ids: result.admin_event_ids,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Intervention submit failed';
      res.status(502).json({ error: message });
    }
  });

  // GET /api/comp/team/agent-performance?team_id=&period_id= — sales leaderboard (warehouse)
  app.get('/api/comp/team/agent-performance', async (req, res) => {
    const teamId = String(req.query.team_id ?? '').replace(/'/g, "''");
    const periodId = String(req.query.period_id ?? CURRENT_PERIOD_ID).replace(/'/g, "''");
    if (!teamId) {
      res.status(400).json({ error: 'team_id is required' });
      return;
    }
    try {
      await ensureCompExtensionsOnce(runSql);
      const agents = await fetchTeamAgentPerformance(runSql, teamId, periodId);
      res.json({ agents, team_id: teamId, period_id: periodId });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Leaderboard query failed';
      res.status(502).json({ error: message });
    }
  });

  // GET /api/comp/marketing/workspace — marketing rep My Comp (warehouse-backed)
  app.get('/api/comp/marketing/workspace', async (req, res) => {
    const repId = String(req.query.rep_id ?? 'PERSONA-MKT-REP').replace(/'/g, "''");
    const periodId = String(req.query.period_id ?? CURRENT_PERIOD_ID).replace(/'/g, "''");
    try {
      await ensureCompExtensionsOnce(runSql);
      const payload = await buildMarketingRepWorkspace(runSql, repId, periodId);
      res.json(payload);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Marketing workspace failed';
      res.status(502).json({ error: message });
    }
  });

  // GET /api/comp/benchmarks/team — rep pay vs industry (fact_rep_market_position)
  app.get('/api/comp/benchmarks/team', async (req, res) => {
    const periodId = String(req.query.period_id ?? CURRENT_PERIOD_ID);
    try {
      await ensureCompExtensionsOnce(runSql);
      const rows = await fetchRepMarketPositions(runSql, periodId);
      res.json(rows);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Benchmark query failed';
      res.status(502).json({ error: message });
    }
  });

  // GET /api/comp/plan-assessment — HGV vs market plan design by persona
  app.get('/api/comp/plan-assessment', async (req, res) => {
    const personaId = String(req.query.persona_id ?? 'marketing_rep');
    const periodId = String(req.query.period_id ?? CURRENT_PERIOD_ID);
    try {
      await ensureCompExtensionsOnce(runSql);
      const payload = await fetchPlanAssessment(runSql, personaId, periodId);
      if (!payload) {
        res.status(404).json({ error: `No plan assessment for ${personaId}` });
        return;
      }
      res.json(payload);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Plan assessment query failed';
      res.status(502).json({ error: message });
    }
  });

  // GET /api/comp/benchmarks/industry — industry_comp_benchmark rows
  app.get('/api/comp/benchmarks/industry', async (req, res) => {
    const periodId = String(req.query.period_id ?? CURRENT_PERIOD_ID);
    const roleKey = req.query.role_key ? String(req.query.role_key) : undefined;
    try {
      await ensureCompExtensionsOnce(runSql);
      const rows = await fetchIndustryBenchmarks(runSql, roleKey, periodId);
      res.json(rows);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Industry benchmark query failed';
      res.status(502).json({ error: message });
    }
  });

  // GET /api/comp/benchmarks/regional-bonus — Jan 2025 bonus levels by area (PDF seed in Delta)
  app.get('/api/comp/benchmarks/regional-bonus', async (req, res) => {
    const areaId = String(req.query.area_id ?? 'LV-HGV-AL');
    const periodId = String(req.query.period_id ?? CURRENT_PERIOD_ID);
    try {
      await ensureCompExtensionsOnce(runSql);
      const payload = await fetchRegionalBonusArea(runSql, areaId, periodId);
      if (!payload) {
        res.status(404).json({ error: `No regional bonus data for ${areaId} / ${periodId}` });
        return;
      }
      res.json(payload);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Regional bonus query failed';
      res.status(502).json({ error: message });
    }
  });

  // POST /api/comp/manager/insights — LLM-generated executive brief for manager comp page
  app.post('/api/comp/manager/insights', async (req, res) => {
    const {
      manager_rep_id: managerRepId,
      period_id: periodId = CURRENT_PERIOD_ID,
      role_title: roleTitle,
      insights_context: insightsContext,
      grounding_context: groundingContext,
      focus: insightFocus = 'payout',
      persona_id: personaId,
      refresh_key: refreshKey,
    } = req.body as {
      manager_rep_id?: string;
      period_id?: string;
      role_title?: string;
      insights_context?: string;
      grounding_context?: string;
      focus?: ManagerInsightFocus;
      persona_id?: string;
      refresh_key?: string;
    };

    try {
      let context = typeof insightsContext === 'string' ? insightsContext : '';
      let resolvedRole = roleTitle ?? 'Manager';

      if (managerRepId) {
        const payload = await buildManagerWorkspace(runSql, String(managerRepId), String(periodId));
        const planRows = planRowsForPersona(payload.persona_id);
        context = formatCompactManagerInsightContext(payload, planRows);
        resolvedRole = payload.role_title;
      } else if (groundingContext) {
        context = groundingContext.slice(0, 12000);
      }

      if (!context) {
        res.status(400).json({ error: 'manager_rep_id or insights_context is required' });
        return;
      }

      await ensureCompExtensionsOnce(runSql);
      const focus = insightFocus === 'coaching' ? 'coaching' : 'payout';
      const managerBenchmarkRole =
        personaId ??
        (resolvedRole.toLowerCase().includes('director')
          ? 'marketing_director'
          : resolvedRole.toLowerCase().includes('marketing')
            ? 'marketing_manager'
            : 'sales_manager');
      const [industryRows, teamRows] = await Promise.all([
        fetchIndustryBenchmarks(runSql, managerBenchmarkRole, String(periodId)),
        focus === 'coaching' ? fetchRepMarketPositions(runSql, String(periodId)) : Promise.resolve([]),
      ]);

      const prompt = appendGenerationVariation(
        buildManagerInsightPrompt(context, resolvedRole, focus, {
          industryBenchmarks: industryRows,
          teamMarketPositions: mapWarehouseTeamMarket(teamRows),
        }),
        refreshKey,
      );
      const requestBody = {
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1024,
        temperature: 0.6,
        top_p: 0.92,
      };

      let content = '';
      let servingEndpoint = '';
      try {
        const { payload, endpoint } = await invokeServingModelDetailed(appkit, requestBody);
        servingEndpoint = endpoint;
        content = extractAssistantContent(payload);
      } catch (invokeErr) {
        const message = invokeErr instanceof Error ? invokeErr.message : 'Model invocation failed';
        console.warn('Manager insight model invoke failed:', invokeErr);
        res.status(502).json({ error: message, source: 'llm_failed' });
        return;
      }

      if (!content) {
        res.status(502).json({ error: 'Model returned empty insight', source: 'llm_empty' });
        return;
      }

      res.setHeader('X-Insight-Source', 'llm');
      setServingResponseHeaders(res, servingEndpoint);
      res.json({
        insight: sanitizeInsightText(content),
        source: 'llm',
        meta: buildGenerationMeta(servingEndpoint, refreshKey),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Insight generation failed';
      res.status(502).json({ error: message });
    }
  });

  // POST /api/comp/rep/insights — LLM-generated payout brief for sales & marketing reps
  app.post('/api/comp/rep/insights', async (req, res) => {
    const {
      rep_id: repId,
      period_id: periodId = CURRENT_PERIOD_ID,
      role_title: roleTitle,
      insights_context: insightsContext,
      channel = 'sales',
      refresh_key: refreshKey,
    } = req.body as {
      rep_id?: string;
      period_id?: string;
      role_title?: string;
      insights_context?: string;
      channel?: 'sales' | 'marketing';
      refresh_key?: string;
    };

    try {
      let context = typeof insightsContext === 'string' ? insightsContext : '';
      let resolvedRole = roleTitle ?? 'Sales Executive';
      const useMarketing = channel === 'marketing' || (repId && isMarketingRepId(String(repId)));

      if (!context && repId && !useMarketing) {
        const payload = await buildRepInsightPayload(runSql, String(repId), String(periodId));
        context = formatCompactRepInsightContext(payload);
        resolvedRole = payload.role_title;
      }

      if (!context) {
        res.status(400).json({ error: 'rep_id (sales) or insights_context (marketing) is required' });
        return;
      }

      await ensureCompExtensionsOnce(runSql);
      const benchmarkRoleKey = useMarketing ? 'marketing_rep' : 'sales_executive';
      const industryRows = await fetchIndustryBenchmarks(runSql, benchmarkRoleKey, String(periodId));
      const grounding = { industryBenchmarks: industryRows };

      const basePrompt = useMarketing
        ? buildMarketingRepInsightPrompt(context.slice(0, 12000), resolvedRole, grounding)
        : buildSalesRepInsightPrompt(context.slice(0, 12000), resolvedRole, grounding);
      const prompt = appendGenerationVariation(basePrompt, refreshKey);

      const requestBody = {
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1024,
        temperature: 0.6,
        top_p: 0.92,
      };

      let content = '';
      let servingEndpoint = '';
      try {
        const { payload, endpoint } = await invokeServingModelDetailed(appkit, requestBody);
        servingEndpoint = endpoint;
        content = extractAssistantContent(payload);
      } catch (invokeErr) {
        const message = invokeErr instanceof Error ? invokeErr.message : 'Model invocation failed';
        console.warn('Rep insight model invoke failed:', invokeErr);
        res.status(502).json({ error: message, source: 'llm_failed' });
        return;
      }

      if (!content) {
        res.status(502).json({ error: 'Model returned empty insight', source: 'llm_empty' });
        return;
      }

      res.setHeader('X-Insight-Source', 'llm');
      setServingResponseHeaders(res, servingEndpoint);
      res.json({
        insight: applyHgvRepBrandFramingFilter(sanitizeInsightText(content)),
        source: 'llm',
        meta: buildGenerationMeta(servingEndpoint, refreshKey),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Insight generation failed';
      res.status(502).json({ error: message });
    }
  });

  // POST /api/comp/rep/benchmark-impact — LLM-synthesized industry benchmark impact cards
  app.post('/api/comp/rep/benchmark-impact', async (req, res) => {
    const {
      rep_id: repId,
      period_id: periodId = CURRENT_PERIOD_ID,
      role_title: roleTitle = 'Marketing Representative',
      role_key: roleKeyRaw,
      insights_context: insightsContext,
      refresh_key: refreshKey,
    } = req.body as {
      rep_id?: string;
      period_id?: string;
      role_title?: string;
      role_key?: string;
      insights_context?: string;
      refresh_key?: string;
    };

    try {
      const context = typeof insightsContext === 'string' ? insightsContext.trim() : '';
      if (!context) {
        res.status(400).json({ error: 'insights_context is required' });
        return;
      }

      const roleKey = resolveBenchmarkRoleKey(roleKeyRaw);
      await ensureCompExtensionsOnce(runSql);
      const industryRows = await fetchIndustryBenchmarks(runSql, roleKey, String(periodId));
      const prompt = appendGenerationVariation(
        buildBenchmarkImpactPrompt(context.slice(0, 12000), roleTitle, roleKey, {
          industryBenchmarks: industryRows,
        }),
        refreshKey,
      );

      const requestBody = {
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1800,
        temperature: 0.55,
        top_p: 0.92,
      };

      let content = '';
      let servingEndpoint = '';
      try {
        const { payload, endpoint } = await invokeServingModelDetailed(appkit, requestBody);
        servingEndpoint = endpoint;
        content = extractAssistantContent(payload);
      } catch (invokeErr) {
        const message = invokeErr instanceof Error ? invokeErr.message : 'Model invocation failed';
        console.warn('Benchmark impact model invoke failed:', invokeErr);
        res.status(502).json({ error: message, source: 'llm_failed' });
        return;
      }

      if (!content) {
        res.status(502).json({ error: 'Model returned empty benchmark impact', source: 'llm_empty' });
        return;
      }

      let areas;
      try {
        areas = parseCompImpactLines(content);
        if (isFrontlineRepRoleKey(roleKey)) {
          areas = applyHgvBrandFramingToImpactLines(areas);
        }
      } catch (parseErr) {
        const message = parseErr instanceof Error ? parseErr.message : 'Failed to parse model JSON';
        res.status(502).json({ error: message, source: 'llm_parse_failed', raw: content.slice(0, 500) });
        return;
      }

      res.setHeader('X-Insight-Source', 'llm');
      setServingResponseHeaders(res, servingEndpoint);
      res.json({
        areas,
        source: 'llm',
        rep_id: repId ?? null,
        period_id: periodId,
        role_key: roleKey,
        meta: buildGenerationMeta(servingEndpoint, refreshKey),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Benchmark impact generation failed';
      res.status(502).json({ error: message });
    }
  });

  async function handleInterpretationInsight(
    kind: InterpretationKind,
    req: { body: { insights_context?: string; role_title?: string; refresh_key?: string } },
    res: {
      status: (code: number) => { json: (body: unknown) => void };
      setHeader: (k: string, v: string) => void;
      json: (body: unknown) => void;
    },
  ): Promise<void> {
    const {
      insights_context: insightsContext,
      role_title: roleTitle = 'Compensation Analyst',
      refresh_key: refreshKey,
    } = req.body;

    const context = typeof insightsContext === 'string' ? insightsContext.trim() : '';
    if (!context) {
      res.status(400).json({ error: 'insights_context is required' });
      return;
    }

    const prompt = appendGenerationVariation(
      buildInterpretationPrompt(kind, context, roleTitle),
      refreshKey,
    );
    const requestBody = {
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 768,
      temperature: 0.55,
      top_p: 0.92,
    };

    let content = '';
    let servingEndpoint = '';
    try {
      const { payload, endpoint } = await invokeServingModelDetailed(appkit, requestBody);
      servingEndpoint = endpoint;
      content = extractAssistantContent(payload);
    } catch (invokeErr) {
      const message = invokeErr instanceof Error ? invokeErr.message : 'Model invocation failed';
      console.warn(`${kind} interpretation invoke failed:`, invokeErr);
      res.status(502).json({ error: message, source: 'llm_failed' });
      return;
    }

    if (!content) {
      res.status(502).json({ error: 'Model returned empty interpretation', source: 'llm_empty' });
      return;
    }

    res.setHeader('X-Insight-Source', 'llm');
    setServingResponseHeaders(res, servingEndpoint);
    const insightText = isRepFacingInterpretationKind(kind)
      ? applyHgvRepBrandFramingFilter(sanitizeInsightText(content))
      : sanitizeInsightText(content);
    res.json({
      insight: insightText,
      source: 'llm',
      meta: buildGenerationMeta(servingEndpoint, refreshKey),
    });
  }

  app.post('/api/comp/scenario/insights', async (req, res) => {
    try {
      await handleInterpretationInsight('scenario', req, res);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Scenario interpretation failed';
      res.status(502).json({ error: message });
    }
  });

  app.post('/api/comp/plan-assessment/insights', async (req, res) => {
    try {
      await handleInterpretationInsight('plan_assessment', req, res);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Plan assessment interpretation failed';
      res.status(502).json({ error: message });
    }
  });

  app.post('/api/comp/pay-mix/insights', async (req, res) => {
    try {
      await handleInterpretationInsight('pay_mix', req, res);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Pay mix interpretation failed';
      res.status(502).json({ error: message });
    }
  });

  app.post('/api/comp/marketing/tour-insights', async (req, res) => {
    try {
      await handleInterpretationInsight('tour_activity', req, res);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Tour activity interpretation failed';
      res.status(502).json({ error: message });
    }
  });

  app.post('/api/comp/rep/earnings-interpretation', async (req, res) => {
    try {
      await handleInterpretationInsight('earnings_snapshot', req, res);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Earnings interpretation failed';
      res.status(502).json({ error: message });
    }
  });

  app.post('/api/comp/manager/coaching-signals', async (req, res) => {
    try {
      await handleInterpretationInsight('team_coaching_signals', req, res);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Coaching signals generation failed';
      res.status(502).json({ error: message });
    }
  });

  // GET /api/comp/metadata — lists active Reps, Teams, Periods, Scenarios, and Deals from the warehouse
  app.get('/api/comp/metadata', async (_req, res) => {
    try {
      async function safeQuery(sql: string) {
        try { return await runSql(sql); } catch { return []; }
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

      res.json({
        reps,
        teams,
        periods,
        scenarios,
        deals,
        counts: {
          deals: Number(counts.deal_count ?? 0),
          payouts: Number(counts.payout_count ?? 0),
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Metadata lookup failed';
      res.status(502).json({ error: message });
    }
  });

  // ─── Comp Admin Agent API ───────────────────────────────────────────────────

  // GET /api/comp/admin/eligibility?rep_id=&period_id=
  app.get('/api/comp/admin/eligibility', async (req, res) => {
    const repId = String(req.query.rep_id ?? '').replace(/'/g, "''");
    const periodId = String(req.query.period_id ?? CURRENT_PERIOD_ID).replace(/'/g, "''");
    try {
      async function safeQ(sql: string) { try { return await runSql(sql); } catch { return []; } }

      const eligibility = await safeQ(`
        SELECT pe.rep_id, pe.period_id, pe.plan_version_id,
               COALESCE(pv.plan_name, pe.plan_version_id) AS plan_name,
               pe.job_code, pe.location_code, pe.brand,
               CAST(pe.effective_start AS STRING) AS effective_start,
               CAST(pe.effective_end   AS STRING) AS effective_end,
               pe.proration_pct, pe.eligibility_flag, pe.exclusion_reason
        FROM workspace.hgv_comp.fact_plan_eligibility pe
        LEFT JOIN workspace.hgv_comp.dim_plan_version pv
          ON pe.plan_version_id = pv.plan_version_id
        WHERE pe.rep_id = '${repId}' AND pe.period_id = '${periodId}'
      `);

      const repInfo = await safeQ(`
        SELECT rep_id, rep_name, level_code, team_id, region
        FROM workspace.hgv_comp.dim_rep
        WHERE rep_id = '${repId}'
      `);

      res.json({
        eligibility: eligibility[0] ?? null,
        rep: repInfo[0] ?? null,
      });
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : 'Query failed' });
    }
  });

  // GET /api/comp/admin/catalog-context?period_id= — plan roster + components for copilot grounding
  app.get('/api/comp/admin/catalog-context', async (req, res) => {
    const periodId = String(req.query.period_id ?? CURRENT_PERIOD_ID).replace(/'/g, "''");
    try {
      const { roster, components } = await fetchPlanCatalogContext(runSql, periodId);
      res.json({ roster, components, period_id: periodId });
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : 'Catalog context failed' });
    }
  });

  // GET /api/comp/admin/payout-trail?rep_id=&period_id=
  app.get('/api/comp/admin/payout-trail', async (req, res) => {
    const repId    = String(req.query.rep_id    ?? '').replace(/'/g, "''");
    const periodId = String(req.query.period_id ?? CURRENT_PERIOD_ID).replace(/'/g, "''");
    try {
      async function safeQ(sql: string) { try { return await runSql(sql); } catch { return []; } }

      const quota = await safeQ(`
        SELECT quota_amount, credited_amount, attainment_pct, deals_closed_count,
               next_tier_threshold_pct, next_tier_gap_amount
        FROM workspace.hgv_comp.fact_quota_attainment
        WHERE rep_id = '${repId}' AND period_id = '${periodId}'
      `);

      const payout = await safeQ(`
        SELECT base_pay, commission, bonus, total_earnings, total_paid
        FROM workspace.hgv_comp.fact_payout
        WHERE rep_id = '${repId}' AND period_id = '${periodId}'
      `);

      const deals = await safeQ(`
        SELECT deal_id, credit_amount, credit_status, credit_date,
               property_display_name, product_line_id
        FROM workspace.hgv_comp.fact_deal_credit
        WHERE rep_id = '${repId}' AND period_id = '${periodId}'
        ORDER BY credit_date
      `);

      const adjustments = await safeQ(`
        SELECT event_id, event_type, amount, reason, approved_by,
               CAST(created_at AS STRING) AS created_at
        FROM workspace.hgv_comp.fact_comp_admin_log
        WHERE rep_id = '${repId}' AND period_id = '${periodId}'
          AND event_type IN ('ADJUSTMENT','MANUAL_PAY','CHARGEBACK','TAKEOVER_PRICING','QUOTA_SHIELD')
        ORDER BY created_at
      `);

      const totalAdj = (adjustments as any[]).reduce((sum, e) => sum + Number(e.amount ?? 0), 0);
      const baseCommission = Number((payout[0] as any)?.commission ?? 0);
      const netAfterAdj = baseCommission + totalAdj;

      res.json({
        quota: quota[0] ?? null,
        payout: payout[0] ?? null,
        deals,
        adjustments,
        summary: {
          deals_credited: deals.length,
          total_adjustments: totalAdj,
          net_commission_after_adj: netAfterAdj,
          plan_version: 'PLAN-FT-2026',
        },
      });
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : 'Query failed' });
    }
  });

  // GET /api/comp/admin/chargebacks?rep_id=&period_id=
  app.get('/api/comp/admin/chargebacks', async (req, res) => {
    const repId    = String(req.query.rep_id    ?? '').replace(/'/g, "''");
    const periodId = String(req.query.period_id ?? CURRENT_PERIOD_ID).replace(/'/g, "''");
    try {
      async function safeQ(sql: string) { try { return await runSql(sql); } catch { return []; } }

      const whereClause = repId
        ? `WHERE rep_id = '${repId}' AND period_id = '${periodId}'`
        : `WHERE period_id = '${periodId}'`;

      const chargebacks = await safeQ(`
        SELECT chargeback_id, deal_id, rep_id, period_id,
               original_commission, chargeback_amount, reserve_held, reserve_released,
               reason, status
        FROM workspace.hgv_comp.fact_chargeback
        ${whereClause}
        ORDER BY chargeback_id
      `);

      const totals = (chargebacks as any[]).reduce((acc, cb) => ({
        total_chargebacks: acc.total_chargebacks + Number(cb.chargeback_amount ?? 0),
        total_reserve_held: acc.total_reserve_held + Number(cb.reserve_held ?? 0),
        total_reserve_released: acc.total_reserve_released + Number(cb.reserve_released ?? 0),
        open_count: acc.open_count + (cb.status === 'OPEN' ? 1 : 0),
        closed_count: acc.closed_count + (cb.status === 'CLOSED' ? 1 : 0),
      }), { total_chargebacks: 0, total_reserve_held: 0, total_reserve_released: 0, open_count: 0, closed_count: 0 });

      res.json({ chargebacks, totals });
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : 'Query failed' });
    }
  });

  // GET /api/comp/admin/adjustments?rep_id=&period_id=
  app.get('/api/comp/admin/adjustments', async (req, res) => {
    const repId    = String(req.query.rep_id    ?? '').replace(/'/g, "''");
    const periodId = String(req.query.period_id ?? CURRENT_PERIOD_ID).replace(/'/g, "''");
    try {
      async function safeQ(sql: string) { try { return await runSql(sql); } catch { return []; } }
      const rows = await safeQ(`
        SELECT event_id, rep_id, period_id, event_type, amount, reason, approved_by,
               CAST(created_at AS STRING) AS created_at
        FROM workspace.hgv_comp.fact_comp_admin_log
        WHERE ${repId ? `rep_id = '${repId}' AND ` : ''}period_id = '${periodId}'
          AND event_type IN ('ADJUSTMENT','MANUAL_PAY','SPIFF')
        ORDER BY created_at DESC
      `);
      const pending = (rows as any[]).filter(r => !r.approved_by).length;
      res.json({ adjustments: rows, pending_approvals: pending });
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : 'Query failed' });
    }
  });

  // GET /api/comp/admin/audit-log?rep_id=&period_id=
  app.get('/api/comp/admin/audit-log', async (req, res) => {
    const repId    = String(req.query.rep_id    ?? '').replace(/'/g, "''");
    const periodId = String(req.query.period_id ?? CURRENT_PERIOD_ID).replace(/'/g, "''");
    try {
      async function safeQ(sql: string) { try { return await runSql(sql); } catch { return []; } }
      const rows = await safeQ(`
        SELECT event_id, rep_id, period_id, event_type, amount, reason, approved_by,
               CAST(created_at AS STRING) AS created_at
        FROM workspace.hgv_comp.fact_comp_admin_log
        WHERE ${repId ? `rep_id = '${repId}' AND ` : ''}period_id = '${periodId}'
        ORDER BY created_at ASC
      `);
      res.json({ events: rows, total: rows.length });
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : 'Query failed' });
    }
  });

  // GET /api/comp/admin/data-quality?period_id=
  app.get('/api/comp/admin/data-quality', async (req, res) => {
    const periodId = String(req.query.period_id ?? CURRENT_PERIOD_ID).replace(/'/g, "''");
    try {
      async function safeQ(sql: string) { try { return await runSql(sql); } catch { return []; } }

      const missingFields = await safeQ(`
        SELECT deal_id, rep_id, credit_status,
               CASE WHEN deal_id IS NULL OR deal_id = '' THEN 'Missing deal_id' ELSE NULL END AS issue_deal_id,
               CASE WHEN rep_id IS NULL OR rep_id = '' THEN 'Missing rep_id' ELSE NULL END AS issue_rep_id,
               CASE WHEN credit_amount IS NULL THEN 'Missing credit_amount' ELSE NULL END AS issue_amount
        FROM workspace.hgv_comp.fact_deal_credit
        WHERE period_id = '${periodId}'
          AND (deal_id IS NULL OR rep_id IS NULL OR credit_amount IS NULL OR credit_status IS NULL)
        LIMIT 50
      `);

      const dataEvents = await safeQ(`
        SELECT event_id, rep_id, reason, CAST(created_at AS STRING) AS created_at
        FROM workspace.hgv_comp.fact_comp_admin_log
        WHERE period_id = '${periodId}' AND event_type = 'DATA_QUALITY_FIX'
        ORDER BY created_at DESC
      `);

      const totalDeals = await safeQ(`
        SELECT COUNT(*) AS cnt FROM workspace.hgv_comp.fact_deal_credit
        WHERE period_id = '${periodId}'
      `);

      res.json({
        data_issues: missingFields,
        resolved_issues: dataEvents,
        total_deals: Number((totalDeals[0] as any)?.cnt ?? 0),
        clean_pct: missingFields.length === 0 ? 100 :
          Math.round((1 - missingFields.length / Math.max(1, Number((totalDeals[0] as any)?.cnt ?? 1))) * 100),
      });
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : 'Query failed' });
    }
  });

  // GET /api/comp/admin/payroll-preview?period_id=
  app.get('/api/comp/admin/payroll-preview', async (req, res) => {
    const periodId = String(req.query.period_id ?? CURRENT_PERIOD_ID).replace(/'/g, "''");
    try {
      async function safeQ(sql: string) { try { return await runSql(sql); } catch { return []; } }
      const rows = await safeQ(`
        SELECT r.rep_id, r.rep_name, r.level_code, r.region,
               p.base_pay, p.commission, p.bonus, p.total_earnings, p.total_paid,
               COALESCE(adj.manual_adj, 0) AS manual_adjustments,
               (p.total_earnings + COALESCE(adj.manual_adj, 0)) AS net_payable
        FROM workspace.hgv_comp.dim_rep r
        JOIN workspace.hgv_comp.fact_payout p USING (rep_id)
        LEFT JOIN (
          SELECT rep_id, SUM(COALESCE(amount, 0)) AS manual_adj
          FROM workspace.hgv_comp.fact_comp_admin_log
          WHERE period_id = '${periodId}' AND event_type IN ('ADJUSTMENT','MANUAL_PAY')
          GROUP BY rep_id
        ) adj USING (rep_id)
        WHERE p.period_id = '${periodId}' AND r.is_active = true
        ORDER BY net_payable DESC
      `);

      const grandTotal = (rows as any[]).reduce((sum, r) => sum + Number(r.net_payable ?? 0), 0);
      res.json({ payroll: rows, grand_total: grandTotal, period_id: periodId, payee_count: rows.length });
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : 'Query failed' });
    }
  });

  // ─── Finance Agent API ────────────────────────────────────────────────────────

  // GET /api/comp/finance/cost-summary?period_id=
  app.get('/api/comp/finance/cost-summary', async (req, res) => {
    const periodId = String(req.query.period_id ?? CURRENT_PERIOD_ID).replace(/'/g, "''");
    try {
      async function safeQ(sql: string) { try { return await runSql(sql); } catch { return []; } }

      const financeCfg = await loadFinancePeriodConfig(runSql, periodId);

      const byRole = await safeQ(`
        SELECT r.level_code,
               COUNT(DISTINCT r.rep_id) AS headcount,
               SUM(p.total_earnings) AS total_comp,
               AVG(p.total_earnings) AS avg_comp,
               SUM(p.commission) AS total_commission,
               SUM(p.bonus) AS total_bonus
        FROM workspace.hgv_comp.dim_rep r
        JOIN workspace.hgv_comp.fact_payout p USING (rep_id)
        WHERE p.period_id = '${periodId}' AND r.is_active = true
        GROUP BY r.level_code
        ORDER BY total_comp DESC
      `);

      const teamTotal = await safeQ(`
        SELECT SUM(total_earnings) AS total_comp, AVG(total_earnings) AS avg_comp,
               SUM(commission) AS total_commission, SUM(bonus) AS total_bonus,
               COUNT(*) AS headcount
        FROM workspace.hgv_comp.fact_payout
        WHERE period_id = '${periodId}'
      `);

      const tourNSV = await safeQ(`
        SELECT SUM(net_sales_volume) AS total_nsv, COUNT(*) AS tour_count,
               SUM(CASE WHEN closed_flag = true THEN net_sales_volume ELSE 0 END) AS closed_nsv
        FROM workspace.hgv_comp.fact_tour_quality
        WHERE period_id = '${periodId}'
      `);

      const totalComp = Number((teamTotal[0] as any)?.total_comp ?? 0);
      const totalNSV  = Number((tourNSV[0] as any)?.total_nsv ?? 0);
      const budgetComp = Number((financeCfg as any)?.budget_comp ?? 0);
      const varCompPct = totalNSV > 0 ? (totalComp / totalNSV) * 100 : 0;

      res.json({
        by_role: byRole,
        totals: teamTotal[0] ?? null,
        nsv: tourNSV[0] ?? null,
        var_comp_pct_of_nsv: Math.round(varCompPct * 100) / 100,
        budget_comp: budgetComp,
        budget_variance: totalComp - budgetComp,
        var_comp_target_min_pct: Number((financeCfg as any)?.var_comp_target_min_pct ?? null),
        var_comp_target_max_pct: Number((financeCfg as any)?.var_comp_target_max_pct ?? null),
        finance_period: financeCfg,
      });
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : 'Query failed' });
    }
  });

  // GET /api/comp/finance/tour-quality?period_id=
  app.get('/api/comp/finance/tour-quality', async (req, res) => {
    const periodId = String(req.query.period_id ?? CURRENT_PERIOD_ID).replace(/'/g, "''");
    try {
      const rows = await runSql(`
        SELECT lead_source, abc_score,
               COUNT(*) AS tour_count,
               SUM(CAST(showed_flag AS INT)) AS showed_count,
               SUM(CAST(closed_flag AS INT)) AS closed_count,
               ROUND(AVG(CASE WHEN showed_flag = true AND vpg > 0 THEN vpg ELSE NULL END), 2) AS avg_vpg,
               SUM(net_sales_volume) AS total_nsv,
               SUM(CAST(rescission_flag AS INT)) AS rescission_count,
               ROUND(AVG(ebitda_estimate), 2) AS avg_ebitda
        FROM workspace.hgv_comp.fact_tour_quality
        WHERE period_id = '${periodId}'
        GROUP BY lead_source, abc_score
        ORDER BY lead_source, abc_score
      `);

      const summary = await runSql(`
        SELECT COUNT(*) AS total_tours,
               SUM(CAST(showed_flag AS INT)) AS total_showed,
               SUM(CAST(closed_flag AS INT)) AS total_closed,
               SUM(CAST(rescission_flag AS INT)) AS total_rescissions,
               ROUND(AVG(CASE WHEN closed_flag = true AND vpg > 0 THEN vpg ELSE NULL END), 2) AS overall_vpg,
               SUM(net_sales_volume) AS total_nsv,
               SUM(ebitda_estimate) AS total_ebitda
        FROM workspace.hgv_comp.fact_tour_quality
        WHERE period_id = '${periodId}'
      `);

      res.json({ matrix: rows, summary: summary[0] ?? null });
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : 'Query failed' });
    }
  });

  // GET /api/comp/finance/lead-performance?period_id=
  app.get('/api/comp/finance/lead-performance', async (req, res) => {
    const periodId = String(req.query.period_id ?? CURRENT_PERIOD_ID).replace(/'/g, "''");
    try {
      const rows = await runSql(`
        SELECT abc_score,
               COUNT(*) AS total_tours,
               SUM(CAST(showed_flag AS INT)) AS showed,
               SUM(CAST(closed_flag AS INT)) AS closed,
               ROUND(100.0 * SUM(CAST(showed_flag AS INT)) / COUNT(*), 1) AS show_rate_pct,
               ROUND(100.0 * SUM(CAST(closed_flag AS INT)) / NULLIF(SUM(CAST(showed_flag AS INT)), 0), 1) AS close_rate_pct,
               ROUND(AVG(CASE WHEN vpg > 0 THEN vpg ELSE NULL END), 2) AS avg_vpg,
               ROUND(100.0 * SUM(CAST(rescission_flag AS INT)) / NULLIF(SUM(CAST(closed_flag AS INT)), 0), 1) AS rescission_rate_pct,
               SUM(net_sales_volume) AS total_nsv,
               ROUND(AVG(ebitda_estimate), 2) AS avg_ebitda_per_tour
        FROM workspace.hgv_comp.fact_tour_quality
        WHERE period_id = '${periodId}'
        GROUP BY abc_score
        ORDER BY abc_score
      `);
      res.json({ lead_performance: rows });
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : 'Query failed' });
    }
  });

  // GET /api/comp/finance/roi-analysis?period_id=
  app.get('/api/comp/finance/roi-analysis', async (req, res) => {
    const periodId = String(req.query.period_id ?? CURRENT_PERIOD_ID).replace(/'/g, "''");
    try {
      async function safeQ(sql: string) { try { return await runSql(sql); } catch { return []; } }

      const financeCfg = await loadFinancePeriodConfig(runSql, periodId);
      const roiThreshold = Number((financeCfg as any)?.spiff_roi_threshold ?? 0);

      const spiffEvents = await safeQ(`
        SELECT event_id, rep_id, amount, attributed_nsv, reason, approved_by,
               CAST(created_at AS STRING) AS created_at
        FROM workspace.hgv_comp.fact_comp_admin_log
        WHERE period_id = '${periodId}' AND event_type IN ('SPIFF','SPIFF_APPROVAL')
        ORDER BY created_at
      `);

      const totalSpiffCost = (spiffEvents as any[]).reduce(
        (s, e) => s + Math.abs(Number(e.amount ?? 0)),
        0,
      );
      const nsvFromSpiff = (spiffEvents as any[]).reduce(
        (s, e) => s + Math.abs(Number(e.attributed_nsv ?? 0)),
        0,
      );
      const roiRatio = totalSpiffCost > 0 ? nsvFromSpiff / totalSpiffCost : 0;

      res.json({
        spiff_events: spiffEvents,
        total_spiff_cost: totalSpiffCost,
        incremental_nsv_estimate: nsvFromSpiff,
        roi_ratio: Math.round(roiRatio * 10) / 10,
        roi_threshold: roiThreshold,
        exceeds_threshold: roiThreshold > 0 ? roiRatio >= roiThreshold : false,
        spiff_count: spiffEvents.length,
      });
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : 'Query failed' });
    }
  });

  // GET /api/comp/finance/chargeback-exposure?period_id=
  app.get('/api/comp/finance/chargeback-exposure', async (req, res) => {
    const periodId = String(req.query.period_id ?? CURRENT_PERIOD_ID).replace(/'/g, "''");
    try {
      async function safeQ(sql: string) { try { return await runSql(sql); } catch { return []; } }

      const exposure = await safeQ(`
        SELECT status,
               COUNT(*) AS count,
               SUM(original_commission) AS original_commission,
               SUM(chargeback_amount) AS chargeback_amount,
               SUM(reserve_held) AS reserve_held,
               SUM(reserve_released) AS reserve_released
        FROM workspace.hgv_comp.fact_chargeback
        WHERE period_id = '${periodId}'
        GROUP BY status
        ORDER BY status
      `);

      const totals = (exposure as any[]).reduce((acc, row) => ({
        open_reserve:     acc.open_reserve     + (row.status === 'OPEN' ? Number(row.reserve_held ?? 0) : 0),
        total_chargedback: acc.total_chargedback + Number(row.chargeback_amount ?? 0),
        total_released:   acc.total_released   + Number(row.reserve_released ?? 0),
      }), { open_reserve: 0, total_chargedback: 0, total_released: 0 });

      res.json({ by_status: exposure, totals });
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : 'Query failed' });
    }
  });

  // GET /api/comp/finance/accrual-summary?period_id=
  app.get('/api/comp/finance/accrual-summary', async (req, res) => {
    const periodId = String(req.query.period_id ?? CURRENT_PERIOD_ID).replace(/'/g, "''");
    try {
      async function safeQ(sql: string) { try { return await runSql(sql); } catch { return []; } }

      const financeCfg = await loadFinancePeriodConfig(runSql, periodId);

      const payout = await safeQ(`
        SELECT SUM(commission) AS total_commission, SUM(bonus) AS total_bonus,
               SUM(total_earnings) AS total_earned, SUM(total_paid) AS total_paid
        FROM workspace.hgv_comp.fact_payout
        WHERE period_id = '${periodId}'
      `);

      const chargebacks = await safeQ(`
        SELECT SUM(reserve_held) AS total_reserve_held, SUM(reserve_released) AS total_released,
               SUM(chargeback_amount) AS total_chargebacks
        FROM workspace.hgv_comp.fact_chargeback
        WHERE period_id = '${periodId}'
      `);

      const earned = Number((payout[0] as any)?.total_earned ?? 0);
      const paid = Number((payout[0] as any)?.total_paid ?? 0);
      const openReserve = Number((chargebacks[0] as any)?.total_reserve_held ?? 0)
        - Number((chargebacks[0] as any)?.total_released ?? 0);
      const accrualToBook = earned - paid;

      res.json({
        payout: payout[0] ?? null,
        chargebacks: chargebacks[0] ?? null,
        accrual_to_book: accrualToBook,
        open_reserve_liability: openReserve,
        accrual_basis: (financeCfg as any)?.accrual_basis ?? null,
        payroll_lock_date: (financeCfg as any)?.payroll_lock_date ?? null,
        ffs_reserve_pct: Number((financeCfg as any)?.ffs_reserve_pct ?? null),
        accrual_policy_notes: (financeCfg as any)?.accrual_policy_notes ?? null,
        finance_period: financeCfg,
      });
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : 'Query failed' });
    }
  });

  // GET /api/comp/finance/pay-for-perf?period_id=
  app.get('/api/comp/finance/pay-for-perf', async (req, res) => {
    const periodId = String(req.query.period_id ?? CURRENT_PERIOD_ID).replace(/'/g, "''");
    try {
      async function safeQ(sql: string) { try { return await runSql(sql); } catch { return []; } }

      const repEarnings = await safeQ(`
        SELECT r.rep_id, r.rep_name, r.level_code, r.region,
               p.total_earnings, p.commission, qa.attainment_pct, qa.credited_amount,
               qa.deals_closed_count
        FROM workspace.hgv_comp.dim_rep r
        JOIN workspace.hgv_comp.fact_payout p USING (rep_id)
        JOIN workspace.hgv_comp.fact_quota_attainment qa
          ON r.rep_id = qa.rep_id AND qa.period_id = '${periodId}'
        WHERE p.period_id = '${periodId}' AND r.is_active = true AND r.rep_id != 'REP-MGR-01'
        ORDER BY p.total_earnings DESC
      `);

      const tourPerRep = await safeQ(`
        SELECT rep_id,
               COUNT(*) AS tour_count,
               SUM(CAST(closed_flag AS INT)) AS sales_count,
               ROUND(AVG(CASE WHEN vpg > 0 THEN vpg ELSE NULL END), 2) AS avg_vpg,
               SUM(net_sales_volume) AS total_nsv
        FROM workspace.hgv_comp.fact_tour_quality
        WHERE period_id = '${periodId}'
        GROUP BY rep_id
      `);

      const tourMap = Object.fromEntries((tourPerRep as any[]).map(t => [t.rep_id, t]));

      const enriched = (repEarnings as any[]).map(rep => ({
        ...rep,
        tour_stats: tourMap[String(rep.rep_id)] ?? null,
        vpg: tourMap[String(rep.rep_id)]?.avg_vpg ?? null,
        earnings_per_sale: rep.deals_closed_count > 0
          ? Math.round(Number(rep.total_earnings) / Number(rep.deals_closed_count))
          : null,
      }));

      res.json({ reps: enriched });
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : 'Query failed' });
    }
  });

  // GET /api/comp/finance/scenario-cost?scenario_id=
  app.get('/api/comp/finance/scenario-cost', async (req, res) => {
    const scenarioId = String(req.query.scenario_id ?? 'SCN-BASELINE').replace(/'/g, "''");
    try {
      const rows = await runSql(`
        SELECT r.scenario_id, r.scenario_name, r.period_id,
               r.quota_change_pct, r.commission_rate_pct,
               r.bonus_rate_change_pct, r.accelerator_change_pct,
               s.projected_payouts, s.budget_impact, s.projected_cost, s.expected_performance_pct
        FROM workspace.hgv_comp.scenario_run r
        LEFT JOIN workspace.hgv_comp.scenario_result s USING (scenario_id)
        WHERE r.scenario_id = '${scenarioId}'
      `);

      if (rows.length === 0) {
        res.status(404).json({ error: 'Scenario not found' });
        return;
      }

      const scn = rows[0] as any;
      const periodId = String(scn.period_id ?? CURRENT_PERIOD_ID).replace(/'/g, "''");
      const financeCfg = await loadFinancePeriodConfig(runSql, periodId);

      const baseRows = await runSql(`
        SELECT SUM(p.total_earnings) AS base_payouts
        FROM workspace.hgv_comp.fact_payout p
        WHERE p.period_id = '${periodId}'
      `);
      const basePayouts = Number((baseRows[0] as any)?.base_payouts ?? 0);
      const ebitdaMargin = Number((financeCfg as any)?.ebitda_margin_pct ?? 0) / 100;
      const budgetImpact = Number(scn.budget_impact ?? 0);
      const projectedEbitdaImpact = -budgetImpact * ebitdaMargin;

      res.json({
        scenario: scn,
        financial_analysis: {
          base_payouts: basePayouts,
          projected_payouts: Number(scn.projected_payouts ?? basePayouts),
          budget_impact: budgetImpact,
          projected_ebitda_impact: Math.round(projectedEbitdaImpact),
          var_comp_change_pct: basePayouts > 0
            ? Math.round((budgetImpact / basePayouts) * 1000) / 10
            : 0,
          ebitda_assumption: financeCfg
            ? `${Number((financeCfg as any).ebitda_margin_pct)}% EBITDA margin (dim_finance_period)`
            : null,
          budget_comp: Number((financeCfg as any)?.budget_comp ?? null),
        },
      });
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : 'Query failed' });
    }
  });

  // ─── Scenario Management ────────────────────────────────────────────────────
  // Executes SQL against the warehouse using the app SP token via REST API.

  async function runSql(statement: string): Promise<Record<string, unknown>[]> {
    const warehouseId = process.env.DATABRICKS_WAREHOUSE_ID ?? '';

    if (!warehouseId) {
      throw new Error('Missing DATABRICKS_WAREHOUSE_ID env var');
    }

    if (!wsClient) {
      wsClient = getWorkspaceClient({});
    }

    const requestPayload: any = {
      warehouse_id: warehouseId,
      statement,
      wait_timeout: '30s',
      on_wait_timeout: 'CANCEL',
    };

    const execBody = await wsClient.statementExecution.executeStatement(requestPayload);

    if (execBody.status?.state === 'FAILED') {
      throw new Error(execBody.status?.error?.message ?? 'SQL failed');
    }

    const columns = (execBody.manifest?.schema?.columns ?? []).map((c: any) => c.name);
    const rows = execBody.result?.data_array ?? [];
    return rows.map((row: any) => Object.fromEntries(columns.map((col: any, i: number) => [col, row[i]])));
  }

  /** Compute projected scenario financials from input levers. */
  // projectScenario imported from shared/scenarioProjection.ts

  // GET /api/comp/scenarios — list all scenarios with results
  app.get('/api/comp/scenarios', async (_req, res) => {
    try {
      const rows = await runSql(`
        SELECT
          r.scenario_id,
          r.scenario_name,
          r.period_id,
          r.quota_change_pct,
          r.commission_rate_pct,
          r.bonus_rate_change_pct,
          r.accelerator_change_pct,
          COALESCE(r.tour_volume_change_pct, 0) AS tour_volume_change_pct,
          COALESCE(r.conversion_rate_change_pct, 0) AS conversion_rate_change_pct,
          r.created_by,
          COALESCE(s.projected_payouts, 0)       AS projected_payouts,
          COALESCE(s.budget_impact, 0)            AS budget_impact,
          COALESCE(s.projected_cost, 0)           AS projected_cost,
          COALESCE(s.expected_performance_pct, 0) AS expected_performance_pct
        FROM workspace.hgv_comp.scenario_run r
        LEFT JOIN workspace.hgv_comp.scenario_result s USING (scenario_id)
        ORDER BY r.scenario_id
      `);
      res.json(rows);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Query failed';
      res.status(502).json({ error: message });
    }
  });

  // POST /api/admin/varicent/ingest — processes and loads Varicent CSV/JSON exports into Delta Lake
  app.post('/api/admin/varicent/ingest', async (req, res) => {
    try {
      const { exportType, rawText, mode } = req.body as {
        exportType?: string;
        rawText?: string;
        mode?: string;
      };

      if (!exportType || !rawText) {
        res.status(400).json({ error: 'exportType and rawText are required parameters' });
        return;
      }

      if (exportType !== 'payees' && exportType !== 'deals' && exportType !== 'payouts') {
        res.status(400).json({ error: 'exportType must be payees, deals, or payouts' });
        return;
      }

      // 1. Process mapping and pre-flight check
      const report = processEtlRecords(exportType as 'payees' | 'deals' | 'payouts', rawText, mode || null);

      if (report.invalidCount > 0) {
        res.status(400).json({
          error: 'Varicent validation failed due to schema or constraint mismatch',
          preflight: report.preflight,
          validCount: report.validCount,
          invalidCount: report.invalidCount,
        });
        return;
      }

      // 2. Generate and run SQL statements against the warehouse
      const executedStatements: string[] = [];
      const tablesAffected: string[] = [];

      for (const target of report.targets) {
        const sqls = generateIngestionSql(target);
        tablesAffected.push(target.table);
        for (const stmt of sqls) {
          await runSql(stmt);
          executedStatements.push(stmt);
        }
      }

      res.json({
        ok: true,
        message: 'Varicent data ingested successfully to Delta Lake!',
        validCount: report.validCount,
        invalidCount: report.invalidCount,
        tablesAffected,
        statementsCount: executedStatements.length,
        preflight: report.preflight,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ingestion failed';
      console.error('Varicent ETL Ingestion Failed:', err);
      res.status(502).json({ error: msg });
    }
  });

  // POST /api/comp/scenarios — create a new scenario and persist to UC
  app.post('/api/comp/scenarios', async (req, res) => {
    try {
      const {
        scenario_id,
        scenario_name,
        period_id,
        quota_change_pct,
        commission_rate_pct,
        bonus_rate_change_pct,
        accelerator_change_pct,
        tour_volume_change_pct,
        conversion_rate_change_pct,
      } = req.body as Record<string, unknown>;

      if (!scenario_id || !scenario_name) {
        res.status(400).json({ error: 'scenario_id and scenario_name are required' });
        return;
      }

      const tourVol = Number(tour_volume_change_pct ?? 0);
      const conversionPct = Number(conversion_rate_change_pct ?? 0);
      const proj = projectScenario(
        Number(quota_change_pct ?? 0),
        Number(commission_rate_pct ?? 6),
        Number(bonus_rate_change_pct ?? 0),
        Number(accelerator_change_pct ?? 0),
        tourVol,
        conversionPct,
      );

      await runSql(`
        INSERT INTO workspace.hgv_comp.scenario_run
          (scenario_id, scenario_name, period_id, quota_change_pct, commission_rate_pct,
           bonus_rate_change_pct, accelerator_change_pct, tour_volume_change_pct, conversion_rate_change_pct, created_by)
        VALUES (
          '${String(scenario_id).replace(/'/g, "''")}',
          '${String(scenario_name).replace(/'/g, "''")}',
          '${String(period_id ?? CURRENT_PERIOD_ID).replace(/'/g, "''")}',
          ${Number(quota_change_pct ?? 0)},
          ${Number(commission_rate_pct ?? 6)},
          ${Number(bonus_rate_change_pct ?? 0)},
          ${Number(accelerator_change_pct ?? 0)},
          ${tourVol},
          ${conversionPct},
          'user_created'
        )
      `);

      await runSql(`
        INSERT INTO workspace.hgv_comp.scenario_result
          (scenario_id, projected_payouts, budget_impact, projected_cost, expected_performance_pct)
        VALUES (
          '${String(scenario_id).replace(/'/g, "''")}',
          ${proj.projected_payouts},
          ${proj.budget_impact},
          ${proj.projected_cost},
          ${proj.expected_performance_pct}
        )
      `);

      res.json({ ok: true, scenario_id, ...proj });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Insert failed';
      res.status(502).json({ error: message });
    }
  });

  // ─── Semantic Layer Management ──────────────────────────────────────────────

  // Ensure the semantic_definitions table exists on first use
  async function ensureSemanticTable() {
    try {
      await runSql(`
        CREATE TABLE IF NOT EXISTS workspace.hgv_comp.semantic_definitions (
          metric_id      STRING NOT NULL,
          display_name   STRING NOT NULL,
          description    STRING,
          category       STRING,
          sql_expression STRING NOT NULL,
          source_tables  STRING,
          owner          STRING,
          created_at     TIMESTAMP,
          updated_at     TIMESTAMP,
          is_active      BOOLEAN
        )
      `);
    } catch (err) {
      console.warn("ensureSemanticTable suppressed (table may already exist or DDL permission restricted):", err);
    }
  }

  // GET /api/admin/semantic-definitions — list all active definitions
  app.get('/api/admin/semantic-definitions', async (_req, res) => {
    try {
      await ensureSemanticTable();
      const rows = await runSql(`
        SELECT metric_id, display_name, description, category,
               sql_expression, source_tables, owner,
               CAST(created_at AS STRING) AS created_at,
               CAST(updated_at AS STRING) AS updated_at,
               is_active
        FROM workspace.hgv_comp.semantic_definitions
        WHERE is_active = true OR is_active IS NULL
        ORDER BY category, display_name
      `);
      res.json(rows);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Query failed';
      res.status(502).json({ error: message });
    }
  });

  // POST /api/admin/semantic-definitions — create a new definition
  app.post('/api/admin/semantic-definitions', async (req, res) => {
    try {
      await ensureSemanticTable();
      const { metric_id, display_name, description, category, sql_expression, source_tables, owner } =
        req.body as Record<string, string>;
      if (!metric_id || !display_name || !sql_expression) {
        res.status(400).json({ error: 'metric_id, display_name, and sql_expression are required' });
        return;
      }
      const clean = (s: string) => (s ?? '').replace(/'/g, "''");
      await runSql(`
        INSERT INTO workspace.hgv_comp.semantic_definitions
          (metric_id, display_name, description, category, sql_expression, source_tables, owner, created_at, updated_at, is_active)
        VALUES (
          '${clean(metric_id)}', '${clean(display_name)}', '${clean(description)}',
          '${clean(category)}', '${clean(sql_expression)}', '${clean(source_tables)}',
          '${clean(owner)}', current_timestamp(), current_timestamp(), true
        )
      `);
      res.json({ ok: true, metric_id });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Insert failed';
      res.status(502).json({ error: message });
    }
  });

  // PUT /api/admin/semantic-definitions/:id — update an existing definition
  app.put('/api/admin/semantic-definitions/:id', async (req, res) => {
    try {
      const id = req.params.id.replace(/'/g, "''");
      const { display_name, description, category, sql_expression, source_tables, owner } =
        req.body as Record<string, string>;
      if (!display_name || !sql_expression) {
        res.status(400).json({ error: 'display_name and sql_expression are required' });
        return;
      }
      const clean = (s: string) => (s ?? '').replace(/'/g, "''");
      await runSql(`
        UPDATE workspace.hgv_comp.semantic_definitions
        SET display_name   = '${clean(display_name)}',
            description    = '${clean(description)}',
            category       = '${clean(category)}',
            sql_expression = '${clean(sql_expression)}',
            source_tables  = '${clean(source_tables)}',
            owner          = '${clean(owner)}',
            updated_at     = current_timestamp()
        WHERE metric_id = '${id}'
      `);
      res.json({ ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Update failed';
      res.status(502).json({ error: message });
    }
  });

  // DELETE /api/admin/semantic-definitions/:id — soft delete (is_active = false)
  app.delete('/api/admin/semantic-definitions/:id', async (req, res) => {
    try {
      const id = req.params.id.replace(/'/g, "''");
      await runSql(`
        UPDATE workspace.hgv_comp.semantic_definitions
        SET is_active = false, updated_at = current_timestamp()
        WHERE metric_id = '${id}'
      `);
      res.json({ ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Delete failed';
      res.status(502).json({ error: message });
    }
  });

  // POST /api/admin/semantic-definitions/validate — dry-run SQL via EXPLAIN
  app.post('/api/admin/semantic-definitions/validate', async (req, res) => {
    try {
      const { sql_expression } = req.body as { sql_expression?: string };
      if (!sql_expression?.trim()) {
        res.status(400).json({ error: 'sql_expression is required' });
        return;
      }
      // Wrap the expression in a SELECT so EXPLAIN can validate it
      const explainSql = `EXPLAIN SELECT (${sql_expression}) AS _val FROM workspace.hgv_comp.fact_payout LIMIT 0`;
      await runSql(explainSql);
      res.json({ ok: true, valid: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Validation failed';
      res.json({ ok: false, valid: false, error: message });
    }
  });

  app.delete('/api/comp/scenarios/:id', async (req, res) => {
    const id = req.params.id;
    const PROTECTED = ['SCN-BASELINE', 'SCN-SIM-01', 'SCN-PLAN-A'];
    if (PROTECTED.includes(id)) {
      res.status(400).json({ error: 'Built-in scenarios cannot be deleted.' });
      return;
    }
    try {
      await runSql(`DELETE FROM workspace.hgv_comp.scenario_result WHERE scenario_id = '${id.replace(/'/g, "''")}'`);
      await runSql(`DELETE FROM workspace.hgv_comp.scenario_run WHERE scenario_id = '${id.replace(/'/g, "''")}'`);
      res.json({ ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Delete failed';
      res.status(502).json({ error: message });
    }
  });

  // Bootstrap in background — app SP may not have CREATE TABLE; tables must be provisioned via setup script.
  void ensureCompExtensionsOnce(runSql);
});

await appkit.server.start();
