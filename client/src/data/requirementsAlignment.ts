export type RequirementStatus = 'built' | 'partial';

export interface RequirementItem {
  requirement: string;
  status: RequirementStatus;
  how: string;
}

export interface RequirementGroup {
  id: string;
  title: string;
  subtitle: string;
  items: RequirementItem[];
}

export const REQUIREMENTS_ALIGNMENT: RequirementGroup[] = [
  {
    id: 'ai-insights',
    title: 'AI Insights & Plan Goals',
    subtitle: 'Operational data grounded in compensation plans and industry benchmarks.',
    items: [
      {
        requirement: 'Analyze qualified tours and estimate FPS conversion potential',
        status: 'built',
        how: 'RepAiInsightsPanel + repInsights.ts inject tour rows, arrivals, and plan metrics into LLM prompts.',
      },
      {
        requirement: 'Project achievement outcomes ("converting X tours → Y target")',
        status: 'built',
        how: 'Insight prompts request quantified tour-to-FPS outcomes; arrivals show projected payout per guest.',
      },
      {
        requirement: 'Ground insights in industry compensation standards',
        status: 'built',
        how: 'industry_comp_benchmark Delta table + benchmarkGrounding.ts in all rep/manager/coaching prompts.',
      },
    ],
  },
  {
    id: 'earnings',
    title: 'Rep Earnings Breakdown',
    subtitle: 'Warehouse-backed payout visibility that reconciles across views.',
    items: [
      {
        requirement: 'Qualified Tours (Owner vs New Buyer)',
        status: 'built',
        how: 'fact_marketing_tour_payout with guest-type badges and credit attribution in My Comp workspace.',
      },
      {
        requirement: 'Individual FPS Packages & Sales Transactions',
        status: 'built',
        how: 'fact_marketing_rep_metric rows drive plan-metric cards and earnings breakdown panel.',
      },
      {
        requirement: 'Earnings reconcile across views and reports',
        status: 'built',
        how: 'Single /api/comp/marketing/workspace payload feeds KPI cards, breakdown, tours, and AI context.',
      },
    ],
  },
  {
    id: 'tours-arrivals',
    title: 'Tour Activity & Upcoming Arrivals',
    subtitle: 'Owner/NB separation with projected payout opportunities.',
    items: [
      {
        requirement: 'Separate Owner vs New Buyer tour activity and credits',
        status: 'built',
        how: 'Tour ledger with guest_type, qualification status, and per-tour payout in marketing workspace.',
      },
      {
        requirement: 'Upcoming arrivals with projected payout',
        status: 'built',
        how: 'fact_marketing_arrival with tour, FPS, and total projected columns in My Comp.',
      },
      {
        requirement: 'Owner-tour-focused AI insights',
        status: 'built',
        how: 'Marketing insight prompt emphasizes Owner vs NB tours and arrival conversion economics.',
      },
    ],
  },
  {
    id: 'manager-tiles',
    title: 'Manager Summary Tiles',
    subtitle: 'Right-rail aggregate insights aligned across teams.',
    items: [
      {
        requirement: 'Aggregate team insights on dashboard right side',
        status: 'built',
        how: 'ManagerCompensationView sticky right column: KPI tiles, pay mix banner, AI brief.',
      },
      {
        requirement: 'Cross-department metric alignment',
        status: 'partial',
        how: 'Marketing manager path fully wired; sales manager team snapshot when fact_team_snapshot is seeded.',
      },
    ],
  },
  {
    id: 'benchmarks',
    title: 'Industry Benchmark Grounding',
    subtitle: 'Four headline categories driving strategy analysis and AI insights.',
    items: [
      {
        requirement: 'Below-market TCC (Directors 10-17%, VPs 14-43%)',
        status: 'built',
        how: 'industry_comp_benchmark + industry gap widget in Comp Analysis (Area 1).',
      },
      {
        requirement: 'Pay mix volatility (60/40 marketing standard)',
        status: 'built',
        how: 'PayMixMarketBanner + Area 2 benchmarks; flags inverted 40/60 mix.',
      },
      {
        requirement: 'Commission rate misalignment (4-6% band)',
        status: 'built',
        how: 'Area 3 benchmarks + scenario commission rate slider.',
      },
      {
        requirement: 'NOI weight in Director+ plans (50-80%)',
        status: 'built',
        how: 'Area 4 benchmarks + Director NOI weight slider in scenario modeler.',
      },
    ],
  },
  {
    id: 'risk-mix',
    title: 'Risk & Compensation Mix Analysis',
    subtitle: 'At-risk identification and pay-mix deviation detection.',
    items: [
      {
        requirement: 'Identify at-risk employees vs market benchmarks',
        status: 'built',
        how: 'fact_rep_market_position + team market API; manager insights flag TCC gaps.',
      },
      {
        requirement: 'Show percentage variance from market standards',
        status: 'built',
        how: 'tcc_gap_vs_market_pct on rep/market rows and Below Market TCC tile.',
      },
      {
        requirement: 'Detect inverted pay mix (40/60 vs 60/40)',
        status: 'built',
        how: 'PayMixMarketBanner compares actual vs PAY_MIX benchmark rows; LLM prompts flag deviations.',
      },
    ],
  },
  {
    id: 'strategy-room',
    title: 'Strategy Control Room',
    subtitle: 'Seeded industry datasets with AI alignment recommendations.',
    items: [
      {
        requirement: 'Seed mixed industry-standard datasets',
        status: 'built',
        how: 'industry_comp_benchmark, fact_regional_bonus_*, fact_rep_market_position in Delta.',
      },
      {
        requirement: 'Variable pay vs industry analysis',
        status: 'built',
        how: 'Comp Analysis industry gap assessment from live /api/comp/benchmarks/industry.',
      },
      {
        requirement: 'Under/over-market distribution insights',
        status: 'built',
        how: 'Team market positions + Comp Analysis Area 1 cards with live warehouse counts.',
      },
      {
        requirement: 'AI compensation balance recommendations',
        status: 'built',
        how: 'Scenario modeler + industry gap widget + manager AI brief grounded on benchmarks.',
      },
    ],
  },
  {
    id: 'scenarios',
    title: 'Scenario Planning & Team Analytics',
    subtitle: 'Model levers and visualize bonus attainment distribution.',
    items: [
      {
        requirement: 'Tour volume scenario lever',
        status: 'built',
        how: 'scenario_run.tour_volume_change_pct persisted; sliders in Comp Analysis and Team Coaching.',
      },
      {
        requirement: 'Conversion rate scenario lever',
        status: 'built',
        how: 'scenario_run.conversion_rate_change_pct models FPS/tour close assumptions in scenario projection.',
      },
      {
        requirement: 'Bonus tier distribution curves',
        status: 'built',
        how: 'RegionalBonusLevelsPanel + fact_regional_bonus_area/tier warehouse tables.',
      },
      {
        requirement: 'Team performance vs industry benchmarks',
        status: 'built',
        how: '/api/comp/benchmarks/team injected into coaching and manager LLM prompts.',
      },
    ],
  },
  {
    id: 'plan-assessment',
    title: 'Plan Assessment Table',
    subtitle: 'HGV vs market competitor standards by persona.',
    items: [
      {
        requirement: 'External plan assessment with HGV vs market comparison and variance highlighting',
        status: 'built',
        how: 'plan_assessment_* tables + comparison table with variance row shading on Plan Assessment panel.',
      },
    ],
  },
];

export function requirementStats(groups: RequirementGroup[]) {
  const items = groups.flatMap((g) => g.items);
  return {
    total: items.length,
    built: items.filter((i) => i.status === 'built').length,
    partial: items.filter((i) => i.status === 'partial').length,
  };
}
