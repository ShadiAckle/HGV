import { useCallback, useEffect, useMemo, useState } from 'react';
import { Sparkles, Target, TrendingUp, AlertTriangle, ArrowRight, Scale, Users } from 'lucide-react';
import { Link } from 'react-router';
import { combinedAtRiskFlag, type TeamMarketPosition } from '@shared/compStandards';
import { formatManagerBenchmarkFacts } from '@shared/compStatementImpact';
import { CompStatementImpactPanel } from '@/components/comp/CompStatementImpactPanel';
import { CompCopilot } from '@/components/comp/CompCopilot';
import { ManagerAiInsightsPanel } from '@/components/comp/ManagerAiInsightsPanel';
import { KpiCard } from '@/components/comp/KpiCard';
import { MarketingPlanAssessmentPanel } from '@/components/comp/MarketingPlanAssessmentPanel';
import { useAppContext } from '@/context/AppContext';
import { usePlanAssessment } from '@/hooks/usePlanAssessment';
import { PageLoadGate } from '@/components/comp/PageLoadGate';
import { deriveLoadingSteps } from '@/lib/loadingSteps';
import { LOADING } from '@/lib/loadingStepLabels';

interface MetricAttainment {
  metric: string;
  weight_pct: number;
  target: number | string;
  actual: number | string;
  attainment_pct: number;
  payout_pct: number;
  status: string;
}

interface WorkspacePayload {
  manager_name: string;
  role_title: string;
  plan_id: string;
  team_rollup: Record<string, number>;
  metric_attainment: MetricAttainment[];
  grounding_context: string;
  insights_context?: string;
}

const fmtUSD = (n: number) => '$' + Math.round(n).toLocaleString('en-US');

const MANAGER_COMP_BASIS: Record<string, string> = {
  marketing_manager:
    'Paid on site LM Tours, LM NSV, Club Penetration, and Contribution — all driven by direct-report tour flow and downstream sales.',
  marketing_director:
    'Paid on regional NSV, New Owner NSV, DC Contribution, and club penetration qualifiers across all sites in the region.',
  sales_manager:
    'Paid on direct-report closed volume, team quota attainment, FFS mix, and override credits when stepping in on takeovers (TOs).',
};

export function ManagerCompensationView() {
  const { activeRepId, activePeriodId, activePersonaId, activeRoleTitle } = useAppContext();
  const [data, setData] = useState<WorkspacePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [teamMarketPositions, setTeamMarketPositions] = useState<TeamMarketPosition[]>([]);

  const compBasis = MANAGER_COMP_BASIS[activePersonaId ?? 'sales_manager'];

  const load = useCallback(async () => {
    if (!activePeriodId) return;
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch(
        `/api/comp/manager/workspace?manager_rep_id=${encodeURIComponent(activeRepId)}&period_id=${encodeURIComponent(activePeriodId)}`,
      );
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`);
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load manager workspace');
    } finally {
      setLoading(false);
    }
  }, [activeRepId, activePeriodId]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    void fetch(`/api/comp/benchmarks/team?period_id=${encodeURIComponent(activePeriodId)}`)
      .then(async (r) => {
        if (!r.ok) return;
        const rows = (await r.json()) as Array<Record<string, unknown>>;
        setTeamMarketPositions(
          rows.map((row) => ({
            rep_id: String(row.rep_id),
            rep_name: String(row.rep_name),
            role: String(row.role_key ?? 'marketing_rep'),
            tcc_gap_vs_market_pct: Number(row.tcc_gap_vs_market_pct ?? 0),
            base_pct: Number(row.base_pct ?? 0),
            variable_pct: Number(row.variable_pct ?? 0),
            quota_attainment_pct: Number(row.quota_attainment_pct ?? 0),
          })),
        );
      })
      .catch(() => setTeamMarketPositions([]));
  }, [activePeriodId]);

  const blendedPayoutPct = useMemo(() => {
    if (!data?.metric_attainment?.length) return null;
    const weighted = data.metric_attainment.reduce(
      (sum, m) => sum + (m.payout_pct * m.weight_pct) / 100,
      0,
    );
    return Math.round(weighted * 10) / 10;
  }, [data]);

  const marketRollup = useMemo(() => {
    const belowMarket = teamMarketPositions.filter((p) => p.tcc_gap_vs_market_pct <= -10).length;
    const invertedMix = teamMarketPositions.filter((p) => p.base_pct < 50).length;
    const critical = teamMarketPositions.filter((p) =>
      combinedAtRiskFlag(p.quota_attainment_pct, p.tcc_gap_vs_market_pct) === 'CRITICAL',
    ).length;
    return { belowMarket, invertedMix, critical };
  }, [teamMarketPositions]);

  const assessmentPersonaId = activePersonaId ?? 'sales_manager';
  const { assessment: assessmentForPanel, loading: assessmentLoading } = usePlanAssessment(assessmentPersonaId, activePeriodId);

  const loaderSteps = useMemo(
    () =>
      deriveLoadingSteps([
        {
          id: 'workspace',
          label: LOADING.managerComp,
          loading,
          done: !!data,
          error: !!error,
        },
        {
          id: 'plan-assessment',
          label: LOADING.planAssessment,
          loading: assessmentLoading,
          done: !!assessmentForPanel,
          error: false,
        },
      ]),
    [loading, data, error, assessmentLoading, assessmentForPanel],
  );

  const pageLoading = loading || assessmentLoading;

  const benchmarkInsightsContext = useMemo(() => {
    if (!data?.insights_context) return '';
    const facts = formatManagerBenchmarkFacts({
      roleKey: assessmentPersonaId,
      blendedPayoutPct: blendedPayoutPct,
      teamAttainmentPct: data.team_rollup.team_attainment_pct ?? 0,
      atRiskCount: data.team_rollup.at_risk_count ?? 0,
      metricAttainment: (data.metric_attainment ?? []).map((m) => ({
        metric: m.metric,
        weight_pct: m.weight_pct,
        attainment_pct: m.attainment_pct,
        payout_pct: m.payout_pct,
      })),
    });
    return `${data.insights_context}\n\n${facts}`;
  }, [data, assessmentPersonaId, blendedPayoutPct]);

  return (
    <PageLoadGate loading={pageLoading} steps={loaderSteps} title="Manager compensation">
    <div className="animate-fade-in-up space-y-8">
      <div>
        <span className="badge badge-gold">
          <Sparkles size={10} style={{ marginRight: 4 }} />
          Your Payout Statement
        </span>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight">
          My Compensation — <span className="text-sapphire-gradient">Plan &amp; Payout</span>
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground leading-relaxed">
          {compBasis ||
            'How your plan weights, attainment gates, and payout curve translate team production into your comp check — grounded on industry compensation benchmarks.'}
        </p>
        <Link to="/team" className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
          Rep coaching &amp; interventions <ArrowRight size={12} />
        </Link>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>
      )}

      {data && (
        <>
          {assessmentForPanel && (
            <MarketingPlanAssessmentPanel assessment={assessmentForPanel} />
          )}

        <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
          <div className="space-y-6 lg:col-span-2">
            <div className="glass-card overflow-hidden" style={{ padding: '1.5rem' }}>
              <h3 className="mb-1 text-sm font-bold uppercase tracking-wider text-primary">
                Your Plan Metrics — Attainment &amp; Payout %
              </h3>
              <p className="mb-4 text-[11px] text-muted-foreground">
                Each row is a weighted component of your comp check. Monthly vs quarterly timing in Timing column.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border/10 font-bold text-muted-foreground">
                      <th className="p-2">Metric</th>
                      <th className="p-2">Weight</th>
                      <th className="p-2">Target</th>
                      <th className="p-2">Actual</th>
                      <th className="p-2">Attainment</th>
                      <th className="p-2">Payout %</th>
                      <th className="p-2">Timing</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.metric_attainment.map((m) => (
                      <tr key={m.metric} className="border-b border-border/5">
                        <td className="p-2 font-semibold">{m.metric}</td>
                        <td className="p-2">{m.weight_pct}%</td>
                        <td className="p-2">{m.target}</td>
                        <td className="p-2">{m.actual}</td>
                        <td className="p-2" style={{ color: m.attainment_pct >= 100 ? 'var(--success)' : m.attainment_pct < 75 ? 'var(--danger)' : 'inherit' }}>
                          {m.attainment_pct}%
                        </td>
                        <td className="p-2 font-bold">{m.payout_pct}%</td>
                        <td className="p-2 text-muted-foreground">{m.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <CompStatementImpactPanel
              repId={activeRepId}
              periodId={activePeriodId}
              roleTitle={data.role_title}
              roleKey={assessmentPersonaId}
              insightsContext={benchmarkInsightsContext}
              enabled={!!benchmarkInsightsContext}
            />

            <CompCopilot
              title="Payout Advisor"
              personaLabel={activeRoleTitle}
              dataContext={data.grounding_context}
              storageKey={`mgr_payout_${activeRepId}`}
              autoInsight={false}
              examplePrompts={[
                'Which metric is dragging my blended payout % the most?',
                'How does my pay mix compare to industry market standards?',
                'What happens if team attainment hits the 125% accelerator?',
              ]}
            />
          </div>

          {/* Right column — summary tiles + AI insights */}
          <div className="space-y-4 lg:sticky lg:top-4">
            {[
              { label: 'Blended Payout %', value: blendedPayoutPct != null ? `${blendedPayoutPct}%` : '—', icon: <Target size={14} />, sub: 'Weighted plan metrics', trend: 'neutral' as const },
              { label: 'Team Attainment', value: `${data.team_rollup.team_attainment_pct}%`, icon: <TrendingUp size={14} />, sub: 'Rolls into attainment metrics', trend: data.team_rollup.team_attainment_pct >= 100 ? 'positive' as const : 'neutral' as const },
              { label: 'Quota At-Risk', value: String(data.team_rollup.at_risk_count), icon: <AlertTriangle size={14} />, sub: 'Reps below 70% quota', trend: data.team_rollup.at_risk_count > 0 ? 'negative' as const : 'positive' as const },
              { label: 'Below Market TCC', value: String(marketRollup.belowMarket), icon: <Scale size={14} />, sub: 'Industry benchmark · Below market (>10% gap)', trend: marketRollup.belowMarket > 0 ? 'negative' as const : 'positive' as const },
              { label: 'Inverted Pay Mix', value: String(marketRollup.invertedMix), icon: <Users size={14} />, sub: '40/60 vs market 60/40', trend: marketRollup.invertedMix > 0 ? 'negative' as const : 'positive' as const },
              { label: 'Critical (Quota+Market)', value: String(marketRollup.critical), icon: <AlertTriangle size={14} />, sub: 'Dual at-risk flags', trend: marketRollup.critical > 0 ? 'negative' as const : 'positive' as const },
              { label: 'Team NSV', value: fmtUSD(data.team_rollup.total_team_nsv), icon: <TrendingUp size={14} />, sub: `${data.team_rollup.report_count} direct reports`, trend: 'neutral' as const },
            ].map(({ label, value, icon, sub, trend }, i) => (
              <div key={label} className={['animate-stagger-1', 'animate-stagger-2', 'animate-stagger-3', 'animate-stagger-4'][i % 4]}>
                <KpiCard label={label} value={value} icon={icon} subtext={sub} trend={trend} className="!p-5" />
              </div>
            ))}

            <ManagerAiInsightsPanel
              managerRepId={activeRepId}
              periodId={activePeriodId}
              roleTitle={data.role_title}
              insightsContext={data.insights_context}
              personaId={assessmentPersonaId}
              focus="payout"
            />
          </div>
        </div>
        </>
      )}
    </div>
    </PageLoadGate>
  );
}
