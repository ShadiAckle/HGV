import { CURRENT_PERIOD_ID } from './compPeriods.js';

/** Governed Slide 16 benchmark rows — used when warehouse read fails or bootstrap is still running. */
export const INDUSTRY_BENCHMARK_CATALOG: Record<string, unknown>[] = [
  { benchmark_id: 'BMK-S16-A1-DIR', role_key: 'marketing_director', role_label: 'Directors / Sr. Directors', metric_code: 'TCC_GAP_PCT', market_value: 17, hgv_typical_value: 17, unit: '%', benchmark_source: 'Slide 16 Area 1', effective_period: CURRENT_PERIOD_ID, notes: 'Directors 10-17% below market target TCC' },
  { benchmark_id: 'BMK-S16-A1-VP', role_key: 'sales_vp', role_label: 'Sales VPs', metric_code: 'TCC_GAP_PCT', market_value: 43, hgv_typical_value: 43, unit: '%', benchmark_source: 'Slide 16 Area 1', effective_period: CURRENT_PERIOD_ID, notes: 'Sales VPs 14-43% below market target TCC' },
  { benchmark_id: 'BMK-PM-MKT-REP-B', role_key: 'marketing_rep', role_label: 'Marketing Reps', metric_code: 'PAY_MIX_BASE', market_value: 60, hgv_typical_value: 40, unit: '%', benchmark_source: 'Slide 16 Area 2', effective_period: CURRENT_PERIOD_ID, notes: 'Market standard base/variable' },
  { benchmark_id: 'BMK-PM-MKT-REP-V', role_key: 'marketing_rep', role_label: 'Marketing Reps', metric_code: 'PAY_MIX_VAR', market_value: 40, hgv_typical_value: 60, unit: '%', benchmark_source: 'Slide 16 Area 2', effective_period: CURRENT_PERIOD_ID, notes: 'Market standard base/variable' },
  { benchmark_id: 'BMK-PM-SE-B', role_key: 'sales_executive', role_label: 'Sales Executives', metric_code: 'PAY_MIX_BASE', market_value: 35, hgv_typical_value: 20, unit: '%', benchmark_source: 'Slide 16 Area 2', effective_period: CURRENT_PERIOD_ID, notes: 'Market 30/70 - 40/60' },
  { benchmark_id: 'BMK-PM-SM-B', role_key: 'sales_manager', role_label: 'Sales Managers', metric_code: 'PAY_MIX_BASE', market_value: 50, hgv_typical_value: 30, unit: '%', benchmark_source: 'Slide 16 Area 2', effective_period: CURRENT_PERIOD_ID, notes: 'Market 30/70 - 70/30' },
  { benchmark_id: 'BMK-PM-MGR-B', role_key: 'marketing_manager', role_label: 'Marketing Managers', metric_code: 'PAY_MIX_BASE', market_value: 62.5, hgv_typical_value: 40, unit: '%', benchmark_source: 'Slide 16 Area 2', effective_period: CURRENT_PERIOD_ID, notes: 'Market 40/60 - 85/15' },
  { benchmark_id: 'BMK-PM-DIR-B', role_key: 'marketing_director', role_label: 'Director+', metric_code: 'PAY_MIX_BASE', market_value: 65, hgv_typical_value: 35, unit: '%', benchmark_source: 'Slide 16 Area 2', effective_period: CURRENT_PERIOD_ID, notes: 'Market 50/40 - 80/20' },
  { benchmark_id: 'BMK-COMM-OPT', role_key: 'all', role_label: 'All Sales Roles', metric_code: 'COMMISSION_RATE', market_value: 6, hgv_typical_value: 6, unit: '%', benchmark_source: 'Slide 16 Area 3', effective_period: CURRENT_PERIOD_ID, notes: 'Optimal commission band 4-6%' },
  { benchmark_id: 'BMK-NOI-W', role_key: 'marketing_director', role_label: 'Director+', metric_code: 'NOI_WEIGHT', market_value: 65, hgv_typical_value: 35, unit: '%', benchmark_source: 'Slide 16 Area 4', effective_period: CURRENT_PERIOD_ID, notes: 'Market-aligned NOI weight 50-80%' },
];

export function filterIndustryBenchmarkCatalog(
  periodId: string,
  roleKey?: string,
): Record<string, unknown>[] {
  return INDUSTRY_BENCHMARK_CATALOG.filter((row) => {
    if (String(row.effective_period) !== periodId) return false;
    if (roleKey && String(row.role_key) !== roleKey) return false;
    return true;
  });
}
