import { useAnalyticsQuery } from '@databricks/appkit-ui/react';
import { sql } from '@databricks/appkit-ui/js';
import {
  Award,
  Briefcase,
  DollarSign,
  Target,
  TrendingUp,
  Wallet,
  Sparkles,
} from 'lucide-react';
import { useMemo, useEffect, useState } from 'react';
import { deriveLoadingSteps } from '@/lib/loadingSteps';
import { LOADING } from '@/lib/loadingStepLabels';
import { formatSalesBenchmarkFacts } from '@shared/compStatementImpact';
import { CompCopilot } from '@/components/comp/CompCopilot';
import { CompStatementImpactPanel } from '@/components/comp/CompStatementImpactPanel';
import { CompInterpretationPanel } from '@/components/comp/CompInterpretationPanel';
import { RepAiInsightsPanel } from '@/components/comp/RepAiInsightsPanel';
import { KpiCard } from '@/components/comp/KpiCard';
import { copilotPromptsForPersona } from '@/data/personaQuestionInventory';
import { formatCurrency, formatPercent, formatQueryError } from '@/lib/compFormat';
import { useAppContext } from '@/context/AppContext';
import { PageLoadGate } from '@/components/comp/PageLoadGate';
import {
  SimpleViewAskButtons,
  SimpleViewCollapsible,
  SimpleViewHeroStrip,
  SimpleViewPayStory,
  SimpleViewTrafficBar,
} from '@/components/comp/simpleView';
import { MarketingCompensationView } from './MarketingCompensationView';
import { ManagerCompensationView } from './ManagerCompensationView';
import { usePlainLanguage } from '@/hooks/usePlainLanguage';
import { attainmentStatus } from '@shared/simpleViewStatus';

export function MyCompensationPage() {
  const { isMarketingChannel, activePersonaId, isManager } = useAppContext();

  if (isMarketingChannel && activePersonaId === 'marketing_rep') {
    return <MarketingCompensationView />;
  }

  if (isManager) {
    return <ManagerCompensationView />;
  }

  return <SalesRepCompensationView />;
}

function SalesRepCompensationView() {
  const { activeRepId, activePeriodId, metadata, activeRoleTitle } = useAppContext();
  const { enabled: simpleView } = usePlainLanguage();
  const [copilotSeed, setCopilotSeed] = useState<string | undefined>();
  const askPrompts = copilotPromptsForPersona('sales_executive', 6);

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

  const queryParams = useMemo(() => ({
    rep_id: sql.string(activeRepId),
    period_id: sql.string(activePeriodId),
  }), [activeRepId, activePeriodId]);

  // Analytics queries
  const { data: kpiRows, loading: kpiLoading, error: kpiError } = useAnalyticsQuery('comp_rep_kpi', queryParams);
  const { data: breakdownRows, loading: breakdownLoading, error: breakdownError } = useAnalyticsQuery('comp_rep_earnings_breakdown', queryParams);
  const { data: dealsRows, loading: dealsLoading, error: dealsError } = useAnalyticsQuery('comp_rep_deals', queryParams);
  const { data: monthlyRows, loading: monthlyLoading, error: monthlyError } = useAnalyticsQuery('comp_rep_monthly_attainment', queryParams);

  const loading = kpiLoading || breakdownLoading || dealsLoading || monthlyLoading;
  const error = kpiError || breakdownError || dealsError || monthlyError;

  const loaderSteps = useMemo(
    () =>
      deriveLoadingSteps([
        {
          id: 'kpi',
          label: LOADING.repKpi,
          loading: kpiLoading,
          done: !!kpiRows?.length,
          error: !!kpiError,
        },
        {
          id: 'breakdown',
          label: LOADING.repBreakdown,
          loading: breakdownLoading,
          done: !!breakdownRows?.length,
          error: !!breakdownError,
        },
        {
          id: 'deals',
          label: LOADING.repDeals,
          loading: dealsLoading,
          done: !!dealsRows,
          error: !!dealsError,
        },
        {
          id: 'monthly',
          label: LOADING.repMonthly,
          loading: monthlyLoading,
          done: !!monthlyRows,
          error: !!monthlyError,
        },
      ]),
    [
      kpiLoading,
      kpiRows,
      kpiError,
      breakdownLoading,
      breakdownRows,
      breakdownError,
      dealsLoading,
      dealsRows,
      dealsError,
      monthlyLoading,
      monthlyRows,
      monthlyError,
    ],
  );

  const kpi = kpiRows?.[0];
  const breakdown = breakdownRows?.[0];

  const activeRepMetadata = useMemo(() => {
    return metadata?.reps.find((r) => r.rep_id === activeRepId);
  }, [metadata, activeRepId]);

  const repTitle = activeRoleTitle;

  // Copilot grounding context
  const dataContext = useMemo(() => {
    if (!kpi || !breakdown) return '';
    return [
      '## Rep Compensation KPIs',
      JSON.stringify(kpi, null, 2),
      '',
      '## Earnings Breakdown',
      JSON.stringify(breakdown, null, 2),
      '',
      '## Recent Deals',
      JSON.stringify(dealsRows || [], null, 2)
    ].join('\n');
  }, [kpi, breakdown, dealsRows]);

  const attainment = Number(kpi?.quota_attainment_pct ?? 0);
  const nextTier = Number(kpi?.next_tier_threshold_pct ?? 100);

  // SVG Bar Chart Calculations for base/commission/bonus
  const chartData = useMemo(() => {
    if (!breakdown) return [];
    const base = Number(breakdown.base_pay ?? 0);
    const comm = Number(breakdown.commission ?? 0);
    const bonus = Number(breakdown.bonus ?? 0);
    const total = base + comm + bonus;

    if (total === 0) return [];

    return [
      { label: 'Base Pay', value: base, color: 'var(--foreground-faint)', pct: (base / total) * 100 },
      { label: 'Commission', value: comm, color: 'var(--primary)', pct: (comm / total) * 100 },
      { label: 'Performance Booster', value: bonus, color: 'var(--gold)', pct: (bonus / total) * 100 },
    ];
  }, [breakdown]);

  // Quota Achievement (monthly sales) chart data — warehouse only
  const monthlyChartData = useMemo(() => {
    if (!monthlyRows?.length) return [];
    return monthlyRows.map((r) => ({
      label: String(r.month_name),
      value: Number(r.monthly_sales || 0),
      active: true,
    }));
  }, [monthlyRows]);

  const maxMonthlyVal = useMemo(() => {
    return Math.max(...monthlyChartData.map(d => d.value), 1);
  }, [monthlyChartData]);

  const insightsContext = useMemo(() => {
    if (!kpi || !breakdown) return '';
    const base = [
      `## Rep: ${kpi.rep_name ?? activeRepId} (${repTitle})`,
      `Period: ${activePeriodId} | Region: ${activeRepMetadata?.region ?? 'West'}`,
      '',
      '## KPI Summary',
      JSON.stringify(kpi, null, 2),
      '',
      '## Earnings Breakdown',
      JSON.stringify(breakdown, null, 2),
      '',
      '## Recent Deals',
      JSON.stringify((dealsRows ?? []).slice(0, 8), null, 2),
    ].join('\n');
    const facts = formatSalesBenchmarkFacts({
      currentEarnings: Number(kpi.current_earnings ?? 0),
      paidToDate: Number(kpi.paid_to_date ?? 0),
      quotaAttainmentPct: Number(kpi.quota_attainment_pct ?? 0),
      creditedAmount: Number(kpi.credited_amount ?? 0),
      quotaAmount: Number(kpi.quota_amount ?? 0),
      nextTierThresholdPct: Number(kpi.next_tier_threshold_pct ?? 100),
      nextTierGapAmount: Number(kpi.next_tier_gap_amount ?? 0),
      dealsClosedCount: Number(kpi.deals_closed_count ?? 0),
      basePay: Number(breakdown.base_pay ?? 0),
      commission: Number(breakdown.commission ?? 0),
      bonus: Number(breakdown.bonus ?? 0),
      totalEarnings: Number(breakdown.total_earnings ?? 0),
    });
    return `${base}\n\n${facts}`;
  }, [kpi, breakdown, dealsRows, activeRepId, repTitle, activePeriodId, activeRepMetadata]);

  const earningsSnapshotContext = useMemo(() => {
    if (!kpi || !breakdown) return '';
    return [
      `## Rep: ${kpi.rep_name ?? activeRepId} (${repTitle})`,
      `Period: ${activePeriodId}`,
      '',
      '## KPI Summary',
      JSON.stringify(kpi, null, 2),
      '',
      '## Earnings Breakdown',
      JSON.stringify(breakdown, null, 2),
      '',
      '## Monthly Attainment Trend',
      JSON.stringify(monthlyChartData, null, 2),
      '',
      '## Recent Deals',
      JSON.stringify((dealsRows ?? []).slice(0, 8), null, 2),
    ].join('\n');
  }, [kpi, breakdown, monthlyChartData, dealsRows, activeRepId, repTitle, activePeriodId]);

  const pageLoading = loading;

  return (
    <PageLoadGate loading={pageLoading} steps={loaderSteps} title="My compensation">
    <div className="animate-fade-in-up space-y-8">
      
      {/* ── Page Header ── */}
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="badge badge-gold">
            <Sparkles size={10} className="mr-0.5" aria-hidden />
            Sales Executive Dashboard
          </span>
          <span className="text-[11px] font-semibold text-muted-foreground">{repTitle}</span>
        </div>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight">
          My Commissions &amp; <span className="text-sapphire-gradient">Earnings</span>
        </h1>
        {kpi?.rep_name && (
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            {simpleView
              ? `Hey ${kpi.rep_name} — your pay and goal progress below. Tap a question if anything looks confusing.`
              : `Welcome back, ${kpi.rep_name}. Live quota, earnings, and deal credits from the warehouse — with AI guidance on how to maximize payout.`}
          </p>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {formatQueryError(error)}
        </div>
      )}

      {/* No data fallback — shows when queries succeed but warehouse returned nothing */}
      {!error && !kpi && (
        <div className="flex flex-col items-center justify-center gap-4 rounded-[var(--radius-lg)] border border-dashed border-border px-8 py-16 text-center text-muted-foreground">
          <Target size={36} className="opacity-30" aria-hidden />
          <div>
            <p className="text-sm font-bold text-foreground">No compensation data found</p>
            <p className="mt-1 text-xs">
              No records for rep{' '}
              <code className="rounded bg-bg-overlay px-1 py-0.5">{activeRepId}</code> in period{' '}
              <code className="rounded bg-bg-overlay px-1 py-0.5">{activePeriodId}</code>.
            </p>
            <p className="mt-2 text-[11px] opacity-70">
              Confirm this rep and period exist in <strong>hgv_comp</strong>, or switch identity above.
            </p>
          </div>
        </div>
      )}

      {kpi && breakdown && (
        <div className="space-y-6">

          {simpleView && (
            <SimpleViewHeroStrip
              metrics={[
                {
                  label: 'What I earned',
                  value: formatCurrency(kpi.current_earnings),
                  hint: `Paid so far ${formatCurrency(kpi.paid_to_date)}`,
                },
                {
                  label: 'Am I on track?',
                  value: formatPercent(kpi.quota_attainment_pct),
                  hint: `${formatCurrency(kpi.credited_amount)} of ${formatCurrency(kpi.quota_amount)} goal`,
                },
                {
                  label: "What's next",
                  value: formatPercent(kpi.next_tier_threshold_pct),
                  hint: `${formatCurrency(kpi.next_tier_gap_amount)} more to next pay bump`,
                },
              ]}
              overallStatus={attainmentStatus(attainment)}
              nextStep={`Close another ${formatCurrency(kpi.next_tier_gap_amount)} in sales credit to boost your rate to ${formatPercent(nextTier)}.`}
            />
          )}

          {/* ── KPI Grid ── */}
          <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4 animate-stagger-1">
            <KpiCard
              label="My Earnings"
              value={formatCurrency(kpi.current_earnings)}
              subtext={`Paid-to-date: ${formatCurrency(kpi.paid_to_date)}`}
              icon={<DollarSign size={14} />}
              trend="neutral"
            />
            <KpiCard
              label="Quota Attainment"
              value={formatPercent(kpi.quota_attainment_pct)}
              subtext={`Sold ${formatCurrency(kpi.credited_amount)} of ${formatCurrency(kpi.quota_amount)}`}
              icon={<Target size={14} />}
              trend={attainment >= 100 ? 'positive' : attainment >= 80 ? 'neutral' : 'negative'}
            />
            <KpiCard
              label="Contracts Closed"
              value={String(kpi.deals_closed_count)}
              subtext="Total deals credited"
              icon={<Briefcase size={14} />}
            />
            <KpiCard
              label="Next Rate Booster"
              value={formatPercent(kpi.next_tier_threshold_pct)}
              subtext={`Need ${formatCurrency(kpi.next_tier_gap_amount)} to unlock`}
              icon={<Award size={14} />}
              trend="neutral"
            />
          </div>

          {simpleView && (
            <SimpleViewTrafficBar
              label="Progress toward your sales goal"
              pct={Math.min(100, attainment)}
              status={attainmentStatus(attainment)}
              caption={`${formatCurrency(kpi.credited_amount)} credited of ${formatCurrency(kpi.quota_amount)} quota`}
              valueLabel={formatPercent(kpi.quota_attainment_pct)}
            />
          )}

          <SimpleViewPayStory
            repId={activeRepId}
            periodId={activePeriodId}
            roleTitle={repTitle}
            channel="sales"
            insightsContext={insightsContext}
            enabled={!!kpi && !!breakdown}
          />

          <SimpleViewAskButtons prompts={askPrompts} onSelect={setCopilotSeed} />

          {/* ── Dashboard Content ── */}
          <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
              
              {/* Left 2 Columns: Financials and Charts */}
              <div className="flex flex-col gap-6 lg:col-span-2">

                <SimpleViewCollapsible
                  title="How market standards affect your pay"
                  subtitle="Benchmark impact on your comp statement"
                >
                <CompStatementImpactPanel
                  repId={activeRepId}
                  periodId={activePeriodId}
                  roleTitle={repTitle}
                  roleKey="sales_executive"
                  insightsContext={insightsContext}
                  enabled={!!kpi && !!breakdown}
                />
                </SimpleViewCollapsible>

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="glass-card hgv-card-hover flex flex-col gap-4 !py-7">
                    <div className="flex items-center gap-2">
                      <Wallet size={15} className="text-primary" aria-hidden />
                      <h3 className="text-[13px] font-bold uppercase tracking-wide">Earnings Breakdown</h3>
                    </div>

                    <div className="flex flex-col gap-3">
                      <div className="progress-bar flex h-2">
                        {chartData.map((bar, i) => (
                          <div
                            key={i}
                            className="h-full transition-all duration-500"
                            style={{ width: `${bar.pct}%`, background: bar.color }}
                            title={`${bar.label}: ${formatCurrency(bar.value)}`}
                          />
                        ))}
                      </div>

                      <div className="flex flex-col gap-2 text-[11px]">
                        <div className="flex items-center justify-between border-b border-white/[0.03] pb-1.5">
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            <span className="h-2 w-2 rounded-full bg-foreground-faint" />
                            Base Salary
                          </span>
                          <span className="font-semibold">{formatCurrency(breakdown.base_pay)}</span>
                        </div>
                        <div className="flex items-center justify-between border-b border-white/[0.03] pb-1.5">
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            <span className="h-2 w-2 rounded-full bg-primary" />
                            Commissions
                          </span>
                          <span className="font-semibold text-primary">{formatCurrency(breakdown.commission)}</span>
                        </div>
                        <div className="flex items-center justify-between border-b border-white/[0.03] pb-1.5">
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            <span className="h-2 w-2 rounded-full bg-[var(--gold)]" />
                            Performance Booster
                          </span>
                          <span className="font-semibold text-[var(--gold)]">{formatCurrency(breakdown.bonus)}</span>
                        </div>
                        <div className="flex items-center justify-between pt-1 text-xs font-extrabold">
                          <span>Total Payout</span>
                          <span>{formatCurrency(breakdown.total_earnings)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="glass-card hgv-card-hover flex flex-col gap-4 !py-7">
                    <div className="flex items-center gap-2">
                      <Target size={15} className="text-[var(--gold)]" aria-hidden />
                      <h3 className="text-[13px] font-bold uppercase tracking-wide">Quota Achievement</h3>
                    </div>

                    <div className="flex min-h-[110px] flex-1 flex-col justify-end">
                      {simpleView ? (
                        <SimpleViewTrafficBar
                          label="Monthly sales toward goal"
                          pct={Math.min(100, attainment)}
                          status={attainmentStatus(attainment)}
                          caption={`Period total ${formatCurrency(monthlyChartData.reduce((sum, d) => sum + d.value, 0))}`}
                          valueLabel={formatPercent(kpi.quota_attainment_pct)}
                        />
                      ) : monthlyChartData.length === 0 ? (
                        <p className="py-8 text-center text-xs text-muted-foreground">
                          No monthly attainment rows for this rep.
                        </p>
                      ) : (
                        <div className="flex h-full items-end justify-between gap-2 pb-2">
                          {monthlyChartData.map((d, i) => {
                            const heightPct = (d.value / maxMonthlyVal) * 100;
                            return (
                              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                                <div
                                  className="bar-segment w-full rounded-t-sm transition-all duration-500"
                                  style={{
                                    height: `${Math.max(8, heightPct)}px`,
                                    background: d.active ? 'var(--primary)' : 'var(--foreground-faint)',
                                    boxShadow: d.active ? '0 0 10px rgba(26,109,255,0.2)' : 'none',
                                  }}
                                  title={`${d.label}: ${formatCurrency(d.value)}`}
                                />
                                <span className="text-[9px] font-semibold text-muted-foreground">{d.label}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {!simpleView && (
                      <div className="flex justify-between border-t border-border pt-1.5 text-[9px] text-muted-foreground">
                        <span>Period credited sales:</span>
                        <span className="font-bold text-foreground">
                          {formatCurrency(monthlyChartData.reduce((sum, d) => sum + d.value, 0))}
                        </span>
                      </div>
                      )}
                    </div>
                  </div>
                </div>

                {!simpleView && (
                <CompInterpretationPanel
                  endpoint="/api/comp/rep/earnings-interpretation"
                  insightsContext={earningsSnapshotContext}
                  roleTitle={repTitle}
                  title="Earnings & Chart Interpretation"
                  subtitle="AI read on your breakdown, monthly trend, and deals — figures above are SQL-sourced."
                  contextLabel={LOADING.aiEarningsSnapshot}
                  llmLabel={LOADING.aiEarningsBrief}
                  enabled={!!earningsSnapshotContext}
                />
                )}

                <div className="glass-card flex items-center gap-3 border-l-[3px] border-l-primary !py-5 animate-stagger-2">
                  <TrendingUp size={16} className="shrink-0 text-primary" aria-hidden />
                  <p className="text-[11.5px] font-medium leading-relaxed">
                    <span className="font-bold text-foreground">Booster Target:</span> Close another{' '}
                    <span className="font-bold text-primary">{formatCurrency(kpi.next_tier_gap_amount)}</span> sales credit to boost commission rate to{' '}
                    <span className="font-bold text-primary">{formatPercent(nextTier)}</span> this period.
                  </p>
                </div>

                <SimpleViewCollapsible
                  title="Recent contracts & credits"
                  subtitle="Full deal ledger for this period"
                >
                <div className="glass-card hgv-card-hover flex flex-col gap-4 !py-7">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Briefcase size={15} className="text-muted-foreground" aria-hidden />
                      <h3 className="text-[13px] font-bold uppercase tracking-wide">Recent Contracts &amp; Credits</h3>
                    </div>
                    <span className="text-[10px] text-muted-foreground">Nightly Sync</span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Contract ID</th>
                          <th>Close Date</th>
                          <th>Property / Product</th>
                          <th className="text-right">Volume</th>
                          <th className="text-right">Credit</th>
                          <th className="text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dealsRows && dealsRows.length > 0 ? (
                          dealsRows.slice(0, 5).map((deal, i) => (
                            <tr key={i}>
                              <td className="font-mono text-muted-foreground">{deal.deal_id}</td>
                              <td>{String(deal.close_date).split('T')[0]}</td>
                              <td className="font-semibold">{deal.description}</td>
                              <td className="text-right font-semibold">{formatCurrency(deal.contract_volume)}</td>
                              <td className="text-right font-bold text-primary">{formatCurrency(deal.commission_earned)}</td>
                              <td className="text-center">
                                <span className={`badge ${deal.status === 'Approved' || deal.status === 'CREDITED' ? 'badge-green' : 'badge-amber'}`}>
                                  {deal.status || 'Pending'}
                                </span>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={6} className="py-8 text-center text-muted-foreground">
                              No transactions recorded for this period.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                </SimpleViewCollapsible>

              </div>

              {/* Right Column: copilot (AI story lives above when Simple View) */}
              <div className="flex flex-col gap-6 lg:sticky lg:top-4">

                {!simpleView && (
                <RepAiInsightsPanel
                  repId={activeRepId}
                  periodId={activePeriodId}
                  roleTitle={repTitle}
                  channel="sales"
                  insightsContext={insightsContext}
                  enabled={!!kpi && !!breakdown}
                />
                )}

                {/* Copilot Sidebar */}
                <div className="glass-card hgv-card-hover overflow-hidden !p-4">
                  <CompCopilot
                    title="AI Payout Copilot"
                    personaLabel="Compensation Advisor"
                    dataContext={dataContext}
                    contextLoading={false}
                    contextError={error}
                    storageKey={`copilot_${activeRepId}`}
                    autoInsight={false}
                    initialInput={copilotSeed}
                    initialInputBehavior="submit"
                    examplePrompts={askPrompts.slice(0, 4)}
                  />
                </div>

              </div>

          </div>

        </div>
      )}
    </div>
    </PageLoadGate>
  );
}
