import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Sparkles,
  Wallet,
  Target,
  Users,
  TrendingUp,
  CalendarDays,
  AlertTriangle,
} from 'lucide-react';
import { CompCopilot } from '@/components/comp/CompCopilot';
import { RepAiInsightsPanel } from '@/components/comp/RepAiInsightsPanel';
import { CompInterpretationPanel } from '@/components/comp/CompInterpretationPanel';
import { KpiCard } from '@/components/comp/KpiCard';
import { MarketingPlanAssessmentPanel } from '@/components/comp/MarketingPlanAssessmentPanel';
import { MarketingTourActivitySection } from '@/components/comp/MarketingTourActivitySection';
import { PageLoadGate } from '@/components/comp/PageLoadGate';
import {
  SimpleViewAskButtons,
  SimpleViewAiInsight,
  SimpleViewCollapsible,
  SimpleViewHeroStrip,
} from '@/components/comp/simpleView';
import {
  MarketingDeskRankCard,
  MarketingMoneyMapSummary,
  MarketingPlanProgressBars,
  MarketingRuleOfThreeBars,
} from '@/components/comp/MarketingMoneyMapPanel';
import type { MarketingMoneyMap } from '@shared/marketingMoneyMap';
import { buildMarketingMoneyMap } from '@shared/marketingMoneyMap';
import { useAppContext } from '@/context/AppContext';
import { usePlainLanguage } from '@/hooks/usePlainLanguage';
import { copilotPromptsForPersona } from '@/data/personaQuestionInventory';
import { usePlanAssessment } from '@/hooks/usePlanAssessment';
import { deriveLoadingSteps } from '@/lib/loadingSteps';
import { LOADING } from '@/lib/loadingStepLabels';
import { formatNextTierDisplay } from '@/lib/formatNextTier';
import { formatCurrency, formatPercent } from '@/lib/compFormat';
import { penetrationStatus } from '@shared/simpleViewStatus';

const fmtUSD = (n: number) => formatCurrency(n);

interface MarketingWorkspacePayload {
  rep_id: string;
  rep_name: string;
  plan_id: string;
  period_label: string;
  assigned_area: string;
  bonus_area_id: string;
  kpis: {
    qtd_earnings: number;
    paid_to_date: number;
    qualified_tours: number;
    tours_shown: number;
    show_rate_pct: number;
    penetration_pct: number;
    penetration_target_pct: number;
    spiff_active: boolean;
    next_tier_label: string;
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
  earnings_breakdown: {
    qualified_tour_pay: number;
    courtesy_tour_pay: number;
    penetration_spiff: number;
    chargebacks: number;
    total_payout: number;
    net_payout: number;
  };
  pay_mix: { base_pct: number; variable_pct: number };
  market_position: { tcc_gap_vs_market_pct: number; at_risk_market: boolean };
  tours: Array<Record<string, unknown>>;
  chargebacks: Array<Record<string, unknown>>;
  upcoming_arrivals: Array<Record<string, unknown>>;
  money_map?: MarketingMoneyMap;
  insights_context: string;
  grounding_context: string;
}

export function MarketingCompensationView() {
  const { activePersonaId, activeRoleTitle, activeRepId, activePeriodId } = useAppContext();
  const { enabled: simpleView } = usePlainLanguage();
  const [data, setData] = useState<MarketingWorkspacePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copilotSeed, setCopilotSeed] = useState<string | undefined>();
  const { assessment } = usePlanAssessment('marketing_rep', activePeriodId);
  const askPrompts = copilotPromptsForPersona('marketing_rep', 6);

  useEffect(() => {
    try {
      const seed = sessionStorage.getItem('hgv_copilot_seed');
      if (seed) {
        setCopilotSeed(seed);
        sessionStorage.removeItem('hgv_copilot_seed');
      }
    } catch {
      /* ignore */
    }
  }, []);

  const load = useCallback(async () => {
    if (!activePeriodId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setData(null);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90_000);
    try {
      const res = await fetch(
        `/api/comp/marketing/workspace?rep_id=${encodeURIComponent(activeRepId)}&period_id=${encodeURIComponent(activePeriodId)}`,
        { signal: controller.signal },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      setData(await res.json());
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') {
        setError('Request timed out — the warehouse may still be starting. Wait a moment and retry.');
      } else {
        setError(e instanceof Error ? e.message : 'Failed to load marketing compensation');
      }
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  }, [activeRepId, activePeriodId]);

  useEffect(() => { void load(); }, [load]);

  const tourInterpretationContext = useMemo(() => {
    if (!data) return '';
    return [
      `## Marketing Rep: ${data.rep_name}`,
      '',
      '## Tours',
      JSON.stringify(data.tours, null, 2),
      '',
      '## Chargebacks',
      JSON.stringify(data.chargebacks, null, 2),
      '',
      '## Upcoming Arrivals',
      JSON.stringify(data.upcoming_arrivals, null, 2),
      '',
      '## Plan Metrics',
      JSON.stringify(data.plan_metrics, null, 2),
    ].join('\n');
  }, [data]);

  const insightsContext = useMemo(
    () => (data ? data.insights_context : ''),
    [data],
  );

  const dataContext = useMemo(
    () => (data ? (data.grounding_context || insightsContext) : ''),
    [data, insightsContext],
  );

  const moneyMap = useMemo((): MarketingMoneyMap | null => {
    if (!data) return null;
    if (data.money_map) return data.money_map;
    return buildMarketingMoneyMap({
      rep_id: data.rep_id,
      kpis: data.kpis,
      plan_metrics: data.plan_metrics,
      tours: data.tours,
      upcoming_arrivals: data.upcoming_arrivals,
      desk_rank: null,
    });
  }, [data]);

  const loaderSteps = useMemo(
    () =>
      deriveLoadingSteps([
        {
          id: 'marketing-workspace',
          label: LOADING.marketingWorkspace,
          loading,
          done: !!data,
          error: !!error,
        },
      ]),
    [loading, data, error],
  );

  const planMetricTotal = data?.plan_metrics.reduce((s, m) => s + m.earnings, 0) ?? 0;
  const netPayout = data?.earnings_breakdown.net_payout ?? data?.earnings_breakdown.total_payout ?? 0;
  const chargebackAdj = data?.earnings_breakdown.chargebacks ?? 0;
  const repName = data?.rep_name ?? activeRepId;

  const overallStatus = useMemo(() => {
    if (!data) return penetrationStatus(0, 20);
    return penetrationStatus(data.kpis.penetration_pct, data.kpis.penetration_target_pct);
  }, [data]);

  const nextTierDisplay = data ? formatNextTierDisplay(data.kpis.next_tier_label) : null;

  if (!activePersonaId || activePersonaId !== 'marketing_rep') return null;

  const heroMetrics = data
    ? ([
        {
          label: 'What I earned',
          value: fmtUSD(data.kpis.qtd_earnings),
          hint: `Net take-home ${fmtUSD(netPayout)}`,
        },
        {
          label: 'Am I on track?',
          value: formatPercent(data.kpis.penetration_pct),
          hint: `Goal ${formatPercent(data.kpis.penetration_target_pct)} penetration`,
        },
        {
          label: "What's next",
          value: nextTierDisplay?.headline ?? data.kpis.next_tier_label,
          hint: `${data.kpis.next_tier_gap_tours} tours to next level`,
        },
      ] as const)
    : null;

  return (
    <PageLoadGate loading={loading} steps={loaderSteps} title="Marketing compensation">
      <div className="animate-fade-in-up space-y-8">
        <div>
          <span className="badge badge-gold">
            <Sparkles size={10} style={{ marginRight: 4 }} />
            {activeRoleTitle} — My Earnings
          </span>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight">
            My Compensation — <span className="text-sapphire-gradient">{activeRoleTitle}</span>
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground leading-relaxed">
            {simpleView
              ? `Hey ${repName} — show, qualify, sell FPS. Every number below is in dollars tied to your plan.`
              : `Welcome back, ${repName}. Advanced view — money map, tour ledger, and plan metric detail.`}
          </p>
        </div>

        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
            <button type="button" onClick={() => void load()} className="ml-2 text-xs underline">Retry</button>
          </div>
        )}

        {data && simpleView && heroMetrics && (
          <>
            <SimpleViewHeroStrip
              metrics={[...heroMetrics]}
              overallStatus={overallStatus}
              aiNextStep={
                <SimpleViewAiInsight
                  repId={activeRepId}
                  periodId={activePeriodId}
                  roleTitle={activeRoleTitle}
                  insightsContext={insightsContext}
                  focus="next_step"
                  variant="inline"
                />
              }
            />

            {moneyMap && (
              <>
                <MarketingRuleOfThreeBars moneyMap={moneyMap} />
                <MarketingMoneyMapSummary moneyMap={moneyMap} />
                <MarketingPlanProgressBars moneyMap={moneyMap} />
                <MarketingDeskRankCard moneyMap={moneyMap} assignedArea={data.assigned_area} />
              </>
            )}

            <SimpleViewAiInsight
              repId={activeRepId}
              periodId={activePeriodId}
              roleTitle={activeRoleTitle}
              insightsContext={insightsContext}
              focus="qtd_earnings"
              variant="card"
            />

            <MarketingTourActivitySection
              tours={data.tours}
              repName={data.rep_name}
              repId={activeRepId}
              periodId={activePeriodId}
              assignedArea={data.assigned_area}
              moneyMap={moneyMap}
              prominent
            />

            <SimpleViewAskButtons prompts={askPrompts} onSelect={setCopilotSeed} />

            {assessment && (
              <SimpleViewCollapsible
                title="Full plan rules & weights"
                subtitle="Official plan assessment — open if you want the fine print"
              >
                <MarketingPlanAssessmentPanel assessment={assessment} />
              </SimpleViewCollapsible>
            )}

            <SimpleViewCollapsible title="Where my money came from" subtitle="Plan metric earnings table">
              <EarningsByPlanMetricTable data={data} planMetricTotal={planMetricTotal} netPayout={netPayout} chargebackAdj={chargebackAdj} />
            </SimpleViewCollapsible>

            <SimpleViewCollapsible title="Chargebacks & upcoming arrivals" subtitle="Money clawed back and tours on the calendar">
              <ChargebacksAndArrivals data={data} />
            </SimpleViewCollapsible>
          </>
        )}

        {data && !simpleView && (
          <>
            {moneyMap && (
              <div className="space-y-6">
                <MarketingRuleOfThreeBars moneyMap={moneyMap} />
                <MarketingMoneyMapSummary moneyMap={moneyMap} />
                <div className="grid gap-6 lg:grid-cols-2">
                  <MarketingPlanProgressBars moneyMap={moneyMap} />
                  <MarketingDeskRankCard moneyMap={moneyMap} assignedArea={data.assigned_area} />
                </div>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard label="QTD Earnings" value={fmtUSD(data.kpis.qtd_earnings)} subtext={`Sum of plan metrics · Net ${fmtUSD(netPayout)}`} icon={<Wallet size={14} />} trend="positive" />
              <KpiCard label="Qualified Tours" value={String(data.kpis.qualified_tours)} subtext={`${data.kpis.tours_shown} shown · ${formatPercent(data.kpis.show_rate_pct)}`} icon={<Users size={14} />} />
              <KpiCard label="Area Penetration" value={formatPercent(data.kpis.penetration_pct)} subtext={`Target ${formatPercent(data.kpis.penetration_target_pct)}`} icon={<Target size={14} />} />
              <KpiCard
                label="Next Tier"
                value={nextTierDisplay?.detail ? `${nextTierDisplay.headline} · ${nextTierDisplay.detail}` : (nextTierDisplay?.headline ?? data.kpis.next_tier_label)}
                subtext={`${data.kpis.next_tier_gap_tours} tours to unlock`}
                icon={<TrendingUp size={14} />}
              />
            </div>

            <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
              <div className="space-y-6 lg:col-span-2">
                <MarketingTourActivitySection
              tours={data.tours}
              repName={data.rep_name}
              repId={activeRepId}
              periodId={activePeriodId}
              assignedArea={data.assigned_area}
              moneyMap={moneyMap}
              prominent
            />
                <CompInterpretationPanel
                  endpoint="/api/comp/marketing/tour-insights"
                  insightsContext={tourInterpretationContext}
                  roleTitle={activeRoleTitle}
                  title="Tour Ledger Interpretation"
                  subtitle="AI priorities for tour credits — payouts remain warehouse-sourced."
                  contextLabel={LOADING.aiTourLedger}
                  llmLabel={LOADING.aiTourBrief}
                  enabled={!!tourInterpretationContext}
                />
                <EarningsByPlanMetricTable data={data} planMetricTotal={planMetricTotal} netPayout={netPayout} chargebackAdj={chargebackAdj} />
                <ChargebacksAndArrivals data={data} />
              </div>
              <div className="space-y-4 lg:sticky lg:top-4">
                <RepAiInsightsPanel
                  repId={activeRepId}
                  periodId={activePeriodId}
                  roleTitle={activeRoleTitle}
                  channel="marketing"
                  insightsContext={insightsContext}
                />
              </div>
            </div>

            {assessment && <MarketingPlanAssessmentPanel assessment={assessment} />}
          </>
        )}

        {data && (
          <CompCopilot
            title={`${activeRoleTitle} Payout Copilot`}
            personaLabel={activeRoleTitle}
            dataContext={dataContext}
            storageKey={`mkt_rep_comp_${activeRepId}`}
            autoInsight={false}
            initialInput={copilotSeed}
            initialInputBehavior="submit"
            examplePrompts={askPrompts.slice(0, 5)}
          />
        )}
      </div>
    </PageLoadGate>
  );
}

function EarningsByPlanMetricTable({
  data,
  planMetricTotal,
  netPayout,
  chargebackAdj,
}: {
  data: MarketingWorkspacePayload;
  planMetricTotal: number;
  netPayout: number;
  chargebackAdj: number;
}) {
  return (
    <div className="glass-card" style={{ padding: '1.5rem' }}>
      <div className="mb-4 flex items-center gap-2">
        <Wallet size={15} color="var(--primary)" />
        <h3 className="text-sm font-bold uppercase tracking-wider">Earnings by Plan Metric</h3>
      </div>
      <table className="data-table w-full text-left text-xs">
        <thead>
          <tr>
            <th>Plan Metric</th>
            <th>Weight</th>
            <th>Attainment</th>
            <th style={{ textAlign: 'right' }}>Earned</th>
            <th style={{ textAlign: 'right' }}>Opportunity</th>
          </tr>
        </thead>
        <tbody>
          {data.plan_metrics.map((m) => (
            <tr key={m.metric}>
              <td className="font-semibold">{m.metric}</td>
              <td>{m.weight_pct}%</td>
              <td style={{ color: m.attainment_pct >= 100 ? 'var(--success)' : m.attainment_pct === 0 ? 'var(--danger)' : 'inherit' }}>
                {m.attainment_pct}%
              </td>
              <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--primary)' }}>{fmtUSD(m.earnings)}</td>
              <td style={{ textAlign: 'right', color: 'var(--gold-light)' }}>
                {m.opportunity_usd ? fmtUSD(m.opportunity_usd) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3} className="font-bold">Gross plan metric earnings (QTD)</td>
            <td style={{ textAlign: 'right', fontWeight: 800 }}>{fmtUSD(planMetricTotal)}</td>
            <td />
          </tr>
        </tfoot>
      </table>
      <div className="mt-4 border-t border-border/10 pt-3 text-xs text-muted-foreground">
        Net statement payout {fmtUSD(netPayout)}
        {chargebackAdj !== 0 ? ` after chargebacks ${fmtUSD(chargebackAdj)}` : ''}.
      </div>
    </div>
  );
}

function ChargebacksAndArrivals({ data }: { data: MarketingWorkspacePayload }) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="glass-card hgv-card-hover space-y-3 p-6">
        <div className="mb-1 flex items-center gap-2">
          <AlertTriangle size={14} className="text-destructive" aria-hidden />
          <h3 className="text-sm font-bold uppercase tracking-wider">Chargebacks</h3>
        </div>
        {data.chargebacks.map((cb, i) => {
          const stagger = ['animate-stagger-1', 'animate-stagger-2', 'animate-stagger-3', 'animate-stagger-4'][i % 4];
          return (
            <div key={String(cb.chargeback_id)} className={`comp-impact-row rounded-xl border border-destructive/25 bg-destructive/5 p-3.5 text-xs ${stagger}`}>
              <div className="font-mono text-[10px] font-bold text-destructive">{String(cb.chargeback_id)}</div>
              <div className="mt-1.5 font-semibold text-foreground">
                {String(cb.guest_name)} · {String(cb.tour_id)}
              </div>
              <div className="mt-2 text-sm font-extrabold text-destructive">
                -{fmtUSD(Number(cb.chargeback_amount ?? 0))}
              </div>
            </div>
          );
        })}
      </div>
      <div className="glass-card hgv-card-hover space-y-3 p-6">
        <div className="mb-1 flex items-center gap-2">
          <CalendarDays size={14} className="text-primary" aria-hidden />
          <h3 className="text-sm font-bold uppercase tracking-wider">Upcoming Arrivals — Projected Payout</h3>
        </div>
        <div className="space-y-2">
          {data.upcoming_arrivals.map((a, i) => {
            const guestType = String(a.guest_type ?? '');
            const arrivalLabel = String(a.arrival_datetime ?? a.arrival_date ?? '');
            const stagger = ['animate-stagger-1', 'animate-stagger-2', 'animate-stagger-3', 'animate-stagger-4'][i % 4];
            return (
              <div key={String(a.arrival_id)} className={`comp-impact-row rounded-xl border border-border/15 bg-card/30 p-3.5 text-xs ${stagger}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-foreground">{String(a.guest_name)}</span>
                  <span className={`badge ${guestType === 'Owner' ? 'badge-blue' : 'badge-green'}`}>{guestType}</span>
                </div>
                <div className="mt-1.5 text-muted-foreground">{arrivalLabel} · {String(a.desk ?? '')}</div>
                <div className="mt-2.5 flex flex-wrap gap-3 font-semibold">
                  <span>Tour: {fmtUSD(Number(a.potential_qualified_tour ?? 0))}</span>
                  <span>FPS: {fmtUSD(Number(a.potential_fps_payout ?? 0))}</span>
                  <span className="text-[var(--gold-light)]">Total: {fmtUSD(Number(a.projected_total_payout ?? 0))}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
