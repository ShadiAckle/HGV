/**
 * Curated semantic gallery: each entry maps to AppKit analytics query keys / governed SQL.
 */
export interface DataModelInfo {
  id: string;
  title: string;
  summary: string;
  unityCatalogTable: string;
  queryKeys: readonly string[];
  exampleQuestions: readonly string[];
}

/** Default filter values for parameterized comp queries */
export const COMP_DEFAULT_PARAMS = {
  rep_id: 'REP-JASON',
  period_id: '2026-Q2',
  team_id: 'TEAM-WEST',
  scenario_id: 'SCN-SIM-01',
  scenario_plan_id: 'SCN-PLAN-A',
} as const;

/** @deprecated Use COMP_DEFAULT_PARAMS */
export const DATA_MODEL_CATALOG: readonly DataModelInfo[] = [
  {
    id: 'hgv_comp_rep',
    title: 'Rep compensation (individual)',
    summary:
      'Rep-level KPI cards from governed comp facts: earnings, quota attainment, and payout breakdown. Current view: Jason Morrison (REP-JASON), period 2026-Q2.',
    unityCatalogTable: 'workspace.hgv_comp.fact_payout',
    queryKeys: ['comp_rep_kpi', 'comp_rep_earnings_breakdown'],
    exampleQuestions: [
      'What are my current earnings and quota attainment this quarter?',
      'Break down my base, commission, and bonus for Q1.',
      'How much quota credit do I need to reach the next bonus tier?',
    ],
  },
  {
    id: 'hgv_comp_team',
    title: 'Team performance (manager)',
    summary:
      'Team attainment, top/at-risk counts, FFS mix vs target, and per-rep performance. Current view: West Coast Sales (TEAM-WEST).',
    unityCatalogTable: 'workspace.hgv_comp.fact_team_snapshot',
    queryKeys: ['comp_team_kpi', 'comp_team_agent_performance'],
    exampleQuestions: [
      'What is our team quota attainment and how many reps are at risk?',
      'How does our FFS mix compare to the 20% target?',
      'Rank my team by quota attainment and FFS sales %.',
    ],
  },
  {
    id: 'hgv_comp_scenario',
    title: 'Compensation scenarios (analysis & plan design)',
    summary:
      'What-if scenario inputs and outputs for simulation and plan design. Active scenarios: SCN-SIM-01, SCN-PLAN-A.',
    unityCatalogTable: 'workspace.hgv_comp.scenario_run',
    queryKeys: ['comp_simulation_kpi', 'comp_scenario_design_kpi'],
    exampleQuestions: [
      'What is the budget impact if we raise quota by 5% and commission to 6.5%?',
      'What are projected payouts under the Q2 incentive simulation?',
      'For Scenario A, what is projected cost and expected performance at current levers?',
    ],
  },
] as const;
