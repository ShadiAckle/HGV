export type DataDomainTag = 'Marketing' | 'Finance' | 'Sales' | 'Call Center';

export interface ModelColumn {
  name: string;
  type: string;
  key?: 'PK' | 'FK';
  note?: string;
}

export interface ModelTable {
  id: string;
  name: string;
  layer: 'dimension' | 'fact' | 'reference' | 'scenario';
  domain: DataDomainTag;
  purpose: string;
  grain: string;
  columns: ModelColumn[];
  seededBy: string;
  /** Live API routes that read this table — import contract for go-live */
  apiEndpoints?: string[];
  uiSurfaces?: string[];
}

export interface ModelJoin {
  from: string;
  to: string;
  on: string;
  cardinality: string;
}

export interface EtlStage {
  id: string;
  title: string;
  subtitle: string;
  inputs: string[];
  transforms: string[];
  outputs: string[];
  highlight?: boolean;
}

export interface DataDomainModel {
  tag: DataDomainTag;
  label: string;
  description: string;
  status: 'live' | 'planned';
  rawSources: { name: string; format: string; examples: string[] }[];
  pipeline: EtlStage[];
  tables: ModelTable[];
  joins: ModelJoin[];
  productionNote: string;
  /** Authoritative rep-to-plan mapping table id */
  planAssignmentTable?: string;
}

export const DATA_DOMAIN_MODELS: DataDomainModel[] = [
  {
    tag: 'Marketing',
    label: 'Marketing Compensation',
    description:
      'C2a-C2c marketing rep, manager, and director compensation. Powers My Compensation, plan assessment, industry benchmarks, and comp statement impact.',
    status: 'live',
    planAssignmentTable: 'fact_plan_eligibility',
    rawSources: [
      {
        name: 'HRIS / Payee Roster',
        format: 'CSV',
        examples: ['rep_id', 'rep_name', 'level_code', 'team_id', 'plan_version_id'],
      },
      {
        name: 'Arrivals / Tour Ledger',
        format: 'CSV / API',
        examples: ['tour_id', 'guest_type', 'tour_status', 'payout', 'fps_potential'],
      },
      {
        name: 'Marketing Plan Catalog',
        format: 'Reference JSON',
        examples: ['persona_id', 'attribute', 'hgv_plan', 'market_standard'],
      },
      {
        name: 'Industry Benchmark Feed',
        format: 'CSV',
        examples: ['role_key', 'metric_code', 'market_value', 'hgv_typical_value'],
      },
    ],
    pipeline: [
      {
        id: 'extract',
        title: 'Extract',
        subtitle: 'Raw operational exports',
        inputs: ['Payee roster export', 'Tour arrivals file', 'Plan assessment catalog', 'Benchmark CSV'],
        transforms: ['Column presence validation', 'Encoding normalization (UTF-8)', 'Period filter (period_id)'],
        outputs: ['Bronze staging frames'],
      },
      {
        id: 'transform',
        title: 'Transform',
        subtitle: 'Map to governed star schema',
        inputs: ['Bronze staging frames', 'column mapping registry'],
        transforms: [
          'Rep ID / period_id standardization',
          'Guest type enum (Owner, New Buyer, Non-Owner)',
          'Metric weight % validation (sum to plan)',
          'TCC gap vs market % derivation',
        ],
        outputs: ['Silver conformed entities'],
        highlight: true,
      },
      {
        id: 'load',
        title: 'Load',
        subtitle: 'MERGE into Unity Catalog',
        inputs: ['Silver conformed entities'],
        transforms: ['DELETE + INSERT for period slice (mock seed)', 'TRUNCATE + reload (production go-live)'],
        outputs: ['workspace.hgv_comp.* Delta tables'],
      },
      {
        id: 'serve',
        title: 'Serve',
        subtitle: 'App & AI grounding',
        inputs: ['Delta gold tables'],
        transforms: ['API joins for workspace payload', 'Plan assessment enrichment', 'Benchmark grounding for LLM'],
        outputs: ['My Compensation UI', 'Plan Assessment panel', 'Comp Statement Impact', 'AI insights'],
      },
    ],
    tables: [
      {
        id: 'dim_period',
        name: 'dim_period',
        layer: 'dimension',
        domain: 'Marketing',
        purpose: 'Reporting period picker and period labels across all marketing facts.',
        grain: 'One row per period_id',
        seededBy: '02a_seed_core_dims.sql',
        columns: [
          { name: 'period_id', type: 'STRING', key: 'PK' },
          { name: 'period_label', type: 'STRING' },
          { name: 'period_start', type: 'DATE' },
          { name: 'period_end', type: 'DATE' },
          { name: 'is_current', type: 'BOOLEAN' },
        ],
      },
      {
        id: 'dim_team',
        name: 'dim_team',
        layer: 'dimension',
        domain: 'Marketing',
        purpose: 'Team / site dimension for manager rollups.',
        grain: 'One row per team_id',
        seededBy: '02a_seed_core_dims.sql',
        apiEndpoints: ['GET /api/comp/manager/workspace'],
        uiSurfaces: ['Team Workspace header'],
        columns: [
          { name: 'team_id', type: 'STRING', key: 'PK' },
          { name: 'team_name', type: 'STRING' },
          { name: 'region', type: 'STRING' },
        ],
      },
      {
        id: 'dim_plan_version',
        name: 'dim_plan_version',
        layer: 'dimension',
        domain: 'Marketing',
        purpose: 'Plan catalog — resolves plan_version_id to human-readable plan name.',
        grain: 'One row per plan_version_id',
        seededBy: '02_seed_synthetic_data.sql',
        apiEndpoints: ['GET /api/comp/admin/eligibility'],
        uiSurfaces: ['Comp Admin - Eligibility'],
        columns: [
          { name: 'plan_version_id', type: 'STRING', key: 'PK' },
          { name: 'plan_name', type: 'STRING' },
          { name: 'effective_start', type: 'DATE' },
          { name: 'effective_end', type: 'DATE' },
        ],
      },
      {
        id: 'fact_plan_eligibility',
        name: 'fact_plan_eligibility',
        layer: 'fact',
        domain: 'Marketing',
        purpose: 'Authoritative rep-to-plan assignment per period (join to dim_plan_version for plan name).',
        grain: 'rep_id + period_id',
        seededBy: '05a_seed_admin_finance.sql',
        apiEndpoints: ['GET /api/comp/admin/eligibility'],
        uiSurfaces: ['Comp Admin - Plan Eligibility tab'],
        columns: [
          { name: 'rep_id', type: 'STRING', key: 'FK' },
          { name: 'period_id', type: 'STRING', key: 'FK' },
          { name: 'plan_version_id', type: 'STRING', key: 'FK', note: 'Join to dim_plan_version' },
          { name: 'proration_pct', type: 'DECIMAL' },
          { name: 'eligibility_flag', type: 'BOOLEAN' },
          { name: 'job_code', type: 'STRING' },
          { name: 'brand', type: 'STRING' },
        ],
      },
      {
        id: 'dim_rep',
        name: 'dim_rep',
        layer: 'dimension',
        domain: 'Marketing',
        purpose: 'Marketing personas and desk assignments (PERSONA-MKT-*).',
        grain: 'One row per rep_id',
        seededBy: '06a_seed_marketing_benchmark.sql',
        apiEndpoints: ['GET /api/comp/marketing/workspace', 'GET /api/comp/manager/workspace'],
        uiSurfaces: ['My Compensation', 'Team Workspace'],
        columns: [
          { name: 'rep_id', type: 'STRING', key: 'PK' },
          { name: 'rep_name', type: 'STRING' },
          { name: 'level_code', type: 'STRING', note: 'C2a / C2b / C2c' },
          { name: 'team_id', type: 'STRING', key: 'FK' },
          { name: 'manager_rep_id', type: 'STRING', key: 'FK' },
          { name: 'region', type: 'STRING' },
        ],
      },
      {
        id: 'fact_marketing_rep_period',
        name: 'fact_marketing_rep_period',
        layer: 'fact',
        domain: 'Marketing',
        purpose: 'QTD earnings rollup, pay mix, TCC gap, tier progress for My Comp KPI cards.',
        grain: 'rep_id + period_id',
        seededBy: '06a_seed_marketing_benchmark.sql',
        apiEndpoints: ['GET /api/comp/marketing/workspace'],
        uiSurfaces: ['My Compensation KPI cards', 'Comp Statement Impact'],
        columns: [
          { name: 'rep_id', type: 'STRING', key: 'FK' },
          { name: 'period_id', type: 'STRING', key: 'FK' },
          { name: 'plan_id', type: 'STRING', note: 'Denormalized; must match fact_plan_eligibility' },
          { name: 'qtd_earnings', type: 'DECIMAL' },
          { name: 'base_pct', type: 'DECIMAL', note: 'Pay mix vs market' },
          { name: 'tcc_gap_vs_market_pct', type: 'DECIMAL' },
          { name: 'next_tier_label', type: 'STRING' },
          { name: 'qualified_tours', type: 'INT' },
        ],
      },
      {
        id: 'fact_marketing_rep_metric',
        name: 'fact_marketing_rep_metric',
        layer: 'fact',
        domain: 'Marketing',
        purpose: 'Plan metric weights aligned to external plan assessment (Tours, FPS, Transactions).',
        grain: 'rep_id + period_id + metric_name',
        seededBy: '06a_seed_marketing_benchmark.sql',
        columns: [
          { name: 'rep_id', type: 'STRING', key: 'FK' },
          { name: 'period_id', type: 'STRING', key: 'FK' },
          { name: 'metric_name', type: 'STRING' },
          { name: 'weight_pct', type: 'DECIMAL' },
          { name: 'earnings', type: 'DECIMAL' },
          { name: 'opportunity_usd', type: 'DECIMAL' },
        ],
      },
      {
        id: 'fact_marketing_tour_payout',
        name: 'fact_marketing_tour_payout',
        layer: 'fact',
        domain: 'Marketing',
        purpose: 'Tour activity ledger - Owner vs NB credits and FPS potential.',
        grain: 'tour_id + rep_id + period_id',
        seededBy: '06a_seed_marketing_benchmark.sql',
        columns: [
          { name: 'tour_id', type: 'STRING', key: 'PK' },
          { name: 'rep_id', type: 'STRING', key: 'FK' },
          { name: 'guest_type', type: 'STRING' },
          { name: 'tour_status', type: 'STRING' },
          { name: 'payout', type: 'DECIMAL' },
          { name: 'fps_potential', type: 'DECIMAL' },
        ],
      },
      {
        id: 'fact_marketing_arrival',
        name: 'fact_marketing_arrival',
        layer: 'fact',
        domain: 'Marketing',
        purpose: 'Upcoming arrivals with projected tour + FPS payout.',
        grain: 'arrival_id',
        seededBy: '06a_seed_marketing_benchmark.sql',
        columns: [
          { name: 'arrival_id', type: 'STRING', key: 'PK' },
          { name: 'rep_id', type: 'STRING', key: 'FK' },
          { name: 'guest_type', type: 'STRING' },
          { name: 'projected_total_payout', type: 'DECIMAL' },
        ],
      },
      {
        id: 'plan_assessment_profile',
        name: 'plan_assessment_profile',
        layer: 'reference',
        domain: 'Marketing',
        purpose: 'External plan assessment header by persona (C2a-C2c).',
        grain: 'persona_id + effective_period',
        seededBy: '10a_seed_plan_assessment.sql',
        apiEndpoints: ['GET /api/comp/plan-assessment'],
        uiSurfaces: ['External Plan Assessment panel'],
        columns: [
          { name: 'persona_id', type: 'STRING', key: 'PK' },
          { name: 'plan_id', type: 'STRING', note: 'Design catalog id (persona-level, not rep assignment)' },
          { name: 'role_title', type: 'STRING' },
          { name: 'channel_code', type: 'STRING' },
        ],
      },
      {
        id: 'plan_assessment_segment',
        name: 'plan_assessment_segment',
        layer: 'reference',
        domain: 'Marketing',
        purpose: 'HGV vs market plan design rows — queried directly by GET /api/comp/plan-assessment.',
        grain: 'persona_id + attribute + side + segment_order',
        seededBy: '10a_seed_plan_assessment.sql',
        apiEndpoints: ['GET /api/comp/plan-assessment'],
        uiSurfaces: ['External Plan Assessment table cells'],
        columns: [
          { name: 'persona_id', type: 'STRING', key: 'FK' },
          { name: 'attribute', type: 'STRING' },
          { name: 'side', type: 'STRING', note: 'hgv | market' },
          { name: 'segment_value', type: 'STRING' },
        ],
      },
      {
        id: 'industry_comp_benchmark',
        name: 'industry_comp_benchmark',
        layer: 'reference',
        domain: 'Marketing',
        purpose: 'Four-area industry standards for SteerCo-style gap analysis.',
        grain: 'benchmark_id',
        seededBy: '06a_seed_marketing_benchmark.sql',
        columns: [
          { name: 'role_key', type: 'STRING' },
          { name: 'metric_code', type: 'STRING' },
          { name: 'market_value', type: 'DECIMAL' },
          { name: 'hgv_typical_value', type: 'DECIMAL' },
        ],
      },
      {
        id: 'fact_marketing_chargeback',
        name: 'fact_marketing_chargeback',
        layer: 'fact',
        domain: 'Marketing',
        purpose: 'Marketing premium gift and tour chargebacks deducted from payout.',
        grain: 'chargeback_id',
        seededBy: '06a_seed_marketing_benchmark.sql',
        apiEndpoints: ['GET /api/comp/marketing/workspace'],
        uiSurfaces: ['My Compensation - chargebacks section'],
        columns: [
          { name: 'chargeback_id', type: 'STRING', key: 'PK' },
          { name: 'rep_id', type: 'STRING', key: 'FK' },
          { name: 'period_id', type: 'STRING', key: 'FK' },
          { name: 'chargeback_amount', type: 'DECIMAL' },
        ],
      },
      {
        id: 'fact_regional_bonus_area',
        name: 'fact_regional_bonus_area',
        layer: 'reference',
        domain: 'Marketing',
        purpose: 'Regional bonus program areas (e.g. LV-HGV-AL).',
        grain: 'area_id',
        seededBy: 'compSchemaBootstrap regional bonus seed',
        apiEndpoints: ['GET /api/comp/marketing/regional-bonus'],
        uiSurfaces: ['Team Workspace - Regional Bonus Levels'],
        columns: [
          { name: 'area_id', type: 'STRING', key: 'PK' },
          { name: 'area_label', type: 'STRING' },
          { name: 'period_id', type: 'STRING' },
        ],
      },
      {
        id: 'fact_regional_bonus_tier',
        name: 'fact_regional_bonus_tier',
        layer: 'reference',
        domain: 'Marketing',
        purpose: 'Bonus tier thresholds (levels 0-8) per regional area.',
        grain: 'area_id + tier_level',
        seededBy: 'compSchemaBootstrap regional bonus seed',
        apiEndpoints: ['GET /api/comp/marketing/regional-bonus'],
        uiSurfaces: ['Team Workspace - Regional Bonus Levels chart'],
        columns: [
          { name: 'area_id', type: 'STRING', key: 'FK' },
          { name: 'tier_level', type: 'INT' },
          { name: 'tier_label', type: 'STRING' },
          { name: 'bonus_amount', type: 'DECIMAL' },
        ],
      },
      {
        id: 'scenario_run',
        name: 'scenario_run',
        layer: 'scenario',
        domain: 'Marketing',
        purpose: 'What-if scenario lever inputs (quota, commission, tour volume, conversion).',
        grain: 'scenario_id',
        seededBy: '02_seed_synthetic_data.sql',
        apiEndpoints: ['GET /api/comp/scenarios', 'POST /api/comp/scenarios'],
        uiSurfaces: ['Scenario Modeler - lever panel'],
        columns: [
          { name: 'scenario_id', type: 'STRING', key: 'PK' },
          { name: 'quota_change_pct', type: 'DECIMAL' },
          { name: 'tour_volume_change_pct', type: 'DECIMAL' },
          { name: 'conversion_rate_change_pct', type: 'DECIMAL' },
        ],
      },
      {
        id: 'scenario_result',
        name: 'scenario_result',
        layer: 'scenario',
        domain: 'Marketing',
        purpose: 'Projected payout and budget impact per scenario.',
        grain: 'scenario_id',
        seededBy: '02_seed_synthetic_data.sql',
        apiEndpoints: ['GET /api/comp/scenarios'],
        uiSurfaces: ['Scenario Modeler - comparison matrix'],
        columns: [
          { name: 'scenario_id', type: 'STRING', key: 'FK' },
          { name: 'projected_payouts', type: 'DECIMAL' },
          { name: 'budget_impact', type: 'DECIMAL' },
        ],
      },
      {
        id: 'fact_rep_market_position',
        name: 'fact_rep_market_position',
        layer: 'fact',
        domain: 'Marketing',
        purpose: 'Mixed above/below market TCC positions for team coaching.',
        grain: 'rep_id + period_id',
        seededBy: '06a_seed_marketing_benchmark.sql',
        columns: [
          { name: 'rep_id', type: 'STRING', key: 'PK' },
          { name: 'tcc_gap_vs_market_pct', type: 'DECIMAL' },
          { name: 'base_pct', type: 'DECIMAL' },
          { name: 'quota_attainment_pct', type: 'DECIMAL' },
        ],
      },
    ],
    joins: [
      { from: 'fact_plan_eligibility', to: 'dim_plan_version', on: 'plan_version_id', cardinality: 'N:1' },
      { from: 'fact_plan_eligibility', to: 'dim_rep', on: 'rep_id', cardinality: 'N:1' },
      { from: 'fact_marketing_rep_period', to: 'dim_rep', on: 'rep_id', cardinality: 'N:1' },
      { from: 'fact_marketing_rep_period', to: 'dim_period', on: 'period_id', cardinality: 'N:1' },
      { from: 'fact_marketing_rep_metric', to: 'fact_marketing_rep_period', on: 'rep_id, period_id', cardinality: 'N:1' },
      { from: 'fact_marketing_tour_payout', to: 'dim_rep', on: 'rep_id', cardinality: 'N:1' },
      { from: 'fact_marketing_arrival', to: 'dim_rep', on: 'rep_id', cardinality: 'N:1' },
      { from: 'fact_marketing_chargeback', to: 'dim_rep', on: 'rep_id', cardinality: 'N:1' },
      { from: 'plan_assessment_segment', to: 'plan_assessment_profile', on: 'persona_id', cardinality: 'N:1' },
      { from: 'fact_rep_market_position', to: 'dim_rep', on: 'rep_id', cardinality: 'N:1' },
      { from: 'fact_regional_bonus_tier', to: 'fact_regional_bonus_area', on: 'area_id', cardinality: 'N:1' },
      { from: 'scenario_result', to: 'scenario_run', on: 'scenario_id', cardinality: '1:1' },
    ],
    productionNote:
      'Go-live: TRUNCATE marketing fact tables (retain schema), run production ETL into the same column contract, then validate API payloads match mock seed shapes before cutover. Plan assessment is already warehouse-backed (plan_assessment_segment queried by SQL); unicode is normalized at API render.',
  },
  {
    tag: 'Finance',
    label: 'Finance Intelligence',
    description:
      'Downstream cost of sales, tour quality / VPG, SPIFF ROI, accruals, and pay-for-performance. Powers the Finance Intelligence nav tab (Slides 27, 36/150, 54-55).',
    status: 'live',
    rawSources: [
      {
        name: 'Payroll / Payout Ledger',
        format: 'CSV / ERP export',
        examples: ['rep_id', 'period_id', 'base_pay', 'commission', 'bonus', 'total_earnings', 'total_paid'],
      },
      {
        name: 'Tour Quality CRM Feed',
        format: 'CSV / API',
        examples: ['tour_id', 'abc_score', 'lead_source', 'showed_flag', 'closed_flag', 'vpg', 'net_sales_volume'],
      },
      {
        name: 'Chargeback & Reserve Register',
        format: 'CSV',
        examples: ['chargeback_id', 'deal_id', 'reserve_held', 'reserve_released', 'status'],
      },
      {
        name: 'Comp Admin Audit Log',
        format: 'Event stream',
        examples: ['event_id', 'event_type', 'amount', 'reason', 'approved_by'],
      },
    ],
    pipeline: [
      {
        id: 'extract',
        title: 'Extract',
        subtitle: 'Finance & operations exports',
        inputs: ['Payroll payout files', 'Tour showed/closed ledger', 'Chargeback register', 'SPIFF approval log'],
        transforms: ['Period_id alignment', 'Active rep filter (dim_rep.is_active)', 'Currency normalization'],
        outputs: ['Bronze finance staging'],
      },
      {
        id: 'transform',
        title: 'Transform',
        subtitle: 'Cost & quality analytics',
        inputs: ['Bronze finance staging'],
        transforms: [
          'VPG = net_sales_volume / closed tours',
          'Variable comp % of NSV = SUM(total_earnings) / SUM(net_sales_volume)',
          'ABC lead performance rollups (show/close/rescission rates)',
          'SPIFF ROI = incremental_nsv / total_spiff_cost (3:1 threshold)',
          'Accrual = total_earned - total_paid; open reserve from fact_chargeback',
        ],
        outputs: ['Silver finance aggregates'],
        highlight: true,
      },
      {
        id: 'load',
        title: 'Load',
        subtitle: 'Unity Catalog finance facts',
        inputs: ['Silver finance aggregates'],
        transforms: ['TRUNCATE + reload fact_tour_quality, fact_chargeback per period', 'MERGE fact_payout, fact_comp_admin_log', 'UPSERT dim_finance_period per period'],
        outputs: ['workspace.hgv_comp.fact_payout', 'fact_tour_quality', 'fact_chargeback', 'fact_comp_admin_log', 'dim_finance_period'],
      },
      {
        id: 'serve',
        title: 'Serve',
        subtitle: 'Finance Intelligence APIs',
        inputs: ['Finance gold tables'],
        transforms: ['7 finance API aggregations', 'Copilot finance context builder'],
        outputs: ['Finance Intelligence tab (4 sub-tabs)', 'AI Finance prompts'],
      },
    ],
    tables: [
      {
        id: 'fin_dim_rep',
        name: 'dim_rep',
        layer: 'dimension',
        domain: 'Finance',
        purpose: 'Rep hierarchy for cost rollups by level_code and region.',
        grain: 'One row per rep_id',
        seededBy: '02_seed_synthetic_data.sql',
        apiEndpoints: ['GET /api/comp/finance/cost-summary', 'GET /api/comp/finance/pay-for-perf'],
        uiSurfaces: ['Finance - Cost by Role', 'Pay-for-Performance leaderboard'],
        columns: [
          { name: 'rep_id', type: 'STRING', key: 'PK' },
          { name: 'rep_name', type: 'STRING' },
          { name: 'level_code', type: 'STRING' },
          { name: 'region', type: 'STRING' },
          { name: 'is_active', type: 'BOOLEAN' },
        ],
      },
      {
        id: 'dim_finance_period',
        name: 'dim_finance_period',
        layer: 'reference',
        domain: 'Finance',
        purpose: 'Period finance control — comp budget, payroll lock, accrual basis, ROI/corridor thresholds, EBITDA assumption.',
        grain: 'period_id',
        seededBy: '05b_extend_finance_reference.sql',
        apiEndpoints: [
          'GET /api/comp/finance/cost-summary',
          'GET /api/comp/finance/accrual-summary',
          'GET /api/comp/finance/roi-analysis',
          'GET /api/comp/finance/scenario-cost',
        ],
        uiSurfaces: ['Finance - Cost Analysis budget variance', 'Accruals lock date & policy', 'SPIFF ROI threshold', 'Scenario EBITDA impact'],
        columns: [
          { name: 'period_id', type: 'STRING', key: 'PK' },
          { name: 'budget_comp', type: 'DECIMAL', note: 'Approved variable comp budget' },
          { name: 'payroll_lock_date', type: 'DATE' },
          { name: 'accrual_basis', type: 'STRING' },
          { name: 'var_comp_target_min_pct', type: 'DECIMAL' },
          { name: 'var_comp_target_max_pct', type: 'DECIMAL' },
          { name: 'spiff_roi_threshold', type: 'DECIMAL', note: 'Minimum NSV:cost ratio' },
          { name: 'ebitda_margin_pct', type: 'DECIMAL', note: 'Scenario cost EBITDA assumption' },
          { name: 'ffs_reserve_pct', type: 'DECIMAL' },
        ],
      },
      {
        id: 'fin_dim_period',
        name: 'dim_period',
        layer: 'dimension',
        domain: 'Finance',
        purpose: 'Reporting period dimension — period_id filter for all finance facts.',
        grain: 'One row per period_id',
        seededBy: '02_seed_synthetic_data.sql',
        apiEndpoints: ['GET /api/comp/finance/*'],
        uiSurfaces: ['Finance Intelligence period picker'],
        columns: [
          { name: 'period_id', type: 'STRING', key: 'PK' },
          { name: 'period_label', type: 'STRING' },
          { name: 'is_current', type: 'BOOLEAN' },
        ],
      },
      {
        id: 'fact_payout',
        name: 'fact_payout',
        layer: 'fact',
        domain: 'Finance',
        purpose: 'Rep payout breakdown — drives cost summary, accruals, and pay-for-performance.',
        grain: 'rep_id + period_id',
        seededBy: '02_seed_synthetic_data.sql',
        apiEndpoints: [
          'GET /api/comp/finance/cost-summary',
          'GET /api/comp/finance/accrual-summary',
          'GET /api/comp/finance/pay-for-perf',
        ],
        uiSurfaces: ['Finance - Cost Analysis KPIs', 'Finance - Accruals tab', 'Pay-for-Performance table'],
        columns: [
          { name: 'rep_id', type: 'STRING', key: 'FK' },
          { name: 'period_id', type: 'STRING', key: 'FK' },
          { name: 'base_pay', type: 'DECIMAL' },
          { name: 'commission', type: 'DECIMAL' },
          { name: 'bonus', type: 'DECIMAL' },
          { name: 'total_earnings', type: 'DECIMAL', note: 'Accrual numerator' },
          { name: 'total_paid', type: 'DECIMAL', note: 'Cash paid to date' },
        ],
      },
      {
        id: 'fact_tour_quality',
        name: 'fact_tour_quality',
        layer: 'fact',
        domain: 'Finance',
        purpose: 'Tour-level quality ledger — VPG, NSV, ABC scores, rescissions (Slide 36 / 150 volume vs quality).',
        grain: 'tour_id + rep_id + period_id',
        seededBy: '05a_seed_admin_finance.sql',
        apiEndpoints: [
          'GET /api/comp/finance/tour-quality',
          'GET /api/comp/finance/lead-performance',
          'GET /api/comp/finance/cost-summary',
          'GET /api/comp/finance/pay-for-perf',
        ],
        uiSurfaces: ['Finance - Tour Quality tab', 'Lead ABC performance matrix', 'VPG KPI card'],
        columns: [
          { name: 'tour_id', type: 'STRING', key: 'PK' },
          { name: 'rep_id', type: 'STRING', key: 'FK' },
          { name: 'period_id', type: 'STRING', key: 'FK' },
          { name: 'lead_source', type: 'STRING' },
          { name: 'abc_score', type: 'STRING', note: 'A / B / C / D' },
          { name: 'showed_flag', type: 'BOOLEAN' },
          { name: 'closed_flag', type: 'BOOLEAN' },
          { name: 'rescission_flag', type: 'BOOLEAN' },
          { name: 'net_sales_volume', type: 'DECIMAL' },
          { name: 'vpg', type: 'DECIMAL' },
          { name: 'ebitda_estimate', type: 'DECIMAL' },
        ],
      },
      {
        id: 'fact_chargeback',
        name: 'fact_chargeback',
        layer: 'fact',
        domain: 'Finance',
        purpose: 'Deal chargebacks and commission reserves — open liability for accruals.',
        grain: 'chargeback_id',
        seededBy: '05a_seed_admin_finance.sql',
        apiEndpoints: ['GET /api/comp/finance/chargeback-exposure', 'GET /api/comp/finance/accrual-summary'],
        uiSurfaces: ['Finance - Accruals tab (open reserve)', 'Chargeback exposure summary'],
        columns: [
          { name: 'chargeback_id', type: 'STRING', key: 'PK' },
          { name: 'deal_id', type: 'STRING' },
          { name: 'rep_id', type: 'STRING', key: 'FK' },
          { name: 'period_id', type: 'STRING', key: 'FK' },
          { name: 'chargeback_amount', type: 'DECIMAL' },
          { name: 'reserve_held', type: 'DECIMAL' },
          { name: 'reserve_released', type: 'DECIMAL' },
          { name: 'status', type: 'STRING', note: 'OPEN | RELEASED | CHARGEDBACK' },
        ],
      },
      {
        id: 'fact_comp_admin_log',
        name: 'fact_comp_admin_log',
        layer: 'fact',
        domain: 'Finance',
        purpose: 'SPIFF and adjustment audit trail — attributed_nsv drives ROI numerator.',
        grain: 'event_id',
        seededBy: '05a_seed_admin_finance.sql + 05b_extend_finance_reference.sql',
        apiEndpoints: ['GET /api/comp/finance/roi-analysis'],
        uiSurfaces: ['Finance - SPIFF / ROI tab', 'Comp Admin - Audit Trail (shared)'],
        columns: [
          { name: 'event_id', type: 'STRING', key: 'PK' },
          { name: 'rep_id', type: 'STRING', key: 'FK' },
          { name: 'period_id', type: 'STRING', key: 'FK' },
          { name: 'event_type', type: 'STRING', note: 'SPIFF | SPIFF_APPROVAL | ADJUSTMENT' },
          { name: 'amount', type: 'DECIMAL', note: 'SPIFF cost (denominator)' },
          { name: 'attributed_nsv', type: 'DECIMAL', note: 'Incremental NSV attributed to event (numerator)' },
          { name: 'reason', type: 'STRING' },
          { name: 'approved_by', type: 'STRING' },
        ],
      },
      {
        id: 'fact_quota_attainment',
        name: 'fact_quota_attainment',
        layer: 'fact',
        domain: 'Finance',
        purpose: 'Quota attainment joined to earnings for pay-for-performance correlation.',
        grain: 'rep_id + period_id',
        seededBy: '02_seed_synthetic_data.sql',
        apiEndpoints: ['GET /api/comp/finance/pay-for-perf'],
        uiSurfaces: ['Finance - Pay-for-Performance (earnings vs VPG scatter)'],
        columns: [
          { name: 'rep_id', type: 'STRING', key: 'FK' },
          { name: 'period_id', type: 'STRING', key: 'FK' },
          { name: 'attainment_pct', type: 'DECIMAL' },
          { name: 'credited_amount', type: 'DECIMAL' },
          { name: 'deals_closed_count', type: 'INT' },
        ],
      },
      {
        id: 'fin_scenario_result',
        name: 'scenario_result',
        layer: 'scenario',
        domain: 'Finance',
        purpose: 'Scenario budget impact for finance cost projections.',
        grain: 'scenario_id',
        seededBy: '02_seed_synthetic_data.sql',
        apiEndpoints: ['GET /api/comp/finance/scenario-cost'],
        uiSurfaces: ['Finance copilot scenario cost prompts'],
        columns: [
          { name: 'scenario_id', type: 'STRING', key: 'FK' },
          { name: 'projected_payouts', type: 'DECIMAL' },
          { name: 'budget_impact', type: 'DECIMAL' },
          { name: 'projected_cost', type: 'DECIMAL' },
        ],
      },
    ],
    joins: [
      { from: 'fact_payout', to: 'dim_rep', on: 'rep_id', cardinality: 'N:1' },
      { from: 'fact_payout', to: 'dim_period', on: 'period_id', cardinality: 'N:1' },
      { from: 'fact_payout', to: 'dim_finance_period', on: 'period_id', cardinality: 'N:1' },
      { from: 'fact_comp_admin_log', to: 'dim_finance_period', on: 'period_id', cardinality: 'N:1' },
      { from: 'fact_chargeback', to: 'dim_finance_period', on: 'period_id', cardinality: 'N:1' },
      { from: 'fact_tour_quality', to: 'dim_rep', on: 'rep_id', cardinality: 'N:1' },
      { from: 'fact_tour_quality', to: 'dim_period', on: 'period_id', cardinality: 'N:1' },
      { from: 'fact_chargeback', to: 'dim_rep', on: 'rep_id', cardinality: 'N:1' },
      { from: 'fact_comp_admin_log', to: 'dim_rep', on: 'rep_id', cardinality: 'N:1' },
      { from: 'fact_quota_attainment', to: 'fact_payout', on: 'rep_id, period_id', cardinality: '1:1' },
      { from: 'fact_tour_quality', to: 'fact_payout', on: 'rep_id, period_id', cardinality: 'N:1' },
      { from: 'scenario_result', to: 'scenario_run', on: 'scenario_id', cardinality: '1:1' },
    ],
    productionNote:
      'Go-live: reload fact_tour_quality and fact_chargeback each period; MERGE fact_payout and fact_comp_admin_log (with attributed_nsv); UPSERT dim_finance_period budget/thresholds. Validate var_comp_pct_of_nsv against dim_finance_period corridor, SPIFF ROI against spiff_roi_threshold, and accrual_to_book against finance control reports before cutover.',
  },
  {
    tag: 'Sales',
    label: 'Sales Compensation',
    description: 'Action Line / In-House sales executives, deal credits, quota attainment, and manager team snapshots.',
    status: 'planned',
    rawSources: [],
    pipeline: [],
    tables: [],
    joins: [],
    productionNote: 'Planned - dim_rep, fact_deal_credit, fact_quota_attainment, fact_payout (see 01_create_schema.sql).',
  },
  {
    tag: 'Call Center',
    label: 'Call Center / Telemarketing',
    description: 'Package sales, activations, tour show credits, and downstream referral overrides.',
    status: 'planned',
    rawSources: [],
    pipeline: [],
    tables: [],
    joins: [],
    productionNote: 'Planned - C1 persona sandbox maps to package and activation facts.',
  },
];

export function getDomainModel(tag: DataDomainTag): DataDomainModel | undefined {
  return DATA_DOMAIN_MODELS.find((d) => d.tag === tag);
}
