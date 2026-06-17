/** Money Map — simple comp-first metrics for marketing rep Simple View. */

export type TourImpactTier = 'green' | 'amber' | 'red';

export interface TourImpactChip {
  tour_id: string;
  tier: TourImpactTier;
  paid_label: string;
  upside_label?: string;
  reason?: string;
  comp_impact_line: string;
}

export interface MarketingPlanProgressRow {
  metric_key: string;
  label: string;
  weight_pct: number;
  attainment_pct: number;
  earnings: number;
  opportunity_usd: number;
  caption: string;
}

export interface MarketingArrivalsPipeline {
  arrival_count: number;
  projected_total_usd: number;
  if_all_show_qualify_usd: number;
  best_action: string;
}

export interface MarketingDeskRank {
  team_size: number;
  qualified_rate_rank: number;
  penetration_rank: number;
  desk_qualified_rate_avg: number;
  desk_penetration_avg: number;
  your_qualified_rate_pct: number;
  your_penetration_pct: number;
}

export interface MarketingMoneyMap {
  show_rate_pct: number;
  qualified_rate_pct: number;
  guest_buy_rate_pct: number;
  guest_buy_target_pct: number;
  recovery_usd: number;
  fps_leakage_usd: number;
  recovery_tour_count: number;
  fps_open_tour_count: number;
  abc_mix: Record<string, number>;
  abc_mix_summary: string;
  arrivals_pipeline: MarketingArrivalsPipeline;
  plan_progress: MarketingPlanProgressRow[];
  desk_rank: MarketingDeskRank | null;
  tour_chips: TourImpactChip[];
}

const fmtUSD = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

function planMetricLabel(metricName: string): string {
  if (metricName.includes('Qualified Tour')) return 'Qualified tours (Owner / NB)';
  if (metricName.includes('FPS')) return 'FPS packages (guest buy rate)';
  if (metricName.includes('Sales Transaction')) return 'Sales transactions';
  return metricName;
}

function planMetricKey(metricName: string): string {
  if (metricName.includes('Qualified Tour')) return 'qualified_tours';
  if (metricName.includes('FPS')) return 'fps_packages';
  if (metricName.includes('Sales Transaction')) return 'sales_transactions';
  return metricName.toLowerCase().replace(/\s+/g, '_');
}

export function computeTourImpactChip(tour: Record<string, unknown>): TourImpactChip {
  const tourId = String(tour.tour_id ?? '');
  // Normalize Cognos status: 'No Show' → 'NO SHOW', 'Show' → 'SHOW'
  const status = String(tour.tour_status ?? '').toUpperCase().replace(/[-_]/g, ' ').trim();
  const payout = Number(tour.payout ?? 0);
  const fpsPotential = Number(tour.fps_potential ?? 0);
  const guestType = String(tour.guest_type ?? '');
  const code = String(tour.code ?? '').toUpperCase();
  const notes = String(tour.notes ?? '');
  // Use guest_name if available; fall back to guest_type (Owner/New Buyer) so AI context is meaningful
  const guestName = String(tour.guest_name ?? tour.guest_type ?? 'Guest');
  const notesLower = notes.toLowerCase();
  const isNoShow = status === 'NO SHOW' || status === 'NO_SHOW' || status === 'NOSHOW';

  if (isNoShow) {
    const lost = payout + fpsPotential;
    const upside = lost > 0 ? `${fmtUSD(lost)} lost if rebooked` : undefined;
    const reason = notes || 'No-show — rebook to recover qualified + FPS pay';
    return {
      tour_id: tourId,
      tier: 'red',
      paid_label: '$0',
      upside_label: upside,
      reason,
      comp_impact_line: `This tour paid $0. ${guestName} no-show left ${fmtUSD(lost)} on the table${fpsPotential > 0 ? ` (includes ${fmtUSD(fpsPotential)} FPS)` : ''}.`,
    };
  }

  const isCourtesy =
    code.includes('NQ') ||
    guestType === 'Non-Owner' ||
    notesLower.includes('courtesy') ||
    notesLower.includes('non-qualified') ||
    notesLower.includes('below threshold');

  if (isCourtesy) {
    const reason = notes || 'Courtesy / non-qualified guest type';
    return {
      tour_id: tourId,
      tier: 'amber',
      paid_label: `+${fmtUSD(payout)} courtesy`,
      reason,
      comp_impact_line: `This tour paid ${fmtUSD(payout)} at courtesy rate — ${reason.replace(/\.$/, '')}.`,
    };
  }

  const fpsOpen = fpsPotential > 0 && (notesLower.includes('fps not') || notesLower.includes('not yet sold') || code === 'Q');
  const upside = fpsOpen ? `${fmtUSD(fpsPotential)} FPS open` : fpsPotential > 0 ? `${fmtUSD(fpsPotential)} FPS pot.` : undefined;
  const reason = fpsOpen ? 'FPS package not yet sold' : undefined;
  return {
    tour_id: tourId,
    tier: 'green',
    paid_label: `+${fmtUSD(payout)} qualified`,
    upside_label: upside,
    reason,
    comp_impact_line: fpsOpen
      ? `This tour paid ${fmtUSD(payout)} as qualified ${guestType}. You have ${fmtUSD(fpsPotential)} FPS upside if the package sells before departure.`
      : `This tour paid ${fmtUSD(payout)} as qualified ${guestType}.`,
  };
}

export interface BuildMoneyMapInput {
  rep_id: string;
  kpis: {
    tours_shown: number;
    qualified_tours: number;
    show_rate_pct: number;
    penetration_pct: number;
    penetration_target_pct: number;
    next_tier_gap_tours: number;
  };
  plan_metrics: Array<{
    metric: string;
    weight_pct: number;
    earnings: number;
    attainment_pct: number;
    target_label: string;
    opportunity_usd: number | null;
  }>;
  tours: Array<Record<string, unknown>>;
  upcoming_arrivals: Array<Record<string, unknown>>;
  desk_rank?: MarketingDeskRank | null;
}

export function buildMarketingMoneyMap(input: BuildMoneyMapInput): MarketingMoneyMap {
  const { kpis, plan_metrics, tours, upcoming_arrivals } = input;
  const tourChips = tours.map(computeTourImpactChip);

  let recoveryUsd = 0;
  let recoveryCount = 0;
  let fpsLeakage = 0;
  let fpsOpenCount = 0;

  for (const tour of tours) {
    // Normalize Cognos status values: 'No Show' → 'NO SHOW', 'Show' → 'SHOW', etc.
    const status = String(tour.tour_status ?? '').toUpperCase().replace(/[-_]/g, ' ').trim();
    const payout = Number(tour.payout ?? 0);
    const fps = Number(tour.fps_potential ?? 0);
    const isNoShow = status === 'NO SHOW' || status === 'NO_SHOW' || status === 'NOSHOW';
    const isShown = status === 'SHOW' || status === 'SHOWN' || status === 'TOUR';
    if (isNoShow) {
      recoveryUsd += payout + fps;
      recoveryCount += 1;
    }
    if (isShown && fps > 0) {
      const notes = String(tour.notes ?? '').toLowerCase();
      const code = String(tour.code ?? '').toUpperCase();
      if (code === 'Q' || notes.includes('fps not') || notes.includes('not yet sold') || fps > 0) {
        fpsLeakage += fps;
        fpsOpenCount += 1;
      }
    }
  }

  const abcMix: Record<string, number> = {};
  for (const tour of tours) {
    const abc = String(tour.abc_score ?? '').trim();
    if (abc) abcMix[abc] = (abcMix[abc] ?? 0) + 1;
  }
  const abcMixSummary =
    Object.keys(abcMix).length > 0
      ? Object.entries(abcMix)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => `${v} ${k}-lead${v > 1 ? 's' : ''}`)
          .join(', ')
      : 'No ABC scores on file';

  const projectedTotal = upcoming_arrivals.reduce((s, a) => s + Number(a.projected_total_payout ?? 0), 0);
  const ifAllQualify = upcoming_arrivals.reduce(
    (s, a) => s + Number(a.potential_qualified_tour ?? 0) + Number(a.potential_fps_payout ?? 0),
    0,
  );

  let bestAction = 'No upcoming arrivals on calendar.';
  if (upcoming_arrivals.length > 0) {
    const sorted = [...upcoming_arrivals].sort(
      (a, b) => Number(b.projected_total_payout ?? 0) - Number(a.projected_total_payout ?? 0),
    );
    const top = sorted[0];
    const name = String(top.guest_name ?? 'Guest');
    const arrivalId = String(top.arrival_id ?? '');
    const total = Number(top.projected_total_payout ?? 0);
    bestAction = `Focus ${name}${arrivalId ? ` (${arrivalId})` : ''} — up to ${fmtUSD(total)} if they show & qualify.`;
  }

  const qualifiedRate =
    kpis.tours_shown > 0 ? Math.round((kpis.qualified_tours / kpis.tours_shown) * 1000) / 10 : 0;

  const planProgress: MarketingPlanProgressRow[] = plan_metrics.map((m) => {
    const key = planMetricKey(m.metric);
    const label = planMetricLabel(m.metric);
    const opp = m.opportunity_usd ?? 0;
    let caption = m.target_label;
    if (key === 'qualified_tours' && kpis.next_tier_gap_tours > 0 && opp > 0) {
      caption = `${kpis.next_tier_gap_tours} more qualified tours ≈ ${fmtUSD(opp)} toward next tier`;
    } else if (key === 'fps_packages' && opp > 0) {
      caption = `${fmtUSD(opp)} FPS plan gap at current penetration`;
    } else if (key === 'sales_transactions' && opp > 0) {
      caption = `${fmtUSD(opp)} if next downstream close credits`;
    }
    return {
      metric_key: key,
      label,
      weight_pct: m.weight_pct,
      attainment_pct: m.attainment_pct,
      earnings: m.earnings,
      opportunity_usd: opp,
      caption,
    };
  });

  return {
    show_rate_pct: kpis.show_rate_pct,
    qualified_rate_pct: qualifiedRate,
    guest_buy_rate_pct: kpis.penetration_pct,
    guest_buy_target_pct: kpis.penetration_target_pct,
    recovery_usd: recoveryUsd,
    fps_leakage_usd: fpsLeakage,
    recovery_tour_count: recoveryCount,
    fps_open_tour_count: fpsOpenCount,
    abc_mix: abcMix,
    abc_mix_summary: abcMixSummary,
    arrivals_pipeline: {
      arrival_count: upcoming_arrivals.length,
      projected_total_usd: projectedTotal,
      if_all_show_qualify_usd: ifAllQualify,
      best_action: bestAction,
    },
    plan_progress: planProgress,
    desk_rank: input.desk_rank ?? null,
    tour_chips: tourChips,
  };
}

export function tourChipForId(moneyMap: MarketingMoneyMap | null | undefined, tourId: string): TourImpactChip | undefined {
  return moneyMap?.tour_chips.find((c) => c.tour_id === tourId);
}
