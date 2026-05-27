/** Human-readable LuxeDbLoader step labels — no API paths or query names. */

export const LOADING = {
  session: 'Confirming your role and permissions',
  marketingWorkspace: 'Assembling earnings, tours, and plan metrics',
  planAssessment: 'Loading HGV vs market plan assessment',
  managerWorkspace: 'Rolling up team production and coaching signals',
  managerComp: 'Loading your plan weights and payout curve',
  regionalBonus: 'Fetching regional bonus tier thresholds',

  // Sales rep (analytics)
  repKpi: 'Calculating quota and earnings snapshot',
  repBreakdown: 'Splitting base pay, commission, and bonus',
  repDeals: 'Pulling closed deal credits',
  repMonthly: 'Building monthly attainment trend',

  // Team workspace
  teamKpi: 'Summarizing team quota and attainment',
  teamLeaderboard: 'Ranking direct report production',

  // Scenario modeler
  scenarios: 'Loading saved what-if scenarios',
  industryBenchmarks: 'Pulling market compensation benchmarks',

  // Comp admin
  planEligibility: 'Verifying plan assignment and proration',
  payoutTrail: 'Tracing payout history for this period',
  adminChargebacks: 'Reviewing held commissions and chargebacks',
  auditLog: 'Gathering compliance audit events',
  payrollPreview: 'Preparing payroll preview batch',

  // Finance intelligence
  financeCost: 'Sizing incentive spend against budget',
  financeTourQuality: 'Grading tour quality and VPG',
  financeLeadAbc: 'Ranking performance by lead quality score',
  financeSpiffRoi: 'Measuring SPIFF return on incremental sales',
  financeChargebackExposure: 'Scanning open reserve liabilities',
  financeAccruals: 'Reconciling earned vs paid compensation',
  financePayForPerf: 'Correlating pay with tour quality',

  // AI insights
  aiContext: 'Packaging your live compensation context',
  aiRepBrief: 'Drafting personalized earnings guidance',
  aiManagerPayout: 'Summarizing your payout opportunities',
  aiManagerCoaching: 'Prioritizing team coaching actions',

  aiScenario: 'Packaging scenario levers and projected outcomes',
  aiScenarioBrief: 'Summarizing SteerCo trade-offs',
  aiPlanAssessment: 'Reviewing HGV vs market plan variances',
  aiPlanBrief: 'Explaining plan design implications',
  aiPayMix: 'Assessing pay mix vs market standards',
  aiPayMixBrief: 'Interpreting statement volatility risk',
  aiTourLedger: 'Reviewing tours, chargebacks, and arrivals',
  aiTourBrief: 'Prioritizing tour recovery actions',
  aiEarningsSnapshot: 'Reading earnings mix and monthly trend',
  aiEarningsBrief: 'Interpreting chart and deal patterns',

  // Benchmark impact synthesis
  benchmarkImpactContext: 'Packaging pay mix and market position facts',
  benchmarkImpactLlm: 'Translating market standards to your statement',
} as const;

export const FINANCE_LOAD_STEP_DEFS = [
  { id: 'cost', label: LOADING.financeCost },
  { id: 'tour', label: LOADING.financeTourQuality },
  { id: 'lead', label: LOADING.financeLeadAbc },
  { id: 'roi', label: LOADING.financeSpiffRoi },
  { id: 'exposure', label: LOADING.financeChargebackExposure },
  { id: 'accrual', label: LOADING.financeAccruals },
  { id: 'perf', label: LOADING.financePayForPerf },
] as const;

export const ADMIN_LOAD_STEP_DEFS = [
  { id: 'eligibility', label: LOADING.planEligibility },
  { id: 'trail', label: LOADING.payoutTrail },
  { id: 'chargebacks', label: LOADING.adminChargebacks },
  { id: 'audit', label: LOADING.auditLog },
  { id: 'payroll', label: LOADING.payrollPreview },
] as const;
