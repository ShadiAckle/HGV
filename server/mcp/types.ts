import type { invokeCompAgent } from '../agentGateway.js';

type RunSql = (sql: string) => Promise<Record<string, unknown>[]>;

type AppKitServing = {
  serving: () => { invoke: (body: Record<string, unknown>) => Promise<unknown> };
};

export interface CompMcpDeps {
  runSql: RunSql;
  appkit: AppKitServing;
  invokeAgent: typeof invokeCompAgent;
  fetchMetadata: () => Promise<unknown>;
  searchMentions: (query: string) => Promise<Array<{ key: string; label: string; category: string }>>;
  getMarketingWorkspace: (repId: string, periodId: string) => Promise<unknown>;
  getTourContext: (tourId: string, repId?: string, periodId?: string) => Promise<unknown | null>;
}

export const MCP_TOOL_CATALOG = [
  {
    name: 'ask_comp_agent',
    description: 'Ask the HGV Compensation Hub agent a grounded question about payouts, tours, or policy.',
  },
  {
    name: 'get_marketing_workspace',
    description: 'Fetch marketing rep workspace KPIs, tours, money map, and chargebacks.',
  },
  {
    name: 'get_tour_context',
    description: 'Fetch guest 360 and comp impact for a marketing tour.',
  },
  {
    name: 'get_comp_metadata',
    description: 'List active reps, teams, periods, scenarios, and deals.',
  },
  {
    name: 'search_comp_entities',
    description: 'Search reps, teams, scenarios, and deals for entity references.',
  },
  {
    name: 'hub_health',
    description: 'Check agent gateway connectivity and version.',
  },
] as const;
