import { assessPayMix, getPayMixForRole } from './compStandards.js';

export type CompImpactStatus = 'aligned' | 'at_risk' | 'gap' | 'info';

export interface CompImpactLine {
  areaId: 1 | 2 | 3 | 4;
  areaHeadline: string;
  badge: string;
  status: CompImpactStatus;
  statementImpact: string;
  detail: string;
  marketAlignedPreview?: string;
}

export interface MarketingRepImpactInput {
  qtdEarnings: number;
  paidToDate: number;
  basePct: number;
  variablePct: number;
  tccGapPct: number;
  totalPayout: number;
  nextTierLabel: string;
  nextTierGapTours: number;
  assignedArea: string;
  planMetricOpportunityUsd: number;
  projectedArrivalUsd: number;
}

export interface SalesRepImpactInput {
  currentEarnings: number;
  paidToDate: number;
  quotaAttainmentPct: number;
  creditedAmount: number;
  quotaAmount: number;
  nextTierThresholdPct: number;
  nextTierGapAmount: number;
  dealsClosedCount: number;
  basePay: number;
  commission: number;
  bonus: number;
  totalEarnings: number;
}

export interface ManagerImpactInput {
  roleKey: string;
  blendedPayoutPct: number | null;
  teamAttainmentPct: number;
  atRiskCount: number;
  metricAttainment: Array<{
    metric: string;
    weight_pct: number;
    attainment_pct: number;
    payout_pct: number;
  }>;
}

function benchmarkFactsHeader(): string {
  return '## Benchmark Impact Facts (synthesize personalized impact — do not emit boilerplate)';
}

export function formatMarketingBenchmarkFacts(input: MarketingRepImpactInput): string {
  const std = getPayMixForRole('marketing_rep');
  const payMix = assessPayMix('marketing_rep', input.basePct);
  const marketTcc =
    input.tccGapPct < 0 && input.tccGapPct > -100
      ? input.qtdEarnings / (1 + input.tccGapPct / 100)
      : input.qtdEarnings;
  const tccGapUsd = Math.max(0, marketTcc - input.qtdEarnings);

  return [
    benchmarkFactsHeader(),
    JSON.stringify(
      {
        qtd_earnings: input.qtdEarnings,
        paid_to_date: input.paidToDate,
        total_payout: input.totalPayout,
        tcc_gap_vs_market_pct: input.tccGapPct,
        market_equivalent_tcc: Math.round(marketTcc),
        tcc_gap_usd_qtd: Math.round(tccGapUsd),
        pay_mix: { base_pct: input.basePct, variable_pct: input.variablePct },
        market_pay_mix: { base_pct: std.marketBasePct, variable_pct: std.marketVariablePct },
        pay_mix_assessment: { aligned: payMix.aligned, inverted: payMix.inverted, gap_pct: payMix.gapPct },
        next_tier_label: input.nextTierLabel,
        next_tier_gap_tours: input.nextTierGapTours,
        plan_metric_opportunity_usd: input.planMetricOpportunityUsd,
        projected_arrival_usd: input.projectedArrivalUsd,
        assigned_area: input.assignedArea,
      },
      null,
      2,
    ),
  ].join('\n');
}

export function formatSalesBenchmarkFacts(input: SalesRepImpactInput): string {
  const std = getPayMixForRole('sales_executive');
  const basePct = input.totalEarnings > 0 ? Math.round((input.basePay / input.totalEarnings) * 100) : 0;
  const variablePct = Math.max(0, 100 - basePct);
  const payMix = assessPayMix('sales_executive', basePct);

  return [
    benchmarkFactsHeader(),
    JSON.stringify(
      {
        current_earnings: input.currentEarnings,
        paid_to_date: input.paidToDate,
        quota_attainment_pct: input.quotaAttainmentPct,
        credited_amount: input.creditedAmount,
        quota_amount: input.quotaAmount,
        next_tier_threshold_pct: input.nextTierThresholdPct,
        next_tier_gap_amount: input.nextTierGapAmount,
        deals_closed_count: input.dealsClosedCount,
        earnings_breakdown: {
          base_pay: input.basePay,
          commission: input.commission,
          bonus: input.bonus,
          total_earnings: input.totalEarnings,
        },
        derived_pay_mix: { base_pct: basePct, variable_pct: variablePct },
        market_pay_mix: { base_pct: std.marketBasePct, variable_pct: std.marketVariablePct },
        pay_mix_assessment: { aligned: payMix.aligned, inverted: payMix.inverted, gap_pct: payMix.gapPct },
      },
      null,
      2,
    ),
  ].join('\n');
}

export function formatManagerBenchmarkFacts(input: ManagerImpactInput): string {
  const std = getPayMixForRole(input.roleKey);

  return [
    benchmarkFactsHeader(),
    JSON.stringify(
      {
        role_key: input.roleKey,
        blended_payout_pct: input.blendedPayoutPct,
        team_attainment_pct: input.teamAttainmentPct,
        at_risk_report_count: input.atRiskCount,
        metric_attainment: input.metricAttainment,
        market_pay_mix: { base_pct: std.marketBasePct, variable_pct: std.marketVariablePct },
      },
      null,
      2,
    ),
  ].join('\n');
}
