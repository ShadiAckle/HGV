/**
 * Persona model — one underlying system, persona-specific semantic views.
 * Field personas C1–C3 detailed in personaQuestionInventory.ts.
 */
export type PersonaId =
  | 'comp_admin'
  | 'finance'
  | 'call_center'
  | 'marketing_rep'
  | 'marketing_manager'
  | 'marketing_director'
  | 'sales_executive'
  | 'leadership';

export interface PersonaDefinition {
  id: PersonaId;
  code?: string;
  title: string;
  exampleOwner: string;
  route: string;
  pillar: 'comp_qa' | 'target_scenario' | 'forecast';
  summary: string;
  keyQuestions: readonly string[];
  dataNote?: string;
}

export const COMP_CAPABILITIES = [
  {
    id: 'comp_qa',
    title: 'Comp Q&A & admin automation',
    description:
      'Answer recurring inquiries—missing credit, payouts, disputes, cancellations—and reduce Biz Ops load on high-frequency questions.',
  },
  {
    id: 'target_scenario',
    title: 'Target setting & scenario modeling',
    description:
      'Transparent target methodology and what-if analysis on quota, rates, and plan levers—impact on performance and comp cost.',
  },
  {
    id: 'forecast',
    title: 'Sales earnings forecasting',
    description:
      'Forward-looking earnings at aggregate level given fast transactional sales cycles.',
    optional: true,
  },
] as const;

/** @deprecated Use COMP_CAPABILITIES */
export const POC_PILLARS = COMP_CAPABILITIES;

export const PERSONAS: readonly PersonaDefinition[] = [
  {
    id: 'comp_admin',
    title: 'Comp Admin',
    exampleOwner: 'Kelly / Eve / Amy',
    route: '/comp-admin',
    pillar: 'comp_qa',
    summary: 'Disputes, credit rules, payout validation, and comp-statement reconciliation.',
    keyQuestions: [
      'Why was this deal not credited this period?',
      'Does this rep\'s payout match the calc export?',
      'Which bookings are not in the latest calc run yet?',
    ],
    dataNote: 'Grounded in calc export lineage and governed dispute workflows.',
  },
  {
    id: 'finance',
    title: 'Finance',
    exampleOwner: 'Kathy',
    route: '/finance',
    pillar: 'target_scenario',
    summary: 'Budget envelopes, projected payout cost, and scenario budget impact.',
    keyQuestions: [
      'What is total projected comp cost under the simulated plan?',
      'How does a +5% quota change affect the budget?',
      'What is expected performance at current levers?',
    ],
  },
  {
    id: 'call_center',
    code: 'C1',
    title: 'Call Center / Telemarketing',
    exampleOwner: 'Field — package & tour credit',
    route: '/admin-console',
    pillar: 'comp_qa',
    summary: 'Package credit, activation, tour show, conversion, lead status, Blue Light, tool routing.',
    keyQuestions: [
      'Did I get credit for this package sale?',
      'Why is this package not on my statement?',
      'Which system should I check: Voice, Salesforce, Scripter, Cognos, or The Hub?',
    ],
    dataNote: 'Package and tour credit events from Voice, Salesforce, and statement lineage.',
  },
  {
    id: 'marketing_rep',
    code: 'C2a',
    title: 'Marketing Representative (OPC / In-House)',
    exampleOwner: 'Field — tour quality & penetration',
    route: '/admin-console',
    pillar: 'comp_qa',
    summary: 'Booked vs shown vs sold, qualified tours, SPIFFs, contests, guest type, arrivals assignment.',
    keyQuestions: [
      'Am I paid on booked tours, shown tours, or sold tours?',
      'Why was this tour marked non-qualified?',
      'Am I eligible for today\'s SPIFF?',
    ],
    dataNote: 'Tour qualification, penetration denominators, and SPIFF/contest tables.',
  },
  {
    id: 'marketing_manager',
    code: 'C2b',
    title: 'Marketing Manager',
    exampleOwner: 'Field — site level tour flow & overrides',
    route: '/admin-console',
    pillar: 'target_scenario',
    summary: 'Site tour flow, cost per tour, penetration rates, manager override structures.',
    keyQuestions: [
      'What is the salary range of a marketing manager at target?',
      'How does Net Sales Volume contribute to team targets?',
      'What threshold applies to manager overrides?',
    ],
    dataNote: 'Site volume performance and contribution override sheets.',
  },
  {
    id: 'marketing_director',
    code: 'C2c',
    title: 'Marketing Director',
    exampleOwner: 'Field — regional profitability & VPG',
    route: '/admin-console',
    pillar: 'target_scenario',
    summary: 'Regional Net Sales Volume, DC contribution margins, and profitability targets.',
    keyQuestions: [
      'Explain the gap between HGV and market director comp.',
      'What is the weight on regional NSV in my director plan?',
      'What quarterly audits apply to contribution payouts?',
    ],
    dataNote: 'Enterprise profitability metrics, VPG, and regional Net Sales Volume projections.',
  },
  {
    id: 'sales_executive',
    code: 'C3',
    title: 'Sales Executive',
    exampleOwner: 'Jason Morrison',
    route: '/my-compensation',
    pillar: 'comp_qa',
    summary: 'Commission tracking, contract volume, quarterly goals, line rotation, and earnings forecasting.',
    keyQuestions: [
      'How was my commission calculated on my last contract?',
      'What do I need to sell to unlock my next rate booster?',
      'Why was there a commission adjustment on my recent closed deal?',
    ],
    dataNote: 'Live sales metrics and earnings data synced nightly from verified company systems.',
  },
  {
    id: 'leadership',
    title: 'Leadership / Analytics',
    exampleOwner: 'Charles',
    route: '/team',
    pillar: 'target_scenario',
    summary: 'Team attainment, at-risk reps, product mix vs budget, and target-setting transparency.',
    keyQuestions: [
      'What is team quota attainment and who is at risk?',
      'How does FFS mix compare to target?',
      'What happens to cost if we adjust accelerators?',
    ],
    dataNote: 'Team snapshots and scenario views from the comp semantic layer.',
  },
] as const;
