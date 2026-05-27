/**
 * Scenario financial projection — shared by server POST /api/comp/scenarios and client previews.
 */
export interface ScenarioProjection {
  projected_payouts: number;
  budget_impact: number;
  projected_cost: number;
  expected_performance_pct: number;
}

export function projectScenario(
  quotaChangePct: number,
  commissionRatePct: number,
  bonusRateChangePct: number,
  acceleratorChangePct: number,
  tourVolumeChangePct = 0,
  conversionRateChangePct = 0,
  basePayouts = 14_200_000,
): ScenarioProjection {
  const baseCommission = 6.0;
  const commissionMultiplier = commissionRatePct / baseCommission;
  const quotaEffect = 1 + (quotaChangePct / 100) * 0.6;
  const bonusEffect = 1 + (bonusRateChangePct / 100) * 0.25;
  const accelEffect = 1 + (acceleratorChangePct / 100) * 0.15;
  const tourEffect = 1 + (tourVolumeChangePct / 100) * 0.35;
  const conversionEffect = 1 + (conversionRateChangePct / 100) * 0.28;

  const projectedPayouts =
    basePayouts * commissionMultiplier * quotaEffect * bonusEffect * accelEffect * tourEffect * conversionEffect;
  const budgetImpact = projectedPayouts - basePayouts;
  const expectedPerf = Math.min(
    100,
    82 *
      (1 +
        (quotaChangePct / 100) * 0.4 +
        (acceleratorChangePct / 100) * 0.1 +
        (tourVolumeChangePct / 100) * 0.25 +
        (conversionRateChangePct / 100) * 0.22 +
        ((commissionRatePct - baseCommission) / baseCommission) * 0.2),
  );

  return {
    projected_payouts: Math.round(projectedPayouts),
    budget_impact: Math.round(budgetImpact),
    projected_cost: Math.round(projectedPayouts),
    expected_performance_pct: Math.round(expectedPerf * 10) / 10,
  };
}

/** Team-scoped attainment projection from current team baseline (not org-wide 82%). */
export function projectTeamAttainment(
  baselineAttainmentPct: number,
  quotaChangePct: number,
  commissionRatePct: number,
  bonusRateChangePct: number,
  acceleratorChangePct: number,
  tourVolumeChangePct = 0,
  conversionRateChangePct = 0,
): number {
  const baseCommission = 6.0;
  const relativeBoost =
    (quotaChangePct / 100) * 0.4 +
    (acceleratorChangePct / 100) * 0.1 +
    (tourVolumeChangePct / 100) * 0.25 +
    (conversionRateChangePct / 100) * 0.22 +
    ((commissionRatePct - baseCommission) / baseCommission) * 0.2 +
    (bonusRateChangePct / 100) * 0.08;

  return Math.round(Math.min(130, baselineAttainmentPct * (1 + relativeBoost)) * 10) / 10;
}
