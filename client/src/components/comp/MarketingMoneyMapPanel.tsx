import { DollarSign, RotateCcw, TrendingUp, CalendarClock } from 'lucide-react';
import type { ReactNode } from 'react';
import { formatCurrency, formatPercent } from '@/lib/compFormat';
import type { MarketingMoneyMap } from '@shared/marketingMoneyMap';

interface MarketingMoneyMapSummaryProps {
  moneyMap: MarketingMoneyMap;
}

export function MarketingMoneyMapSummary({ moneyMap }: MarketingMoneyMapSummaryProps) {
  const { arrivals_pipeline, recovery_usd, fps_leakage_usd, recovery_tour_count, fps_open_tour_count, abc_mix_summary } =
    moneyMap;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <MoneyCard
        icon={<CalendarClock size={14} className="text-primary" />}
        label="Calendar pipeline"
        value={formatCurrency(arrivals_pipeline.projected_total_usd)}
        caption={`${arrivals_pipeline.arrival_count} arrival${arrivals_pipeline.arrival_count === 1 ? '' : 's'} on deck`}
        accent="primary"
      />
      <MoneyCard
        icon={<RotateCcw size={14} className="text-rose-500" />}
        label="Recovery opportunity"
        value={formatCurrency(recovery_usd)}
        caption={recovery_tour_count > 0 ? `${recovery_tour_count} no-show${recovery_tour_count > 1 ? 's' : ''} to rebook` : 'No no-shows this period'}
        accent="rose"
      />
      <MoneyCard
        icon={<TrendingUp size={14} className="text-[var(--gold)]" />}
        label="FPS on the table"
        value={formatCurrency(fps_leakage_usd)}
        caption={fps_open_tour_count > 0 ? `${fps_open_tour_count} qualified tour${fps_open_tour_count > 1 ? 's' : ''} unsold` : 'FPS packages current'}
        accent="gold"
      />
      <MoneyCard
        icon={<DollarSign size={14} className="text-emerald-500" />}
        label="If all arrivals qualify"
        value={formatCurrency(arrivals_pipeline.if_all_show_qualify_usd)}
        caption={abc_mix_summary}
        accent="emerald"
      />
      {arrivals_pipeline.best_action && arrivals_pipeline.arrival_count > 0 && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 md:col-span-2 lg:col-span-4">
          <div className="text-[10px] font-bold uppercase tracking-wider text-primary">Best next action</div>
          <p className="mt-1 text-sm font-semibold text-foreground">{arrivals_pipeline.best_action}</p>
        </div>
      )}
    </div>
  );
}

function MoneyCard({
  icon,
  label,
  value,
  caption,
  accent,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  caption: string;
  accent: 'primary' | 'rose' | 'gold' | 'emerald';
}) {
  const border =
    accent === 'rose'
      ? 'border-rose-500/20'
      : accent === 'gold'
        ? 'border-[var(--gold)]/25'
        : accent === 'emerald'
          ? 'border-emerald-500/20'
          : 'border-primary/20';
  return (
    <div className={`glass-card rounded-xl border p-4 ${border}`}>
      <div className="mb-2 flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-xl font-extrabold tracking-tight text-foreground">{value}</div>
      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{caption}</p>
    </div>
  );
}

interface MarketingPlanProgressBarsProps {
  moneyMap: MarketingMoneyMap;
}

export function MarketingPlanProgressBars({ moneyMap }: MarketingPlanProgressBarsProps) {
  return (
    <div className="glass-card space-y-4 p-6">
      <div>
        <h3 className="text-sm font-bold uppercase tracking-wider">Plan earnings drivers</h3>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Three weights from your plan — progress bar shows attainment; caption shows $ still available.
        </p>
      </div>
      <div className="space-y-4">
        {moneyMap.plan_progress.map((row) => (
          <PlanProgressRow key={row.metric_key} row={row} />
        ))}
      </div>
    </div>
  );
}

function PlanProgressRow({ row }: { row: MarketingMoneyMap['plan_progress'][0] }) {
  const pct = Math.min(100, Math.max(0, row.attainment_pct));
  const barColor =
    pct >= 100 ? '#22C55E' : pct >= 67 ? '#F59E0B' : pct > 0 ? '#EF4444' : 'var(--foreground-muted)';

  return (
    <div className="rounded-xl border border-border/15 bg-muted/10 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="text-xs font-bold text-foreground">{row.label}</span>
          <span className="ml-2 text-[10px] text-muted-foreground">({row.weight_pct}% weight)</span>
        </div>
        <span className="text-xs font-bold" style={{ color: barColor }}>
          {formatPercent(row.attainment_pct)} · {formatCurrency(row.earnings)} earned
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--bg-elevated)]">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: barColor }} />
      </div>
      <div className="mt-2 flex flex-wrap justify-between gap-2 text-[11px] text-muted-foreground">
        <span>{row.caption}</span>
        {row.opportunity_usd > 0 && (
          <span className="font-bold text-[var(--gold-light)]">+{formatCurrency(row.opportunity_usd)} opportunity</span>
        )}
      </div>
    </div>
  );
}

interface MarketingDeskRankCardProps {
  moneyMap: MarketingMoneyMap;
  assignedArea: string;
}

export function MarketingDeskRankCard({ moneyMap, assignedArea }: MarketingDeskRankCardProps) {
  const rank = moneyMap.desk_rank;
  if (!rank || rank.team_size < 2) return null;

  const qualBeatDesk = rank.your_qualified_rate_pct >= rank.desk_qualified_rate_avg;
  const penBeatDesk = rank.your_penetration_pct >= rank.desk_penetration_avg;

  return (
    <div className="glass-card p-6">
      <h3 className="text-sm font-bold uppercase tracking-wider">Desk rank — {assignedArea}</h3>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Compared to {rank.team_size} marketing reps on your team this quarter (comp metrics only — not TCC).
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <RankTile
          label="Qualified rate"
          rank={rank.qualified_rate_rank}
          teamSize={rank.team_size}
          yours={formatPercent(rank.your_qualified_rate_pct)}
          deskAvg={formatPercent(rank.desk_qualified_rate_avg)}
          ahead={qualBeatDesk}
        />
        <RankTile
          label="Guest buy rate"
          rank={rank.penetration_rank}
          teamSize={rank.team_size}
          yours={formatPercent(rank.your_penetration_pct)}
          deskAvg={formatPercent(rank.desk_penetration_avg)}
          ahead={penBeatDesk}
        />
      </div>
    </div>
  );
}

function RankTile({
  label,
  rank,
  teamSize,
  yours,
  deskAvg,
  ahead,
}: {
  label: string;
  rank: number;
  teamSize: number;
  yours: string;
  deskAvg: string;
  ahead: boolean;
}) {
  return (
    <div className="rounded-xl border border-border/15 bg-muted/10 p-3">
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-2xl font-extrabold text-foreground">#{rank}</span>
        <span className="text-xs text-muted-foreground">of {teamSize}</span>
      </div>
      <div className="mt-2 text-xs">
        <span className="font-bold text-foreground">You {yours}</span>
        <span className="text-muted-foreground"> · desk avg {deskAvg}</span>
      </div>
      <div className={`mt-1 text-[10px] font-bold ${ahead ? 'text-emerald-500' : 'text-amber-500'}`}>
        {ahead ? 'Above desk average' : 'Below desk average — focus area'}
      </div>
    </div>
  );
}

interface MarketingRuleOfThreeBarsProps {
  moneyMap: MarketingMoneyMap;
}

export function MarketingRuleOfThreeBars({ moneyMap }: MarketingRuleOfThreeBarsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <RuleBar
        label="Show rate"
        pct={moneyMap.show_rate_pct}
        caption="Shown ÷ booked — you get paid when guests show"
        valueLabel={formatPercent(moneyMap.show_rate_pct)}
      />
      <RuleBar
        label="Qualified rate"
        pct={moneyMap.qualified_rate_pct}
        caption="Qualified Owner/NB ÷ shown — $75 vs $20 courtesy"
        valueLabel={formatPercent(moneyMap.qualified_rate_pct)}
      />
      <RuleBar
        label="Guest buy rate"
        pct={Math.min(100, (moneyMap.guest_buy_rate_pct / Math.max(moneyMap.guest_buy_target_pct, 1)) * 100)}
        caption={`${formatPercent(moneyMap.guest_buy_rate_pct)} vs ${formatPercent(moneyMap.guest_buy_target_pct)} FPS goal`}
        valueLabel={formatPercent(moneyMap.guest_buy_rate_pct)}
      />
    </div>
  );
}

function RuleBar({ label, pct, caption, valueLabel }: { label: string; pct: number; caption: string; valueLabel: string }) {
  const clamped = Math.min(100, Math.max(0, pct));
  const color = clamped >= 75 ? '#22C55E' : clamped >= 50 ? '#F59E0B' : '#EF4444';
  return (
    <div className="rounded-xl border border-border/15 bg-muted/10 p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">{label}</span>
        <span className="text-sm font-bold" style={{ color }}>{valueLabel}</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-[var(--bg-elevated)]">
        <div className="h-full rounded-full transition-all" style={{ width: `${clamped}%`, background: color }} />
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">{caption}</p>
    </div>
  );
}

export function TourImpactChipBadge({ chip }: { chip: { tier: string; paid_label: string; upside_label?: string } }) {
  const styles =
    chip.tier === 'green'
      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600'
      : chip.tier === 'amber'
        ? 'border-amber-500/30 bg-amber-500/10 text-amber-700'
        : 'border-rose-500/30 bg-rose-500/10 text-rose-600';
  return (
    <span className={`inline-flex flex-wrap items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${styles}`}>
      <span>{chip.paid_label}</span>
      {chip.upside_label && <span className="font-semibold opacity-90">· {chip.upside_label}</span>}
    </span>
  );
}
