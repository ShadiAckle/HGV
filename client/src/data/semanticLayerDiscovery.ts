/**
 * Stakeholder discovery themes for sales compensation analysis — scoping what
 * the assistant should answer before implementation (plans, quotas, payouts).
 */
export interface DiscoveryCategory {
  id: string;
  title: string;
  purpose: string;
  /** Questions we ask stakeholders during discovery / requirements gathering */
  discoveryQuestions: readonly string[];
  /** Natural-language questions the agent can answer once this area is scoped */
  agentExampleQuestions: readonly string[];
}

export const SEMANTIC_LAYER_DISCOVERY: readonly DiscoveryCategory[] = [
  {
    id: 'use_cases',
    title: 'Comp questions & decisions',
    purpose:
      'Connect everyday rep and manager questions to payout, quota, and dispute workflows—so we only encode what teams actually escalate today.',
    discoveryQuestions: [
      'What are the first questions reps, managers, and comp analysts ask each pay cycle?',
      'When someone asks about "my number," do they mean quota attainment, earned, paid, or pipeline credit?',
      'Which answers must be exact (payout dollars, plan tier) vs. directional (trend vs last month)?',
      'What stays out of self-service (draft plans, HR salary, unreleased rate changes)?',
    ],
    agentExampleQuestions: [
      'Did I get credit for this package sale?',
      'Am I paid on booked tours, shown tours, or sold tours?',
      'Explain my paycheck and comp statement in plain English.',
    ],
  },
  {
    id: 'metrics',
    title: 'Commission & quota definitions',
    purpose:
      'Agree on official comp math—what counts toward quota, when a deal credits, accelerators, clawbacks—so the assistant never sounds right with the wrong formula.',
    discoveryQuestions: [
      'What is the official definition of quota credit, earned commission, and paid amount (inclusions/exclusions)?',
      'How do splits, overlays, and house accounts affect rep-level totals?',
      'How are chargebacks, cancellations, and rebooks handled across pay periods?',
      'Which date drives crediting: contract signed, tour date, funding, or recognition in finance?',
    ],
    agentExampleQuestions: [
      'How is quota credit calculated on a split deal?',
      'What is the difference between my earned commission and paid amount this period?',
      'Why was this deal clawed back and which pay period did it affect?',
    ],
  },
  {
    id: 'dimensions',
    title: 'Territory, plan & hierarchy slices',
    purpose:
      'Codify sales org structure—rep, team, region, plan version, product line—so rollups match comp statements and CRM/calc exports.',
    discoveryQuestions: [
      'What grain should a typical answer use: deal, contract, pay period, or rep-month?',
      'Which hierarchies must roll up correctly (rep → manager → region → national)?',
      'What filters always apply (active reps only, credited deals only, current plan version)?',
      'What nicknames exist for plans, products, or markets that must map to one canonical code?',
    ],
    agentExampleQuestions: [
      'Show my quota attainment by product line for the Orlando territory.',
      'How does my team roll up vs. the region for March?',
      'Which plan version applies to deals I closed after the mid-year change?',
    ],
  },
  {
    id: 'systems_scope',
    title: 'Systems, coverage & pay-cycle timing',
    purpose:
      'Set boundaries across CRM, comp engine, finance GL, and manual adjustments—honest scope beats an assistant that pretends payouts are real-time before calc runs.',
    discoveryQuestions: [
      'Which sources are in v1 (bookings, quotas, calc output, adjustments) vs. later (draws, SPIFs)?',
      'How fresh must answers be during open period vs. after comp lock vs. post-audit?',
      'Where do offline spreadsheets or manual true-ups still feed numbers we must acknowledge?',
      'How much history is needed for YoY plan changes and mid-year plan migrations?',
    ],
    agentExampleQuestions: [
      'Is my commission data current through the latest calc run?',
      'When does this pay period lock and when will adjustments post?',
      'Which of my bookings are not in the calc export yet?',
    ],
  },
  {
    id: 'governance',
    title: 'Trust, access & comp confidentiality',
    purpose:
      'Reps see their payouts; managers see their team; comp ops and finance see broader scope—enforced in Unity Catalog, not in prompt instructions.',
    discoveryQuestions: [
      'Who may see deal-level splits, peer rankings, or team attainment—and how is that enforced today?',
      'Do rules differ by sales channel, vacation ownership vs. club sales, or partner-sourced deals?',
      'What audit trail is required when someone asks about payout, quota, or another rep\'s performance?',
      'Are there plan components or rate tables that must never leave comp ops / finance roles?',
    ],
    agentExampleQuestions: [
      'Show only my credited deals and payout detail for this month.',
      'What team attainment can I see as a manager without individual rep payout amounts?',
      'Why can\'t I view another rep\'s commission breakdown?',
    ],
  },
  {
    id: 'validation',
    title: 'Proof against trusted comp reporting',
    purpose:
      'Use comp statements, calc exports, and finance reconciliation reports as control charts before wider rollout.',
    discoveryQuestions: [
      'Which statements or dashboards are the gold standard for each top comp question?',
      'What variance from those reports is acceptable during UAT—rounding, timing, allocation?',
      'Who signs off on the first catalog of approved comp questions and metric definitions?',
      'How will you measure pilot success: fewer disputes, faster self-service, analyst time saved?',
    ],
    agentExampleQuestions: [
      'Does my quota attainment match the official March comp statement?',
      'Walk me through why my payout differs from the calc export by this amount.',
      'Which report should I use to validate my accelerator tier?',
    ],
  },
] as const;
