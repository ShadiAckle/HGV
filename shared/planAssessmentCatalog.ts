import { normalizeDisplayText } from './normalizeText.js';
export type MarketingPersonaId = 'marketing_rep' | 'marketing_manager' | 'marketing_director';

export interface PlanAssessmentSegment {
  label?: string;
  value: string;
}

export interface PlanAssessmentRow {
  attribute: string;
  hgvPlan: PlanAssessmentSegment[];
  marketStandard: PlanAssessmentSegment[];
  /** Pink-highlight rows on external comp plan assessment slides */
  variesFromMarket?: boolean;
}

export interface MarketingPlanAssessment {
  personaId: MarketingPersonaId;
  planId: string;
  roleTitle: string;
  channelCode: string;
  rows: PlanAssessmentRow[];
  keyFindings: string[];
}

/** Merge warehouse row data with catalog metadata (variance flags, key findings). */
export function enrichPlanAssessmentPayload(
  personaId: string,
  rows: PlanAssessmentRow[],
): { rows: PlanAssessmentRow[]; keyFindings: string[] } {
  const catalog = getPlanAssessmentFallback(personaId);
  const normalizeRow = (r: PlanAssessmentRow): PlanAssessmentRow => ({
    attribute: normalizeDisplayText(r.attribute),
    variesFromMarket: r.variesFromMarket,
    hgvPlan: r.hgvPlan.map((s) => ({
      ...(s.label ? { label: normalizeDisplayText(s.label) } : {}),
      value: normalizeDisplayText(s.value),
    })),
    marketStandard: r.marketStandard.map((s) => ({
      ...(s.label ? { label: normalizeDisplayText(s.label) } : {}),
      value: normalizeDisplayText(s.value),
    })),
  });
  if (!catalog) {
    return { rows: rows.map(normalizeRow), keyFindings: [] };
  }
  const flagByAttr = new Map(catalog.rows.map((r) => [r.attribute, r.variesFromMarket === true]));
  return {
    rows: rows.map((r) => ({
      ...normalizeRow(r),
      variesFromMarket: flagByAttr.get(r.attribute) ?? false,
    })),
    keyFindings: catalog.keyFindings.map(normalizeDisplayText),
  };
}
export const MARKETING_PLAN_ASSESSMENTS: Record<MarketingPersonaId, MarketingPlanAssessment> = {
  marketing_rep: {
    personaId: 'marketing_rep',
    planId: 'PLAN-MKT-REP-2026',
    roleTitle: 'Marketing Representative',
    channelCode: 'C2a',
    keyFindings: [
      'HGV focuses on the number of tours booked and packages sold. Market plans emphasize tour generation and show-ups, downstream purchase outcomes, and sometimes customer satisfaction or conversion quality gates.',
      'HGV uses a more complex structure (5-8 tiers) compared with the market standard (3-5 tiers), which may reduce line-of-sight for representatives.',
      'Competitors place greater emphasis on non-monetary rewards (prizes, experiences) alongside targeted SPIFFs.',
    ],
    rows: [
      {
        attribute: 'Total Comp Range (TCC)',
        hgvPlan: [
          { label: 'Average at Target', value: '~$65k-$75k' },
          { label: 'Top Earners (75th-90th)', value: 'In-House: $146k-$199k; OPC: $133k-$167k' },
        ],
        marketStandard: [
          { label: 'Average at Target', value: '$65k-$80k' },
          { label: 'Top Earners', value: '$100k-$140k' },
        ],
      },
      {
        attribute: 'Metrics / Weights',
        variesFromMarket: true,
        hgvPlan: [
          { value: 'Individual Qualified Tours (Owner, New Buyer)' },
          { value: 'Individual FPS Packages' },
          { value: 'Individual Sales Transactions' },
        ],
        marketStandard: [
          { value: 'Tours Booked' },
          { value: 'Show Rate (%)' },
          { value: 'Sales Conversion Rate' },
          { value: 'CSAT (qualifier / bonus gate)' },
        ],
      },
      {
        attribute: 'Payout Curve',
        variesFromMarket: true,
        hgvPlan: [{ value: '5-8 tiered levels with progressively higher payouts' }],
        marketStandard: [{ value: '3-5 tiered levels with progressively higher payouts' }],
      },
      {
        attribute: 'Payout Timing',
        hgvPlan: [{ value: 'Bi-weekly & monthly components' }],
        marketStandard: [{ value: 'Weekly / Bi-weekly and monthly (with occasional quarterly true-ups)' }],
      },
      {
        attribute: 'Additional Incentives / SPIFFs',
        variesFromMarket: true,
        hgvPlan: [
          { label: 'SPIFFs', value: 'Drive immediate behavior (same-day / few days); small fixed dollar amounts' },
          { label: 'STIs', value: 'Run up to ~3 months for priority behaviors not built into the plan' },
          { label: 'Governance', value: 'Directors/VPs control budgets; formal approval required prior to launch' },
        ],
        marketStandard: [
          { label: 'Monetary', value: 'Ad hoc SPIFFs for priority tours, off-season periods, and short-term pushes' },
          { label: 'Non-monetary', value: 'Contests, prizes, time-off perks, and experiential rewards to boost engagement' },
        ],
      },
    ],
  },
  marketing_manager: {
    personaId: 'marketing_manager',
    planId: 'PLAN-MKT-MGR-2026',
    roleTitle: 'Marketing Manager',
    channelCode: 'C2b',
    keyFindings: [
      'HGV plans use four or more weighted metrics. Market plans are typically simpler, often built around one or two team-level measures.',
      'HGV has a lower entry threshold (75%-80% vs. market 90%) but fewer levels of acceleration after target. Market plans commonly feature two accelerator bands at 115% and 130%.',
      'Market manager plans emphasize team tour volume, penetration/conversion, and cost or quality outcomes rather than multiple overlapping NSV and contribution levers.',
    ],
    rows: [
      {
        attribute: 'Total Comp Range (TCC)',
        hgvPlan: [
          { label: 'Average at Target', value: '~$130k' },
          { label: 'Top Earners (75th-90th)', value: 'In-House Mgr/Sr Mgr: $255k-$278k; OPC Mgr/Sr Mgr: ~$209k' },
        ],
        marketStandard: [
          { label: 'Average at Target', value: '~$100k' },
          { label: 'Top Earners', value: '~$200k' },
        ],
      },
      {
        attribute: 'Metrics / Weights',
        variesFromMarket: true,
        hgvPlan: [
          { value: 'Contribution (15%-20%)' },
          { value: 'LM Net Sales Volume (15%-20%) or Responsible NSV (10%-60%)' },
          { value: 'LM Tours (15%-35%) or Responsible VPG (10%-30%)' },
          { value: 'Club Penetration Rate (20%-70%)' },
        ],
        marketStandard: [
          { value: 'Team performance' },
          { value: 'Tour Volume' },
          { value: 'Penetration / Conversion rates' },
          { value: 'Cost / Quality outcomes' },
        ],
      },
      {
        attribute: 'Payout Curve',
        variesFromMarket: true,
        hgvPlan: [
          { label: 'Threshold', value: '75%-80% attainment = 60% target payout' },
          { label: 'Target', value: '100% attainment = 100% target payout' },
          { label: 'Max', value: '115%-130% attainment = 175%-200% target payout' },
        ],
        marketStandard: [
          { label: 'Threshold', value: '90% performance' },
          { label: 'Accelerators', value: 'Typically at 115% and 130% of performance' },
        ],
      },
      {
        attribute: 'Payout Timing',
        hgvPlan: [{ value: 'Monthly cycle for standard metrics; quarterly cycle for Contribution' }],
        marketStandard: [{ value: 'Monthly; quarterly / annual true-ups or bonuses tied to overall results' }],
      },
      {
        attribute: 'Additional Incentives / SPIFFs',
        hgvPlan: [
          { value: 'Managers roll out SPIFFs and provide input for STIs (up to ~3 months); Directors/VPs control budgets with formal approval' },
        ],
        marketStandard: [
          { value: 'Managers award SPIFF budgets, contests, and recognition tools to focus teams on priority behaviors' },
        ],
      },
    ],
  },
  marketing_director: {
    personaId: 'marketing_director',
    planId: 'PLAN-MKT-DIR-2026',
    roleTitle: 'Marketing Director',
    channelCode: 'C2c',
    keyFindings: [
      'Market Director+ plans are driven by top-line profitability with limited team-level emphasis. HGV places only 10% weight on broad regional NSV performance.',
      'Aligning Sales and Marketing Director compensation to shared objectives (overall revenue and profitability) is recommended to reduce cross-functional tension.',
      'HGV features one primary acceleration band after target, whereas the market commonly uses two levels (115% and 130%).',
    ],
    rows: [
      {
        attribute: 'Total Comp Range (TCC)',
        hgvPlan: [
          { label: 'Average at Target', value: '~$205k-$250k' },
          { label: 'Top Earners (75th-90th)', value: 'Dir / Sr Director: $489k-$527k' },
        ],
        marketStandard: [
          { label: 'Average at Target', value: '~$220k' },
          { label: 'Top Earners', value: '~$275k-$325k' },
        ],
      },
      {
        attribute: 'Metrics / Weights',
        variesFromMarket: true,
        hgvPlan: [
          { value: 'Total NSV (40%)' },
          { value: 'New Owner NSV (20%)' },
          { value: 'Regional NSV (10%)' },
          { value: 'DC Contribution (30%)' },
          { value: 'Club Pen Rate (qualifier)' },
        ],
        marketStandard: [
          { value: 'Overall Revenue / Sales Volume' },
          { value: 'Profitability / Net Operating Income (NOI)' },
        ],
      },
      {
        attribute: 'Payout Curve',
        variesFromMarket: true,
        hgvPlan: [
          { label: 'Threshold', value: '75% attainment = 60% target payout' },
          { label: 'Mid', value: '90% attainment = 80% target payout' },
          { label: 'Target', value: '100% attainment = 100% target payout' },
          { label: 'Max', value: '110%-135% attainment = 150%-200% target payout' },
        ],
        marketStandard: [
          { label: 'Threshold', value: '90% performance' },
          { label: 'Accelerators', value: 'Typically at 115% and 130% of performance' },
        ],
      },
      {
        attribute: 'Payout Timing',
        hgvPlan: [{ value: 'Monthly for standard metrics; quarterly for Contribution' }],
        marketStandard: [{ value: 'Monthly; quarterly / annual true-ups or bonuses tied to overall results' }],
      },
      {
        attribute: 'Additional Incentives / SPIFFs',
        hgvPlan: [
          { value: 'Directors submit SPIFF, STI, contest, or prize-drawing requests for VP approval; budget owner for lower-level roles' },
        ],
        marketStandard: [
          { value: 'Less common at Director level; more prevalent in frontline and manager roles' },
        ],
      },
    ],
  },
};

export function getMarketingPlanAssessment(personaId: MarketingPersonaId): MarketingPlanAssessment {
  return MARKETING_PLAN_ASSESSMENTS[personaId];
}

export type PlanPersonaId = MarketingPersonaId | 'sales_manager';

export interface PlanAssessmentDefinition {
  personaId: PlanPersonaId;
  planId: string;
  roleTitle: string;
  channelCode: string;
  rows: PlanAssessmentRow[];
  keyFindings: string[];
}

export const SALES_MANAGER_ASSESSMENT: PlanAssessmentDefinition = {
  personaId: 'sales_manager',
  planId: 'PLAN-MGR-2025',
  roleTitle: 'Sales Manager',
  channelCode: 'MGR',
  keyFindings: [
    'Player-coach manager plans blend direct-report volume with team quota rollup and takeover override economics.',
    'Market manager plans typically emphasize team revenue attainment and rep distribution rather than multi-metric NSV splits.',
    'Threshold and accelerator structures should be reviewed against market 90% entry and dual accelerator bands at 115% / 130%.',
  ],
  rows: [
    {
      attribute: 'Total Comp Range (TCC)',
      hgvPlan: [
        { label: 'Average at Target', value: '~$130k-$180k' },
        { label: 'Top Earners (75th-90th)', value: '$250k-$300k' },
      ],
      marketStandard: [
        { label: 'Average at Target', value: '~$120k-$150k' },
        { label: 'Top Earners', value: '~$220k-$260k' },
      ],
    },
    {
      attribute: 'Metrics / Weights',
      variesFromMarket: true,
      hgvPlan: [
        { value: 'Team Net Sales Volume (35%)' },
        { value: 'Direct Report Quota Attainment Rollup (25%)' },
        { value: 'FFS Mix vs Target (15%)' },
        { value: 'Team VPG Quality (10%)' },
        { value: 'Manager Override / TO Credit (15%)' },
      ],
      marketStandard: [
        { value: 'Team revenue' },
        { value: 'Rep attainment distribution' },
        { value: 'Product mix' },
        { value: 'Downstream contract quality' },
      ],
    },
    {
      attribute: 'Payout Curve',
      variesFromMarket: true,
      hgvPlan: [
        { label: 'Threshold', value: '75% team attainment (60% payout)' },
        { label: 'Target', value: '100% (100% target payout)' },
        { label: 'Max', value: '125% team attainment (175% payout)' },
      ],
      marketStandard: [
        { label: 'Threshold', value: '90% performance' },
        { label: 'Accelerators', value: '115% and 130%' },
      ],
    },
    {
      attribute: 'Payout Timing',
      hgvPlan: [{ value: 'Monthly on team volume & attainment; quarterly true-up on override / contribution components' }],
      marketStandard: [{ value: 'Monthly team metrics with quarterly profitability reconciliation' }],
    },
    {
      attribute: 'Additional Incentives / SPIFFs',
      hgvPlan: [
        { value: 'Managers approve team SPIFFs (<$5k local); STIs up to 3 months with VP sign-off; TO exception pricing authority' },
      ],
      marketStandard: [
        { value: 'Contests, team pushes, discretionary recognition tied to tour quality' },
      ],
    },
  ],
};

export function getPlanAssessmentFallback(personaId: string): PlanAssessmentDefinition | null {
  if (personaId in MARKETING_PLAN_ASSESSMENTS) {
    return getMarketingPlanAssessment(personaId as MarketingPersonaId);
  }
  if (personaId === 'sales_manager') return SALES_MANAGER_ASSESSMENT;
  return null;
}
