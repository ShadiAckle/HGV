/**
 * Scenario modeler levers — absolute units in the UI, pct columns in scenario_run.
 * Baselines are planning assumptions documented in slider help text.
 */
export const SCENARIO_QUOTA_BASELINE_USD = 1_000_000;
export const SCENARIO_TOUR_BASELINE = 2_000;

export const QUOTA_SLIDER = { min: -200_000, max: 300_000, step: 50_000 } as const;
export const TOUR_SLIDER = { min: -600, max: 1_000, step: 100 } as const;

export function quotaPctFromDeltaUsd(deltaUsd: number): number {
  return Math.round((deltaUsd / SCENARIO_QUOTA_BASELINE_USD) * 1000) / 10;
}

export function quotaDeltaUsdFromPct(pct: number): number {
  const raw = (pct / 100) * SCENARIO_QUOTA_BASELINE_USD;
  return snapToStep(raw, QUOTA_SLIDER.step, QUOTA_SLIDER.min, QUOTA_SLIDER.max);
}

export function tourPctFromDelta(deltaTours: number): number {
  return Math.round((deltaTours / SCENARIO_TOUR_BASELINE) * 1000) / 10;
}

export function tourDeltaFromPct(pct: number): number {
  const raw = (pct / 100) * SCENARIO_TOUR_BASELINE;
  return snapToStep(raw, TOUR_SLIDER.step, TOUR_SLIDER.min, TOUR_SLIDER.max);
}

function snapToStep(raw: number, step: number, min: number, max: number): number {
  const snapped = Math.round(raw / step) * step;
  return Math.min(max, Math.max(min, snapped));
}

export function formatQuotaDelta(deltaUsd: number): string {
  if (deltaUsd === 0) return '$0';
  const sign = deltaUsd > 0 ? '+' : '-';
  const abs = Math.abs(deltaUsd);
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  return `${sign}$${Math.round(abs / 1_000)}K`;
}

export function formatTourDelta(deltaTours: number): string {
  if (deltaTours === 0) return '0 tours';
  const sign = deltaTours > 0 ? '+' : '';
  return `${sign}${deltaTours.toLocaleString()} tours`;
}

export function formatCommissionRate(rate: number): string {
  return `${rate}%`;
}
