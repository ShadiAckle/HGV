import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { CURRENT_PERIOD_ID } from '../../shared/compPeriods.js';
import type { CompMcpDeps } from './types.js';

function jsonResult(payload: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }],
  };
}

export function createCompMcpServer(deps: CompMcpDeps): McpServer {
  const server = new McpServer({
    name: 'hgv-compensation-hub',
    version: '1.0.0',
  });

  server.tool(
    'ask_comp_agent',
    'Ask the HGV Compensation Hub agent a question. Grounds the answer in Unity Catalog comp data for the given rep and period.',
    {
      question: z.string().describe('Natural-language question about compensation, tours, payouts, or policy'),
      rep_id: z.string().optional().describe('Rep ID, e.g. PERSONA-MKT-REP, REP-JASON, REP-MGR-01'),
      period_id: z.string().optional().describe('Comp period, e.g. 2026-Q2'),
      channel: z.enum(['marketing', 'sales', 'manager']).optional().describe('Which data lens to use'),
      plain_english: z.boolean().optional().describe('Use simpler phrasing for frontline reps'),
    },
    async ({ question, rep_id, period_id, channel, plain_english }) => {
      const result = await deps.invokeAgent(deps.appkit, deps.runSql, {
        question,
        rep_id,
        period_id,
        channel,
        plain_english,
      });
      return jsonResult(result);
    },
  );

  server.tool(
    'get_marketing_workspace',
    'Fetch the full marketing rep workspace payload (KPIs, tours, money map, chargebacks).',
    {
      rep_id: z.string().describe('Marketing rep ID, e.g. PERSONA-MKT-REP'),
      period_id: z.string().optional().describe('Comp period, e.g. 2026-Q2'),
    },
    async ({ rep_id, period_id }) => {
      const payload = await deps.getMarketingWorkspace(rep_id, period_id ?? CURRENT_PERIOD_ID);
      return jsonResult(payload);
    },
  );

  server.tool(
    'get_tour_context',
    'Fetch guest 360 and comp impact for a marketing tour.',
    {
      tour_id: z.string().describe('Tour ID, e.g. T-55122'),
      rep_id: z.string().optional().describe('Optional rep filter'),
      period_id: z.string().optional().describe('Comp period, e.g. 2026-Q2'),
    },
    async ({ tour_id, rep_id, period_id }) => {
      const payload = await deps.getTourContext(tour_id, rep_id, period_id ?? CURRENT_PERIOD_ID);
      if (!payload) {
        return jsonResult({ error: `Tour ${tour_id} not found` });
      }
      return jsonResult(payload);
    },
  );

  server.tool(
    'get_comp_metadata',
    'List active reps, teams, periods, and scenarios available in the comp hub.',
    {},
    async () => jsonResult(await deps.fetchMetadata()),
  );

  server.tool(
    'search_comp_entities',
    'Search reps, teams, scenarios, and deals for @mention-style references.',
    {
      query: z.string().describe('Search text'),
    },
    async ({ query }) => jsonResult(await deps.searchMentions(query)),
  );

  server.tool(
    'hub_health',
    'Check connectivity to the HGV Compensation Hub agent gateway.',
    {},
    async () =>
      jsonResult({
        status: 'ok',
        agent: 'hgv-compensation-hub',
        version: '1.0.0',
        mcp: true,
        transport: 'streamable-http',
      }),
  );

  return server;
}
