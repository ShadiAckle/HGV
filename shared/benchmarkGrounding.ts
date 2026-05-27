import type { TeamMarketPosition } from './compStandards.js';

export interface IndustryBenchmarkRow {
  benchmark_id: string;
  role_key: string;
  role_label: string;
  metric_code: string;
  market_value: number;
  hgv_typical_value: number;
  unit: string;
  benchmark_source: string;
  effective_period: string;
  notes: string;
}

export interface IndustryPayMixRole {
  name: string;
  roleKey: string;
  baseline: string;
  standard: string;
  mktBase: number;
  hgvBase: number;
}

export interface IndustryGapAssessment {
  dirGapBaseline: number;
  vpGapBaseline: number;
  dirGap: number;
  vpGap: number;
  optimalCommission: number;
  noiWeightMarket: number;
  roles: IndustryPayMixRole[];
}

function n(v: unknown): number {
  return Number(v ?? 0);
}

export function normalizeIndustryBenchmarkRows(rows: Record<string, unknown>[]): IndustryBenchmarkRow[] {
  return rows.map((r) => ({
    benchmark_id: String(r.benchmark_id ?? ''),
    role_key: String(r.role_key ?? ''),
    role_label: String(r.role_label ?? ''),
    metric_code: String(r.metric_code ?? ''),
    market_value: n(r.market_value),
    hgv_typical_value: n(r.hgv_typical_value),
    unit: String(r.unit ?? '%'),
    benchmark_source: String(r.benchmark_source ?? ''),
    effective_period: String(r.effective_period ?? ''),
    notes: String(r.notes ?? ''),
  }));
}

function findBenchmark(rows: IndustryBenchmarkRow[], roleKey: string, metricCode: string): IndustryBenchmarkRow | undefined {
  return rows.find((r) => r.role_key === roleKey && r.metric_code === metricCode);
}

function marketBase(rows: IndustryBenchmarkRow[], roleKey: string, fallback: number): number {
  return findBenchmark(rows, roleKey, 'PAY_MIX_BASE')?.market_value ?? fallback;
}

function hgvBase(rows: IndustryBenchmarkRow[], roleKey: string, fallback: number): number {
  return findBenchmark(rows, roleKey, 'PAY_MIX_BASE')?.hgv_typical_value ?? fallback;
}

/** Industry gap assessment driven by industry_comp_benchmark + scenario levers. */
export function buildIndustryGapAssessment(
  rows: IndustryBenchmarkRow[],
  levers: {
    commission_rate_pct: number;
    bonus_rate_change_pct: number;
    accelerator_change_pct: number;
    quota_change_pct: number;
  },
): IndustryGapAssessment {
  const dirGapBaseline = findBenchmark(rows, 'marketing_director', 'TCC_GAP_PCT')?.market_value ?? 17;
  const vpGapBaseline = findBenchmark(rows, 'sales_vp', 'TCC_GAP_PCT')?.market_value ?? 43;
  const optimalCommission = findBenchmark(rows, 'all', 'COMMISSION_RATE')?.market_value ?? 6;
  const noiWeightMarket = findBenchmark(rows, 'marketing_director', 'NOI_WEIGHT')?.market_value ?? 65;

  const commLever = levers.commission_rate_pct - 6;
  const bonusLever = levers.bonus_rate_change_pct;
  const accelLever = levers.accelerator_change_pct;
  const quotaLever = levers.quota_change_pct;
  const compImprovement = commLever * 1.5 + bonusLever * 0.35 + accelLever * 0.15;
  const shift = bonusLever * 0.25 - quotaLever * 0.1;

  const roleDefs: Array<{ name: string; roleKey: string; baseline: string; standard: string; shiftFactor: number }> = [
    { name: 'Sales Executives (SEs)', roleKey: 'sales_executive', baseline: '15/85 - 25/75', standard: '30/70 - 40/60', shiftFactor: 0.8 },
    { name: 'Marketing Reps', roleKey: 'marketing_rep', baseline: '40/60', standard: '55/45 - 60/40', shiftFactor: 0.9 },
    { name: 'Sales Managers', roleKey: 'sales_manager', baseline: '30/70', standard: '30/70 - 70/30', shiftFactor: 1.0 },
    { name: 'Marketing Managers', roleKey: 'marketing_manager', baseline: '40/60', standard: '40/60 - 85/15', shiftFactor: 0.9 },
    { name: 'Director+', roleKey: 'marketing_director', baseline: '30/70 - 40/60', standard: '50/40 - 80/20', shiftFactor: 1.2 },
  ];

  const roles: IndustryPayMixRole[] = roleDefs.map((def) => ({
    name: def.name,
    roleKey: def.roleKey,
    baseline: def.baseline,
    standard: def.standard,
    mktBase: marketBase(rows, def.roleKey, 50),
    hgvBase: Math.round(hgvBase(rows, def.roleKey, 40) + shift * def.shiftFactor),
  }));

  return {
    dirGapBaseline,
    vpGapBaseline,
    dirGap: Math.max(0, dirGapBaseline - compImprovement),
    vpGap: Math.max(0, vpGapBaseline - compImprovement * 1.6),
    optimalCommission,
    noiWeightMarket,
    roles,
  };
}

export function formatIndustryBenchmarkContext(rows: Record<string, unknown>[]): string {
  const normalized = normalizeIndustryBenchmarkRows(rows);
  if (!normalized.length) return '## Industry Benchmarks\nNo rows in workspace.hgv_comp.industry_comp_benchmark.';
  return [
    '## Industry Compensation Benchmarks (Unity Catalog: industry_comp_benchmark)',
    JSON.stringify(normalized, null, 2),
  ].join('\n');
}

export function mapWarehouseTeamMarket(rows: Record<string, unknown>[]): TeamMarketPosition[] {
  return rows.map((row) => ({
    rep_id: String(row.rep_id ?? ''),
    rep_name: String(row.rep_name ?? ''),
    role: String(row.role_key ?? 'marketing_rep'),
    tcc_gap_vs_market_pct: n(row.tcc_gap_vs_market_pct),
    base_pct: n(row.base_pct),
    variable_pct: n(row.variable_pct),
    quota_attainment_pct: n(row.quota_attainment_pct),
  }));
}

export function getGapStatus(gap: number) {
  if (gap >= 25) return { color: 'text-rose-500 bg-rose-500/10', border: 'border-rose-500/20', label: 'Severe Gap' };
  if (gap >= 10) return { color: 'text-amber-500 bg-amber-500/10', border: 'border-amber-500/20', label: 'Moderate Gap' };
  if (gap > 2) return { color: 'text-yellow-500 bg-yellow-500/10', border: 'border-yellow-500/20', label: 'Minor Gap' };
  return { color: 'text-emerald-500 bg-emerald-500/10', border: 'border-emerald-500/20', label: 'Optimal Aligned' };
}
