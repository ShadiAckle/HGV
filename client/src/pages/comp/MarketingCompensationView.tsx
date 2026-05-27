import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import {
  Sparkles,
  Wallet,
  Target,
  Users,
  TrendingUp,
  CalendarDays,
  AlertTriangle,
  Compass,
} from 'lucide-react';
import { CompCopilot } from '@/components/comp/CompCopilot';
import { RepAiInsightsPanel } from '@/components/comp/RepAiInsightsPanel';
import { PayMixMarketBanner } from '@/components/comp/PayMixMarketBanner';
import { CompStatementImpactPanel } from '@/components/comp/CompStatementImpactPanel';
import { CompInterpretationPanel } from '@/components/comp/CompInterpretationPanel';
import { KpiCard } from '@/components/comp/KpiCard';
import { MarketingPlanAssessmentPanel } from '@/components/comp/MarketingPlanAssessmentPanel';
import { PageLoadGate } from '@/components/comp/PageLoadGate';
import { useAppContext } from '@/context/AppContext';
import { copilotPromptsForPersona } from '@/data/personaQuestionInventory';
import { usePlanAssessment } from '@/hooks/usePlanAssessment';
import { deriveLoadingSteps } from '@/lib/loadingSteps';
import { LOADING } from '@/lib/loadingStepLabels';
import { formatNextTierDisplay } from '@/lib/formatNextTier';
import { formatCurrency, formatPercent } from '@/lib/compFormat';
import { formatTourCode } from '@shared/normalizeText';

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
  insights_context: string;
  grounding_context: string;
}

export function MarketingCompensationView() {
  const { activePersonaId, activeRoleTitle, activeRepId, activePeriodId } = useAppContext();
  const [data, setData] = useState<MarketingWorkspacePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { assessment, loading: assessmentLoading } = usePlanAssessment('marketing_rep', activePeriodId);

  if (!activePersonaId || activePersonaId !== 'marketing_rep') return null;

  const load = useCallback(async () => {
    if (!activePeriodId) return;
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch(
        `/api/comp/marketing/workspace?rep_id=${encodeURIComponent(activeRepId)}&period_id=${encodeURIComponent(activePeriodId)}`,
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load marketing compensation');
    } finally {
      setLoading(false);
    }
  }, [activeRepId, activePeriodId]);

  useEffect(() => { void load(); }, [load]);

  const payMixContext = useMemo(() => {
    if (!data) return '';
    return JSON.stringify(
      {
        role: activeRoleTitle,
        base_pct: data.pay_mix.base_pct,
        variable_pct: data.pay_mix.variable_pct,
        tcc_gap_vs_market_pct: data.market_position.tcc_gap_vs_market_pct,
        at_risk_market: data.market_position.at_risk_market,
        qtd_earnings: data.kpis.qtd_earnings,
      },
      null,
      2,
    );
  }, [data, activeRoleTitle]);

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
        {
          id: 'plan-assessment',
          label: LOADING.planAssessment,
          loading: assessmentLoading,
          done: !!assessment,
          error: false,
        },
      ]),
    [loading, data, error, assessmentLoading, assessment],
  );

  const pageLoading = loading || assessmentLoading;

  const planMetricTotal = data?.plan_metrics.reduce((s, m) => s + m.earnings, 0) ?? 0;
  const netPayout = data?.earnings_breakdown.net_payout ?? data?.earnings_breakdown.total_payout ?? 0;
  const chargebackAdj = data?.earnings_breakdown.chargebacks ?? 0;
  const repName = data?.rep_name ?? activeRepId;

  return (
    <PageLoadGate loading={pageLoading} steps={loaderSteps} title="Marketing compensation">
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
          Welcome back, {repName}. Earnings align to plan weights — Qualified Tours (Owner/NB), FPS Packages, Sales
          Transactions — grounded on your plan design and industry compensation benchmarks.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
          <button type="button" onClick={() => void load()} className="ml-2 text-xs underline">Retry</button>
        </div>
      )}

      {data && (
        <>
          {assessment && (
            <MarketingPlanAssessmentPanel assessment={assessment} />
          )}

          <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
            <div className="space-y-6 lg:col-span-2">
              <div className="glass-card" style={{ padding: '1.5rem' }}>
                <div className="mb-4 flex items-center gap-2">
                  <Wallet size={15} color="var(--primary)" />
                  <h3 className="text-sm font-bold uppercase tracking-wider">Earnings by Plan Metric</h3>
                </div>
                <p className="mb-4 text-[11px] text-muted-foreground">
                  Matches plan assessment Metrics/Weights — Qualified Tours (Owner, New Buyer), Individual FPS Packages,
                  Individual Sales Transactions.
                </p>
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
                  Gross plan earnings match the QTD KPI above. Net statement payout {fmtUSD(netPayout)}
                  {chargebackAdj !== 0 ? ` after chargebacks ${fmtUSD(chargebackAdj)}` : ''}.
                </div>
              </div>

              <CompStatementImpactPanel
                repId={activeRepId}
                periodId={activePeriodId}
                roleTitle={activeRoleTitle}
                roleKey="marketing_rep"
                insightsContext={data.insights_context}
              />

              <div className="glass-card hgv-card-hover overflow-hidden p-6">
                <div className="mb-4 flex items-center gap-2">
                  <CalendarDays size={15} className="text-[var(--gold)]" aria-hidden />
                  <h3 className="text-sm font-bold uppercase tracking-wider">Tour Activity &amp; Credits</h3>
                </div>
                <div className="overflow-x-auto rounded-xl border border-border/10">
                  <table className="data-table data-table-compact w-full text-left text-xs">
                    <thead>
                      <tr>
                        <th>Tour ID</th>
                        <th>Guest</th>
                        <th>Owner / NB</th>
                        <th>Arrival</th>
                        <th>Status</th>
                        <th>Code</th>
                        <th style={{ textAlign: 'right' }}>Payout</th>
                        <th style={{ textAlign: 'right' }}>FPS Pot.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.tours.map((t) => {
                        const guestType = String(t.guest_type ?? '');
                        const tourStatus = String(t.tour_status ?? '');
                        const fpsPotential = Number(t.fps_potential ?? 0);
                        return (
                          <tr key={String(t.tour_id)}>
                            <td className="font-mono text-primary">{String(t.tour_id)}</td>
                            <td className="font-semibold">{String(t.guest_name)}</td>
                            <td>
                              <span className={`badge ${guestType === 'Owner' ? 'badge-blue' : guestType === 'New Buyer' ? 'badge-green' : 'badge-neutral'}`}>
                                {guestType}
                              </span>
                            </td>
                            <td>{String(t.arrival_date ?? '')}</td>
                            <td>
                              <span className={`badge ${tourStatus === 'SHOWN' ? 'badge-green' : tourStatus === 'NO_SHOW' ? 'badge-rose' : 'badge-amber'}`}>
                                {tourStatus.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="font-mono text-muted-foreground">{formatTourCode(t.code)}</td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--primary)' }}>{fmtUSD(Number(t.payout ?? 0))}</td>
                            <td style={{ textAlign: 'right', fontWeight: 600, color: fpsPotential > 0 ? 'var(--gold-light)' : 'var(--foreground-muted)' }}>
                              {fpsPotential > 0 ? fmtUSD(fpsPotential) : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <CompInterpretationPanel
                endpoint="/api/comp/marketing/tour-insights"
                insightsContext={tourInterpretationContext}
                roleTitle={activeRoleTitle}
                title="Tour Ledger Interpretation"
                subtitle="AI recovery and conversion priorities — payouts remain warehouse-sourced."
                contextLabel={LOADING.aiTourLedger}
                llmLabel={LOADING.aiTourBrief}
                enabled={!!tourInterpretationContext}
              />

              <div className="grid gap-6 md:grid-cols-2">
                <div className="glass-card hgv-card-hover space-y-3 p-6">
                  <div className="mb-1 flex items-center gap-2">
                    <AlertTriangle size={14} className="text-destructive" aria-hidden />
                    <h3 className="text-sm font-bold uppercase tracking-wider">Chargebacks</h3>
                  </div>
                  {data.chargebacks.map((cb, i) => {
                    const stagger = ['animate-stagger-1', 'animate-stagger-2', 'animate-stagger-3', 'animate-stagger-4'][i % 4];
                    return (
                    <div
                      key={String(cb.chargeback_id)}
                      className={`comp-impact-row rounded-xl border border-destructive/25 bg-destructive/5 p-3.5 text-xs ${stagger}`}
                    >
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
                        <div
                          key={String(a.arrival_id)}
                          className={`comp-impact-row rounded-xl border border-border/15 bg-card/30 p-3.5 text-xs ${stagger}`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-semibold text-foreground">{String(a.guest_name)}</span>
                            <span className={`badge ${guestType === 'Owner' ? 'badge-blue' : 'badge-green'}`}>{guestType}</span>
                          </div>
                          <div className="mt-1.5 text-muted-foreground">{arrivalLabel} · {String(a.desk ?? '')}</div>
                          <div className="mt-2.5 flex flex-wrap gap-3 font-semibold">
                            <span>Tour: {fmtUSD(Number(a.potential_qualified_tour ?? 0))}</span>
                            <span>FPS: {fmtUSD(Number(a.potential_fps_payout ?? 0))}</span>
                            <span className="text-[var(--gold-light)]">
                              Total: {fmtUSD(Number(a.projected_total_payout ?? 0))}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4 lg:sticky lg:top-4">
              <KpiCard
                label="QTD Earnings"
                value={fmtUSD(data.kpis.qtd_earnings)}
                subtext={`Sum of plan metrics · Net ${fmtUSD(netPayout)}`}
                icon={<Wallet size={14} />}
                trend="positive"
              />
              <KpiCard
                label="Qualified Tours"
                value={String(data.kpis.qualified_tours)}
                subtext={`${data.kpis.tours_shown} shown · ${formatPercent(data.kpis.show_rate_pct)}`}
                icon={<Users size={14} />}
              />
              <KpiCard
                label="Area Penetration"
                value={formatPercent(data.kpis.penetration_pct)}
                subtext={`Target ${formatPercent(data.kpis.penetration_target_pct)}`}
                icon={<Target size={14} />}
              />
              <KpiCard
                label="Next Tier"
                value={(() => {
                  const tier = formatNextTierDisplay(data.kpis.next_tier_label);
                  return tier.detail ? `${tier.headline} · ${tier.detail}` : tier.headline;
                })()}
                subtext={`${data.kpis.next_tier_gap_tours} tours to unlock`}
                icon={<TrendingUp size={14} />}
              />
              <PayMixMarketBanner
                roleKey="marketing_rep"
                basePct={data.pay_mix.base_pct}
                variablePct={data.pay_mix.variable_pct}
                tccGapPct={data.market_position.tcc_gap_vs_market_pct}
              />
              <CompInterpretationPanel
                endpoint="/api/comp/pay-mix/insights"
                insightsContext={payMixContext}
                roleTitle={activeRoleTitle}
                title="Pay Mix Interpretation"
                subtitle="What your base/variable split means for statement volatility."
                contextLabel={LOADING.aiPayMix}
                llmLabel={LOADING.aiPayMixBrief}
                enabled={!!payMixContext}
                compact
              />
              <RepAiInsightsPanel
                repId={activeRepId}
                periodId={activePeriodId}
                roleTitle={activeRoleTitle}
                channel="marketing"
                insightsContext={insightsContext}
              />
            </div>
          </div>

          <CompCopilot
            title={`${activeRoleTitle} Payout Copilot`}
            personaLabel={activeRoleTitle}
            dataContext={dataContext}
            storageKey={`mkt_rep_comp_${activeRepId}`}
            autoInsight={false}
            examplePrompts={copilotPromptsForPersona('marketing_rep', 5)}
          />

          <p className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <Compass size={12} />
            Market benchmarks &amp; scenario modeler in{' '}
            <Link to="/admin-console" className="font-semibold text-primary hover:underline">
              Strategy Control Room
            </Link>
            .
          </p>
        </>
      )}
    </div>
    </PageLoadGate>
  );
}
