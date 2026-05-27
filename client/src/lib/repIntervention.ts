import type { TeamMarketPosition } from '@shared/compStandards';
import { formatCurrency, formatPercent } from '@/lib/compFormat';

export interface InterventionAgent {
  agent_name: string;
  rep_id?: string;
  level: string;
  quota_attainment_pct: number;
  ffs_sales_pct: number;
  total_earnings: number;
  performance_band?: string;
  tours_showed?: number;
  tour_close_rate_pct?: number;
}

interface InterventionOptions {
  useMarketingWorkspace: boolean;
  market?: TeamMarketPosition;
  openTours?: Array<{
    tour_id: string;
    rep_name: string;
    abc_score?: string;
    showed_flag?: boolean;
    closed_flag?: boolean;
    net_sales_volume?: number;
    lead_source?: string;
  }>;
}

function repMention(agent: InterventionAgent): string {
  return agent.rep_id ? `@rep:${agent.rep_id}` : agent.agent_name;
}

function attainmentGap(agent: InterventionAgent): number {
  return Math.max(0, Math.round(100 - agent.quota_attainment_pct));
}

export function buildInterventionContextBlock(
  agent: InterventionAgent,
  opts: InterventionOptions,
): string {
  const repTours = (opts.openTours ?? []).filter((t) => t.rep_name === agent.agent_name);
  return [
    '## ACTIVE INTERVENTION TARGET (answer for THIS rep only)',
    JSON.stringify(
      {
        rep_id: agent.rep_id,
        rep_name: agent.agent_name,
        level: agent.level,
        quota_attainment_pct: agent.quota_attainment_pct,
        performance_band: agent.performance_band,
        total_earnings: agent.total_earnings,
        ffs_sales_pct: agent.ffs_sales_pct,
        tours_showed: agent.tours_showed,
        tour_close_rate_pct: agent.tour_close_rate_pct,
        market_position: opts.market ?? null,
        open_tours: repTours,
      },
      null,
      2,
    ),
  ].join('\n');
}

export function buildInterventionCopilotPrompt(agent: InterventionAgent, opts: InterventionOptions): string {
  const mention = repMention(agent);
  const gap = attainmentGap(agent);
  const contextJson = JSON.stringify(
    {
      rep: agent,
      market: opts.market ?? null,
      open_tours: (opts.openTours ?? []).filter((t) => t.rep_name === agent.agent_name),
    },
    null,
    2,
  );

  if (opts.useMarketingWorkspace) {
    const tourLine =
      agent.tours_showed != null
        ? `${agent.tours_showed} tours showed${agent.tour_close_rate_pct != null ? `, ${agent.tour_close_rate_pct}% close rate` : ''}`
        : 'tour production on file';
    const marketLine = opts.market
      ? ` TCC vs market: ${opts.market.tcc_gap_vs_market_pct > 0 ? '+' : ''}${opts.market.tcc_gap_vs_market_pct}%.`
      : '';
    return [
      `Coaching intervention for ${mention} (${agent.agent_name}, ${agent.level}).`,
      `Current posture: ${formatPercent(agent.quota_attainment_pct)} quota attainment (${agent.performance_band ?? 'unknown band'}), ${tourLine}, ${formatCurrency(agent.total_earnings)} QTD earnings.${marketLine}`,
      '',
      'Rep snapshot:',
      contextJson,
      '',
      'Using ONLY the data above, produce a rep-specific coaching brief:',
      '1. Name their #1 metric gap (Qualified Tours, FPS, penetration, or show rate) tied to plan weights.',
      '2. List 2–3 concrete interventions — reference open tour_id values when present.',
      '3. Flag if they are both below quota AND below market pay mix (CRITICAL).',
      'Do not give generic team advice — this brief is for this rep only.',
    ].join('\n');
  }

  return [
    `Coaching intervention for ${mention} (${agent.agent_name}, ${agent.level}).`,
    `Current posture: ${formatPercent(agent.quota_attainment_pct)} quota (${agent.performance_band ?? 'unknown band'}), ${formatPercent(agent.ffs_sales_pct)} FFS mix, ${formatCurrency(agent.total_earnings)} QTD earnings.`,
    '',
    'Rep snapshot:',
    contextJson,
    '',
    'Using ONLY the data above, produce a rep-specific coaching brief:',
    `1. Explain why they are ${gap > 0 ? `${gap}pts below` : 'at/above'} the 100% quota line.`,
    '2. Recommend 2–3 deal-level actions to improve FFS mix and commission tier.',
    '3. Reference specific performance_band and earnings figures from the snapshot.',
    'Do not give generic team advice — this brief is for this rep only.',
  ].join('\n');
}

export function buildInterventionGapSummary(agent: InterventionAgent, opts: InterventionOptions): string {
  const att = agent.quota_attainment_pct;
  const gap = attainmentGap(agent);

  if (opts.useMarketingWorkspace) {
    if (att >= 100) {
      return `${agent.agent_name} is at ${formatPercent(att)} quota with ${agent.tours_showed ?? '—'} tours showed — leverage as a peer coach while pushing FPS conversion on open A-leads.`;
    }
    if (att < 70) {
      const marketNote =
        opts.market && opts.market.tcc_gap_vs_market_pct <= -10
          ? ` Pay is ${Math.abs(opts.market.tcc_gap_vs_market_pct)}% below market — combined quota and comp risk.`
          : '';
      return `${agent.agent_name} is ${gap}pts below the 70% intervention threshold at ${formatPercent(att)} quota.${marketNote} Priority: show-rate recovery and qualified tour volume before period close.`;
    }
    const closeNote =
      agent.tour_close_rate_pct != null && agent.tour_close_rate_pct < 25
        ? ` Close rate is ${agent.tour_close_rate_pct}% — focus ride-alongs on open tours.`
        : '';
    return `${agent.agent_name} is pacing at ${formatPercent(att)} (${gap}pts to plan).${closeNote}`;
  }

  if (att >= 100) {
    return `${agent.agent_name} is at ${formatPercent(att)} quota with ${formatPercent(agent.ffs_sales_pct)} FFS mix — stretch toward accelerator tiers and higher-margin package mix.`;
  }
  if (att < 70) {
    return `${agent.agent_name} is ${gap}pts below the 70% threshold (${formatPercent(att)} quota, ${formatPercent(agent.ffs_sales_pct)} FFS). Inventory mismatch and compressed entry tiers are likely dragging commission rate.`;
  }
  return `${agent.agent_name} is ${gap}pts from plan at ${formatPercent(att)} quota. FFS mix at ${formatPercent(agent.ffs_sales_pct)} vs target — coaching should target package upgrade path and deal credit recovery.`;
}

export function buildInterventionDirective(agent: InterventionAgent, opts: InterventionOptions): string {
  const repTours = (opts.openTours ?? []).filter((t) => t.rep_name === agent.agent_name && !t.closed_flag);
  const topTour = repTours.sort((a, b) => (b.net_sales_volume ?? 0) - (a.net_sales_volume ?? 0))[0];

  if (opts.useMarketingWorkspace) {
    if (topTour) {
      return `Ride with ${agent.agent_name} on tour ${topTour.tour_id} (${topTour.abc_score ?? '—'}-lead, ${topTour.lead_source ?? 'direct'}). Goal: convert to qualified show + FPS package — each conversion moves LM Tours and Individual FPS metric weights.`;
    }
    if (agent.quota_attainment_pct < 70) {
      return `Daily stand-up with ${agent.agent_name}: review show-rate blockers and reassign desk coverage for Owner/NB arrivals. Target +2 qualified tours this week to exit AT_RISK band.`;
    }
    return `Pair ${agent.agent_name} with top closer for penetration SPIFF window — focus Owner arrivals and courtesy-to-qualified conversion at ${agent.tours_showed ?? 0} tours showed QTD.`;
  }

  if (topTour) {
    return `Co-sell tour ${topTour.tour_id} with ${agent.agent_name} — push FFS-eligible upgrade path; target closes ${formatCurrency(topTour.net_sales_volume ?? 0)} NSV toward quota gap.`;
  }
  if (agent.ffs_sales_pct < 20) {
    return `Transition ${agent.agent_name} away from low-margin Preview packages toward FFS-eligible inventory — current mix ${formatPercent(agent.ffs_sales_pct)} is below team target. Use governed upgrade split on next sit-down.`;
  }
  return `Focus ${agent.agent_name} on deal credit recovery and Waikikian-style upgrade splits — ${attainmentGap(agent)}pts to 100% quota at ${formatCurrency(agent.total_earnings)} QTD earnings.`;
}

export function buildTakeoverAdvisorPrompt(
  agent: InterventionAgent,
  takeoverDiscount: number,
  quotaShieldActive: boolean,
  opts: InterventionOptions,
  quotaReliefPct = 10,
): string {
  const base = buildInterventionCopilotPrompt(agent, opts);
  const recorded: string[] = [];
  if (takeoverDiscount > 0) {
    recorded.push(`Co-sell pricing authorization recorded in fact_comp_admin_log (up to ${takeoverDiscount}% exception).`);
  }
  if (quotaShieldActive) {
    recorded.push(`Quota relief ${quotaReliefPct}% recorded in fact_manager_intervention — effective attainment updated in leaderboard queries.`);
  }
  return [
    base,
    '',
    recorded.length ? `Warehouse actions just recorded:\n- ${recorded.join('\n- ')}` : '',
    recorded.length
      ? 'Summarize what changed on the rep statement path and the next coaching steps.'
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export function gapAnalysisPanelStyle(attainmentPct: number): {
  background: string;
  border: string;
  color: string;
  title: string;
  icon: 'success' | 'warning' | 'danger';
} {
  if (attainmentPct >= 100) {
    return {
      background: 'rgba(16, 185, 129, 0.08)',
      border: '1px solid rgba(16, 185, 129, 0.25)',
      color: '#6ee7b7',
      title: 'Stretch Coaching Insight',
      icon: 'success',
    };
  }
  if (attainmentPct < 70) {
    return {
      background: 'rgba(239, 68, 68, 0.08)',
      border: '1px solid rgba(239, 68, 68, 0.25)',
      color: '#fca5a5',
      title: 'Performance Gap Analysis',
      icon: 'danger',
    };
  }
  return {
    background: 'rgba(245, 158, 11, 0.08)',
    border: '1px solid rgba(245, 158, 11, 0.25)',
    color: '#fcd34d',
    title: 'Coaching Focus',
    icon: 'warning',
  };
}
