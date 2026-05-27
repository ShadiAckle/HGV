/** Plan metric names — must match warehouse seed / bootstrap. */
export const MARKETING_METRIC_QUALIFIED_TOURS = 'Qualified Tours (Owner, New Buyer)';
export const MARKETING_METRIC_FPS = 'Individual FPS Packages';
export const MARKETING_METRIC_SALES = 'Individual Sales Transactions';

export interface MarketingEarningsParts {
  qualified_tour_pay: number;
  courtesy_tour_pay: number;
  penetration_spiff: number;
  chargebacks: number;
  total_payout: number;
}

export interface AlignedPlanMetricEarnings {
  qualifiedTours: number;
  fps: number;
  sales: number;
  grossTotal: number;
}

/** Map period earnings breakdown to the three plan-metric buckets (sums to QTD gross). */
export function derivePlanMetricEarnings(
  parts: MarketingEarningsParts,
  storedQtdEarnings: number,
): AlignedPlanMetricEarnings {
  const qualifiedTours = parts.qualified_tour_pay + parts.courtesy_tour_pay;
  const fps = parts.penetration_spiff;
  const breakdownGross = qualifiedTours + fps;
  const qtdGross =
    storedQtdEarnings >= breakdownGross ? storedQtdEarnings : breakdownGross;
  const sales = Math.max(0, qtdGross - qualifiedTours - fps);
  return {
    qualifiedTours,
    fps,
    sales,
    grossTotal: qualifiedTours + fps + sales,
  };
}

export function earningsForMetricName(
  metricName: string,
  aligned: AlignedPlanMetricEarnings,
): number | null {
  if (metricName === MARKETING_METRIC_QUALIFIED_TOURS) return aligned.qualifiedTours;
  if (metricName === MARKETING_METRIC_FPS) return aligned.fps;
  if (metricName === MARKETING_METRIC_SALES) return aligned.sales;
  return null;
}

/** Net statement payout after chargebacks (chargebacks are negative in warehouse). */
export function netStatementPayout(parts: MarketingEarningsParts, grossQtd: number): number {
  if (parts.chargebacks !== 0) {
    return Math.round((grossQtd + parts.chargebacks) * 100) / 100;
  }
  return parts.total_payout > 0 ? parts.total_payout : grossQtd;
}
