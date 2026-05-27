import { useEffect, useState, useCallback } from 'react';
import { useAppContext } from '@/context/AppContext';
import { CompCopilot } from '@/components/comp/CompCopilot';
import {
  TrendingUp, DollarSign, AlertTriangle, BarChart2, RefreshCw,
  ArrowUpRight, ArrowDownRight, Activity, Shield, Layers,
  Zap, BookOpen, Info
} from 'lucide-react';
import { LuxeDbLoader } from '@/components/comp/LuxeDbLoader';
import { initLoadingSteps, patchLoadingStep, type LoadingStep } from '@/lib/loadingSteps';
import { FINANCE_LOAD_STEP_DEFS } from '@/lib/loadingStepLabels';
import { usePlainLanguage } from '@/hooks/usePlainLanguage';
import { toPlainLabel } from '@shared/plainLanguage';

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmt  = (n: number | null | undefined, dec = 0) =>
  n == null ? '—' : Number(n).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
const fmtUSD = (n: number | null | undefined) =>
  n == null ? '—' : '$' + Math.abs(Number(n)).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtPct = (n: number | null | undefined) =>
  n == null ? '—' : `${Number(n).toFixed(1)}%`;
const fmtK = (n: number | null | undefined) =>
  n == null ? '—' : Number(n) >= 1_000_000
    ? `$${(Number(n)/1_000_000).toFixed(1)}M`
    : `$${(Number(n)/1_000).toFixed(0)}K`;

type FinTab = 'cost' | 'tours' | 'spiff' | 'accruals';

const FINANCE_LOAD_STEPS = [...FINANCE_LOAD_STEP_DEFS];

const FINANCE_PROMPTS = [
  'What is variable comp as a % of net sales volume this period?',
  'How does our actual comp cost compare to the $14.5M budget?',
  'Which role level is driving the most cost pressure — L5, L6, or L7?',
  'Show the tour quality breakdown by lead source and ABC score.',
  'What is our overall VPG for Q2 2026 and how does it compare by rep?',
  'Which lead source produces the highest VPG and lowest rescission rate?',
  'What is the SPIFF ROI for Q1 — does it exceed the 3:1 NSV threshold?',
  'Which SPIFFs were approved and what incremental NSV did they drive?',
  'What is the total accrual we need to book for Q2 2026?',
  'What is our open reserve liability from chargebacks and rescissions?',
  'Show me the pay-for-performance analysis — who are the top earners and is VPG correlated?',
  'Are there any reps with high earnings but below-average VPG (overpayment risk)?',
  'What would a 10% quota increase do to our comp cost and EBITDA?',
  'What is the projected chargeback exposure from deals still in rescission window?',
  'Model the financial impact if we shift 20% more tours to A-lead sources.',
] as const;

// ── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, icon: Icon, accent, trend, risk, plainEnglish }: {
  label: string; value: string; sub?: string; icon: React.ComponentType<any>;
  accent?: string; trend?: 'up' | 'down' | null; risk?: boolean; plainEnglish?: boolean;
}) {
  const displayLabel = toPlainLabel(label, plainEnglish === true);
  const displaySub = sub ? toPlainLabel(sub, plainEnglish === true) : undefined;
  return (
    <div style={{
      background: 'var(--bg-card)', border: `1px solid ${risk ? 'rgba(239,68,68,0.4)' : 'var(--border)'}`,
      borderRadius: 'var(--radius)', padding: '1.25rem 1.5rem',
      display: 'flex', alignItems: 'flex-start', gap: '1rem', flex: 1, minWidth: 180,
      boxShadow: risk ? '0 0 0 2px rgba(239,68,68,0.1)' : 'var(--shadow-sm)',
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10,
        background: accent ? `${accent}20` : 'var(--primary-muted)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon size={18} color={accent ?? 'var(--primary)'} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <div style={{ fontSize: 11, color: 'var(--foreground-muted)', fontWeight: 600, letterSpacing: plainEnglish ? '0.02em' : '0.05em', textTransform: plainEnglish ? 'none' : 'uppercase' }}>{displayLabel}</div>
          {risk && <AlertTriangle size={11} color="#EF4444" />}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginTop: 3 }}>
          <span style={{ fontSize: 22, fontWeight: 800, color: risk ? '#EF4444' : 'var(--foreground)', lineHeight: 1.1 }}>{value}</span>
          {trend === 'up' && <ArrowUpRight size={16} color="#10B981" />}
          {trend === 'down' && <ArrowDownRight size={16} color="#EF4444" />}
        </div>
        {displaySub && <div style={{ fontSize: 11, color: 'var(--foreground-muted)', marginTop: 4 }}>{displaySub}</div>}
      </div>
    </div>
  );
}

// ── Bar Chart (pure CSS/SVG-free) ─────────────────────────────────────────────
function MiniBarChart({ rows, labelKey, valueKey, color = '#3B82F6', labelFontSize = 11 }: {
  rows: Record<string, unknown>[];
  labelKey: string;
  valueKey: string;
  color?: string;
  labelFontSize?: number;
}) {
  if (!rows.length) return null;
  const max = Math.max(...rows.map(r => Number(r[valueKey] ?? 0)), 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {rows.map((row, i) => {
        const val = Number(row[valueKey] ?? 0);
        const pct = (val / max) * 100;
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: 100, fontSize: labelFontSize, color: 'var(--foreground-muted)', fontWeight: 600, flexShrink: 0, textAlign: 'right' }}>
              {String(row[labelKey] ?? '—')}
            </div>
            <div style={{ flex: 1, height: 20, background: 'var(--bg-elevated)', borderRadius: 6, overflow: 'hidden', position: 'relative' }}>
              <div style={{
                height: '100%', width: `${pct}%`, background: color,
                borderRadius: 6, transition: 'width 0.4s ease',
                minWidth: pct > 0 ? 3 : 0,
              }} />
            </div>
            <div style={{ width: 70, fontSize: 12, fontWeight: 700, color: 'var(--foreground)', flexShrink: 0 }}>
              {fmtUSD(val)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── ABC Score badge ────────────────────────────────────────────────────────────
const ABC_COLORS: Record<string, { bg: string; color: string }> = {
  A: { bg: 'rgba(16,185,129,0.15)', color: '#10B981' },
  B: { bg: 'rgba(59,130,246,0.15)', color: '#3B82F6' },
  C: { bg: 'rgba(245,158,11,0.15)', color: '#F59E0B' },
  D: { bg: 'rgba(239,68,68,0.15)',  color: '#EF4444' },
};
function AbcBadge({ score }: { score: string }) {
  const c = ABC_COLORS[score] ?? { bg: 'rgba(107,114,128,0.12)', color: '#6B7280' };
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 100,
      fontSize: 10, fontWeight: 800, letterSpacing: '0.06em',
      background: c.bg, color: c.color,
    }}>{score}</span>
  );
}

// ── Build Finance copilot context ─────────────────────────────────────────────
function buildFinanceContext(data: {
  costData?: any;
  tourData?: any;
  leadData?: any;
  roiData?: any;
  exposureData?: any;
  accrualData?: any;
  perfData?: any;
  periodId: string;
}): string {
  const parts: string[] = [`## Finance Intelligence Context — ${data.periodId}`];

  if (data.costData) {
    const d = data.costData;
    const minPct = d.var_comp_target_min_pct;
    const maxPct = d.var_comp_target_max_pct;
    parts.push(`\n### Cost of Sales`);
    parts.push(`- Total Incentive Cost: ${fmtUSD(d.totals?.total_comp)} vs Budget: ${fmtUSD(d.budget_comp)}`);
    parts.push(`- Budget Variance: ${fmtUSD(d.budget_variance)} (${Number(d.budget_variance ?? 0) < 0 ? 'under' : 'over'} budget)`);
    parts.push(`- Variable Comp % of NSV: ${fmtPct(d.var_comp_pct_of_nsv)}${minPct != null && maxPct != null ? ` (target: ${minPct}–${maxPct}%)` : ''}`);
    if (maxPct != null && d.var_comp_pct_of_nsv > maxPct) parts.push(`  ⚠ [RISK FLAG] Over-budget threshold exceeded`);
    if (d.by_role?.length) {
      parts.push(`- By Role:`);
      d.by_role.forEach((r: any) => parts.push(`  ${r.level_code}: ${fmtUSD(r.total_comp)} (${r.headcount} reps, avg ${fmtUSD(r.avg_comp)})`));
    }
  }

  if (data.tourData) {
    const s = data.tourData.summary;
    parts.push(`\n### Tour Quality`);
    if (s) {
      parts.push(`- Total Tours: ${s.total_tours} | Showed: ${s.total_showed} | Closed: ${s.total_closed}`);
      parts.push(`- Overall VPG: ${fmtUSD(s.overall_vpg)} | Total NSV: ${fmtK(s.total_nsv)}`);
      parts.push(`- Rescissions: ${s.total_rescissions} (${s.total_closed > 0 ? fmtPct(s.total_rescissions / s.total_closed * 100) : '—'} of sales)`);
    }
  }

  if (data.leadData?.lead_performance?.length) {
    parts.push(`\n### Lead Performance by ABC Score`);
    data.leadData.lead_performance.forEach((l: any) => {
      parts.push(`- Score ${l.abc_score}: ${l.total_tours} tours, show ${fmtPct(l.show_rate_pct)}, close ${fmtPct(l.close_rate_pct)}, VPG ${fmtUSD(l.avg_vpg)}, rescission ${fmtPct(l.rescission_rate_pct)}`);
    });
  }

  if (data.roiData) {
    const r = data.roiData;
    parts.push(`\n### SPIFF ROI`);
    parts.push(`- Total SPIFF Cost: ${fmtUSD(r.total_spiff_cost)} | Incremental NSV: ${fmtK(r.incremental_nsv_estimate)}`);
    parts.push(`- ROI Ratio: ${r.roi_ratio}:1 (threshold: 3:1)`);
    if (!r.exceeds_threshold) parts.push(`  ⚠ [RISK FLAG] Below 3:1 minimum ROI threshold`);
  }

  if (data.accrualData) {
    const a = data.accrualData;
    parts.push(`\n### Accruals`);
    parts.push(`- Total Earned: ${fmtUSD(a.payout?.total_earned)} | Paid: ${fmtUSD(a.payout?.total_paid)}`);
    parts.push(`- Accrual to Book: ${fmtUSD(a.accrual_to_book)}`);
    parts.push(`- Open Reserve Liability: ${fmtUSD(a.open_reserve_liability)}`);
    parts.push(`- Payroll Lock Date: ${a.payroll_lock_date}`);
  }

  if (data.exposureData) {
    const e = data.exposureData;
    parts.push(`\n### Chargeback Exposure`);
    parts.push(`- Open Reserve: ${fmtUSD(e.totals?.open_reserve)} | Total Chargedback: ${fmtUSD(e.totals?.total_chargedback)}`);
  }

  parts.push(`\n### Financial Targets (dim_finance_period)`);
  if (data.costData?.var_comp_target_min_pct != null && data.costData?.var_comp_target_max_pct != null) {
    parts.push(`- Variable comp corridor: ${data.costData.var_comp_target_min_pct}% – ${data.costData.var_comp_target_max_pct}% of NSV`);
  }
  if (data.roiData?.roi_threshold != null) {
    parts.push(`- SPIFF ROI minimum: ${data.roiData.roi_threshold}:1 NSV:cost`);
  }
  if (data.accrualData?.accrual_basis) {
    parts.push(`- Accrual basis: ${data.accrualData.accrual_basis}`);
  }
  if (data.accrualData?.ffs_reserve_pct != null) {
    parts.push(`- FFS reserve: ${data.accrualData.ffs_reserve_pct}% held for rescission window`);
  }

  return parts.slice(0, 80).join('\n');
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export function FinancePage() {
  const { activePeriodId } = useAppContext();
  const { label: plainLabel, charts, enabled: plainEnglish } = usePlainLanguage();
  const [activeTab, setActiveTab] = useState<FinTab>('cost');
  const [loading, setLoading] = useState(false);
  const [loadSteps, setLoadSteps] = useState<LoadingStep[]>(() => initLoadingSteps([...FINANCE_LOAD_STEPS]));

  const periodId = activePeriodId ?? '2026-Q2';

  // Data states
  const [costData, setCostData]       = useState<any>(null);
  const [tourData, setTourData]       = useState<any>(null);
  const [leadData, setLeadData]       = useState<any>(null);
  const [roiData, setRoiData]         = useState<any>(null);
  const [exposureData, setExposureData] = useState<any>(null);
  const [accrualData, setAccrualData] = useState<any>(null);
  const [perfData, setPerfData]       = useState<any>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setLoadSteps(initLoadingSteps([...FINANCE_LOAD_STEPS]));

    const fetchStep = async (id: string, url: string) => {
      setLoadSteps((prev) => patchLoadingStep(prev, id, 'active'));
      try {
        const data = await fetch(url).then((r) => r.json());
        setLoadSteps((prev) => patchLoadingStep(prev, id, 'done'));
        return data;
      } catch (e) {
        setLoadSteps((prev) => patchLoadingStep(prev, id, 'error'));
        throw e;
      }
    };

    try {
      const [cost, tour, lead, roi, exposure, accrual, perf] = await Promise.all([
        fetchStep('cost', `/api/comp/finance/cost-summary?period_id=${periodId}`),
        fetchStep('tour', `/api/comp/finance/tour-quality?period_id=${periodId}`),
        fetchStep('lead', `/api/comp/finance/lead-performance?period_id=${periodId}`),
        fetchStep('roi', `/api/comp/finance/roi-analysis?period_id=${periodId}`),
        fetchStep('exposure', `/api/comp/finance/chargeback-exposure?period_id=${periodId}`),
        fetchStep('accrual', `/api/comp/finance/accrual-summary?period_id=${periodId}`),
        fetchStep('perf', `/api/comp/finance/pay-for-perf?period_id=${periodId}`),
      ]);
      setCostData(cost); setTourData(tour); setLeadData(lead);
      setRoiData(roi);   setExposureData(exposure); setAccrualData(accrual);
      setPerfData(perf);
    } catch (e) {
      console.error('FinancePage load error:', e);
    } finally {
      setLoading(false);
    }
  }, [periodId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Derived KPIs
  const varCompPct       = costData?.var_comp_pct_of_nsv ?? null;
  const varCompMax       = costData?.var_comp_target_max_pct ?? null;
  const totalCost        = costData?.totals?.total_comp ?? null;
  const openReserve      = exposureData?.totals?.open_reserve ?? null;
  const accrualToBook    = accrualData?.accrual_to_book ?? null;
  const varCompAtRisk    = varCompPct != null && varCompMax != null && varCompPct > varCompMax;
  const varCompTargetLabel = costData?.var_comp_target_min_pct != null && varCompMax != null
    ? `Target: ${costData.var_comp_target_min_pct}% – ${varCompMax}%`
    : 'Target from dim_finance_period';

  const copilotCtx = buildFinanceContext({ costData, tourData, leadData, roiData, exposureData, accrualData, perfData, periodId });

  const TABS: { id: FinTab; label: string; icon: React.ComponentType<any> }[] = [
    { id: 'cost',    label: plainLabel('Cost Analysis'),  icon: BarChart2 },
    { id: 'tours',   label: plainLabel('Tour Quality'),   icon: Activity },
    { id: 'spiff',   label: plainLabel('SPIFF / ROI'),    icon: Zap },
    { id: 'accruals', label: plainLabel('Accruals'),      icon: BookOpen },
  ];

  return (
    <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>

      {/* ── LEFT MAIN ── */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '1.5rem', position: 'relative', minHeight: '600px' }}>
        <LuxeDbLoader loading={loading} steps={loadSteps} title="Finance dashboard" />

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'linear-gradient(135deg, #0EA5E9 0%, #0284C7 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(14,165,233,0.35)',
            }}>
              <TrendingUp size={18} color="#fff" />
            </div>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--foreground)', margin: 0, lineHeight: 1.1 }}>
                Finance Intelligence Agent
              </h1>
              <div style={{ fontSize: 12, color: 'var(--foreground-muted)', marginTop: 2 }}>
                Cost of sales · Tour quality · VPG · SPIFF ROI · Accruals · Pay-for-performance
              </div>
            </div>
          </div>
          <button
            type="button" onClick={loadAll} disabled={loading}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.375rem',
              padding: '0.375rem 0.875rem', background: 'var(--bg-elevated)',
              border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
              fontSize: 11, fontWeight: 600, color: 'var(--foreground-muted)', cursor: 'pointer',
            }}
          >
            <RefreshCw size={12} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>

        {/* KPI Cards */}
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <KpiCard
            label="Var Comp % of NSV"
            value={fmtPct(varCompPct)}
            sub={varCompTargetLabel}
            icon={TrendingUp}
            accent={varCompAtRisk ? '#EF4444' : '#0EA5E9'}
            risk={varCompAtRisk}
            plainEnglish={plainEnglish}
          />
          <KpiCard
            label="Total Incentive Cost"
            value={fmtK(totalCost)}
            sub={`Budget: ${fmtK(costData?.budget_comp)} | Variance: ${fmtK(Math.abs(costData?.budget_variance ?? 0))} ${(costData?.budget_variance ?? 0) < 0 ? 'under' : 'over'}`}
            icon={DollarSign}
            accent="#0EA5E9"
            plainEnglish={plainEnglish}
          />
          <KpiCard
            label="Open Reserve Liability"
            value={fmtUSD(openReserve)}
            sub="From chargebacks & rescissions"
            icon={Shield}
            accent={openReserve > 300000 ? '#F59E0B' : '#10B981'}
            plainEnglish={plainEnglish}
          />
          <KpiCard
            label="Accrual to Book"
            value={fmtUSD(accrualToBook)}
            sub={accrualData?.payroll_lock_date ? `Lock: ${accrualData.payroll_lock_date}` : 'Lock date from dim_finance_period'}
            icon={Layers}
            accent="#8B5CF6"
            plainEnglish={plainEnglish}
          />
        </div>

        {/* Tabs */}
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)',
        }}>
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)', padding: '0 1.25rem' }}>
            {TABS.map(tab => {
              const isActive = activeTab === tab.id;
              return (
                <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} style={{
                  display: 'flex', alignItems: 'center', gap: '0.375rem',
                  padding: '0.75rem 1rem', fontSize: 12, fontWeight: 700,
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: isActive ? '#0EA5E9' : 'var(--foreground-muted)',
                  borderBottom: isActive ? '2px solid #0EA5E9' : '2px solid transparent',
                  transition: 'color 0.15s',
                }}>
                  <tab.icon size={13} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div style={{ padding: '1.5rem' }}>

            {/* COST ANALYSIS */}
            {activeTab === 'cost' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {/* Cost by role */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--foreground-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '1rem' }}>
                    Incentive Cost by Role
                  </div>
                  {costData?.by_role?.length ? (
                    <MiniBarChart rows={costData.by_role} labelKey="level_code" valueKey="total_comp" color={charts.colors.primary} labelFontSize={charts.labelFontSize} />
                  ) : (
                    <div style={{ color: 'var(--foreground-muted)', fontSize: 13 }}>Loading cost data…</div>
                  )}
                </div>

                {/* Summary table */}
                {costData?.by_role?.length && (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)' }}>
                          {['Role', 'Headcount', 'Total Comp', 'Avg Comp', 'Commission', 'Bonus'].map(h => (
                            <th key={h} style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--foreground-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {costData.by_role.map((row: any, i: number) => (
                          <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                          >
                            <td style={{ padding: '0.625rem 0.75rem', fontWeight: 700 }}>{row.level_code}</td>
                            <td style={{ padding: '0.625rem 0.75rem' }}>{row.headcount}</td>
                            <td style={{ padding: '0.625rem 0.75rem', fontWeight: 700, color: '#0EA5E9' }}>{fmtUSD(row.total_comp)}</td>
                            <td style={{ padding: '0.625rem 0.75rem' }}>{fmtUSD(row.avg_comp)}</td>
                            <td style={{ padding: '0.625rem 0.75rem' }}>{fmtUSD(row.total_commission)}</td>
                            <td style={{ padding: '0.625rem 0.75rem' }}>{fmtUSD(row.total_bonus)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Pay-for-performance section */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--foreground-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '1rem' }}>
                    Pay-for-Performance
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)' }}>
                          {['Rep', 'Level', 'Total Earnings', 'Attainment', 'Tours', 'Avg VPG', 'Earn/Sale', 'Risk'].map(h => (
                            <th key={h} style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--foreground-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(perfData?.reps ?? []).map((rep: any, i: number) => {
                          const vpgOk = !rep.vpg || Number(rep.vpg) >= 900;
                          const attainOk = Number(rep.attainment_pct) >= 80;
                          const isAtRisk = !vpgOk && Number(rep.total_earnings) > 30000;
                          return (
                            <tr key={rep.rep_id ?? i} style={{ borderBottom: '1px solid var(--border)' }}
                              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
                              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                            >
                              <td style={{ padding: '0.625rem 0.75rem', fontWeight: 700 }}>{rep.rep_name}</td>
                              <td style={{ padding: '0.625rem 0.75rem', color: 'var(--foreground-muted)' }}>{rep.level_code}</td>
                              <td style={{ padding: '0.625rem 0.75rem', fontWeight: 700, color: '#0EA5E9' }}>{fmtUSD(rep.total_earnings)}</td>
                              <td style={{ padding: '0.625rem 0.75rem' }}>
                                <span style={{ fontWeight: 700, color: attainOk ? '#10B981' : '#F59E0B' }}>{fmtPct(rep.attainment_pct)}</span>
                              </td>
                              <td style={{ padding: '0.625rem 0.75rem' }}>{rep.tour_stats?.tour_count ?? '—'}</td>
                              <td style={{ padding: '0.625rem 0.75rem', fontWeight: 600, color: vpgOk ? 'var(--foreground)' : '#EF4444' }}>
                                {rep.vpg ? fmtUSD(rep.vpg) : '—'}
                              </td>
                              <td style={{ padding: '0.625rem 0.75rem' }}>{rep.earnings_per_sale ? fmtUSD(rep.earnings_per_sale) : '—'}</td>
                              <td style={{ padding: '0.625rem 0.75rem' }}>
                                {isAtRisk
                                  ? <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 100, background: 'rgba(239,68,68,0.12)', color: '#EF4444' }}>⚠ HIGH</span>
                                  : <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 100, background: 'rgba(16,185,129,0.12)', color: '#10B981' }}>OK</span>
                                }
                              </td>
                            </tr>
                          );
                        })}
                        {!perfData?.reps?.length && (
                          <tr><td colSpan={8} style={{ padding: '2rem', textAlign: 'center', color: 'var(--foreground-muted)' }}>Loading performance data…</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TOUR QUALITY */}
            {activeTab === 'tours' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {/* Summary strip */}
                {tourData?.summary && (() => {
                  const s = tourData.summary;
                  const showRate = s.total_tours > 0 ? (s.total_showed / s.total_tours * 100).toFixed(1) : '—';
                  const closeRate = s.total_showed > 0 ? (s.total_closed / s.total_showed * 100).toFixed(1) : '—';
                  const rescRate = s.total_closed > 0 ? (s.total_rescissions / s.total_closed * 100).toFixed(1) : '—';
                  return (
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                      {[
                        { label: 'Total Tours', value: fmt(s.total_tours) },
                        { label: 'Show Rate', value: `${showRate}%` },
                        { label: 'Close Rate', value: `${closeRate}%` },
                        { label: 'Overall VPG', value: fmtUSD(s.overall_vpg), accent: '#0EA5E9' },
                        { label: 'Total NSV', value: fmtK(s.total_nsv), accent: '#10B981' },
                        { label: 'Rescission Rate', value: `${rescRate}%`, accent: Number(rescRate) > 10 ? '#EF4444' : 'var(--foreground)' },
                      ].map(item => (
                        <div key={item.label} style={{
                          flex: 1, minWidth: 100, padding: '0.75rem 1rem',
                          background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10,
                          textAlign: 'center',
                        }}>
                          <div style={{ fontSize: 10, color: 'var(--foreground-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{item.label}</div>
                          <div style={{ fontSize: 16, fontWeight: 800, color: (item as any).accent ?? 'var(--foreground)' }}>{item.value}</div>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {/* Tour quality matrix */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--foreground-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.875rem' }}>
                    Lead Source × ABC Score Matrix
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid var(--border)' }}>
                          {['Lead Source', 'Score', 'Tours', 'Showed', 'Closed', 'Close %', 'Avg VPG', 'Total NSV', 'Rescissions', 'Avg EBITDA'].map(h => (
                            <th key={h} style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--foreground-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(tourData?.matrix ?? []).map((row: any, i: number) => {
                          const closeRate = Number(row.showed_count) > 0 ? (Number(row.closed_count) / Number(row.showed_count) * 100).toFixed(1) : '—';
                          return (
                            <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}
                              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
                              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                            >
                              <td style={{ padding: '0.625rem 0.75rem', fontWeight: 600 }}>{row.lead_source}</td>
                              <td style={{ padding: '0.625rem 0.75rem' }}><AbcBadge score={row.abc_score} /></td>
                              <td style={{ padding: '0.625rem 0.75rem' }}>{fmt(row.tour_count)}</td>
                              <td style={{ padding: '0.625rem 0.75rem' }}>{fmt(row.showed_count)}</td>
                              <td style={{ padding: '0.625rem 0.75rem' }}>{fmt(row.closed_count)}</td>
                              <td style={{ padding: '0.625rem 0.75rem', fontWeight: 700, color: Number(closeRate) >= 30 ? '#10B981' : Number(closeRate) >= 20 ? '#F59E0B' : '#EF4444' }}>
                                {closeRate === '—' ? '—' : `${closeRate}%`}
                              </td>
                              <td style={{ padding: '0.625rem 0.75rem', fontWeight: 600, color: '#0EA5E9' }}>{row.avg_vpg ? fmtUSD(row.avg_vpg) : '—'}</td>
                              <td style={{ padding: '0.625rem 0.75rem' }}>{fmtK(row.total_nsv)}</td>
                              <td style={{ padding: '0.625rem 0.75rem', color: Number(row.rescission_count) > 0 ? '#EF4444' : 'var(--foreground-muted)' }}>{fmt(row.rescission_count)}</td>
                              <td style={{ padding: '0.625rem 0.75rem' }}>{row.avg_ebitda ? fmtUSD(row.avg_ebitda) : '—'}</td>
                            </tr>
                          );
                        })}
                        {!tourData?.matrix?.length && (
                          <tr><td colSpan={10} style={{ padding: '2rem', textAlign: 'center', color: 'var(--foreground-muted)' }}>Loading tour quality data…</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Lead performance by ABC */}
                {leadData?.lead_performance?.length && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--foreground-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.875rem' }}>
                      Lead Funnel Yield by ABC Score
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                      {leadData.lead_performance.map((lead: any) => {
                        const cfg = ABC_COLORS[lead.abc_score] ?? { bg: 'rgba(107,114,128,0.1)', color: '#6B7280' };
                        return (
                          <div key={lead.abc_score} style={{
                            flex: 1, minWidth: 160, padding: '1rem 1.25rem',
                            background: cfg.bg, border: `1px solid ${cfg.color}30`,
                            borderRadius: 12,
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                              <AbcBadge score={lead.abc_score} />
                              <span style={{ fontSize: 11, color: 'var(--foreground-muted)', fontWeight: 600 }}>{lead.total_tours} tours</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                              {[
                                { label: 'Show Rate', value: fmtPct(lead.show_rate_pct) },
                                { label: 'Close Rate', value: fmtPct(lead.close_rate_pct) },
                                { label: 'Avg VPG', value: fmtUSD(lead.avg_vpg) },
                                { label: 'Rescission %', value: fmtPct(lead.rescission_rate_pct) },
                                { label: 'Total NSV', value: fmtK(lead.total_nsv) },
                              ].map(item => (
                                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ fontSize: 11, color: 'var(--foreground-muted)' }}>{item.label}</span>
                                  <span style={{ fontSize: 12, fontWeight: 700, color: cfg.color }}>{item.value}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* SPIFF / ROI */}
            {activeTab === 'spiff' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {roiData && (
                  <>
                    {/* ROI summary */}
                    <div style={{
                      background: roiData.exceeds_threshold ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                      border: `1px solid ${roiData.exceeds_threshold ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                      borderRadius: 12, padding: '1.25rem',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.875rem' }}>
                        <span style={{
                          fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 100,
                          background: roiData.exceeds_threshold ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                          color: roiData.exceeds_threshold ? '#10B981' : '#EF4444',
                        }}>
                          {roiData.exceeds_threshold ? '✓ ROI THRESHOLD MET' : '⚠ BELOW ROI THRESHOLD'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                        {[
                          { label: 'Total SPIFF Cost', value: fmtUSD(roiData.total_spiff_cost) },
                          { label: 'Incremental NSV', value: fmtK(roiData.incremental_nsv_estimate) },
                          { label: 'ROI Ratio', value: `${roiData.roi_ratio}:1` },
                          { label: 'Threshold', value: `${roiData.roi_threshold}:1` },
                          { label: 'SPIFF Events', value: fmt(roiData.spiff_count) },
                        ].map(item => (
                          <div key={item.label}>
                            <div style={{ fontSize: 10, color: 'var(--foreground-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{item.label}</div>
                            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--foreground)' }}>{item.value}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* SPIFF events table */}
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--foreground-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.875rem' }}>
                        SPIFF Events — {periodId}
                      </div>
                      {roiData.spiff_events?.length ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {roiData.spiff_events.map((ev: any, i: number) => (
                            <div key={ev.event_id ?? i} style={{
                              display: 'flex', alignItems: 'center', gap: '1rem',
                              padding: '0.75rem 1rem', background: 'var(--bg-elevated)',
                              border: '1px solid var(--border)', borderRadius: 10, flexWrap: 'wrap',
                            }}>
                              <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 100, background: 'rgba(139,92,246,0.15)', color: '#8B5CF6', flexShrink: 0 }}>
                                {ev.event_type}
                              </span>
                              <span style={{ fontSize: 12, fontWeight: 600, flex: 1 }}>{ev.reason}</span>
                              <span style={{ fontSize: 13, fontWeight: 800, color: '#8B5CF6', flexShrink: 0 }}>
                                {ev.amount != null ? fmtUSD(ev.amount) : '—'}
                              </span>
                              {ev.attributed_nsv != null && (
                                <span style={{ fontSize: 11, color: '#10B981', flexShrink: 0 }}>
                                  NSV: {fmtK(ev.attributed_nsv)}
                                </span>
                              )}
                              <span style={{ fontSize: 11, color: 'var(--foreground-muted)', flexShrink: 0 }}>
                                Rep: {ev.rep_id}
                              </span>
                              {ev.approved_by && (
                                <span style={{ fontSize: 10, color: 'var(--foreground-muted)', flexShrink: 0 }}>
                                  ✓ {ev.approved_by}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ color: 'var(--foreground-muted)', fontSize: 13 }}>No SPIFF events found for {periodId}.</div>
                      )}
                    </div>

                    {/* Threshold guidance */}
                    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10, padding: '1rem 1.25rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.625rem' }}>
                        <Info size={14} color="#0EA5E9" />
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#0EA5E9', textTransform: 'uppercase', letterSpacing: '0.06em' }}>SPIFF Approval Thresholds</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                        {[
                          { tier: '< $5,000',        approver: 'Auto-Approved' },
                          { tier: '$5,000 – $14,999', approver: 'Regional Director' },
                          { tier: '$15,000 – $29,999', approver: 'VP Compensation' },
                          { tier: '≥ $30,000',        approver: 'EVP Operations' },
                        ].map(t => (
                          <div key={t.tier} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                            <span style={{ fontWeight: 600, color: 'var(--foreground)' }}>{t.tier}</span>
                            <span style={{ color: 'var(--foreground-muted)' }}>{t.approver}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ACCRUALS */}
            {activeTab === 'accruals' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {accrualData && (
                  <>
                    {/* Accrual summary */}
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                      {[
                        { label: 'Total Commission Earned', value: fmtUSD(accrualData.payout?.total_commission), accent: '#0EA5E9' },
                        { label: 'Total Bonus Earned', value: fmtUSD(accrualData.payout?.total_bonus), accent: '#8B5CF6' },
                        { label: 'Total Earned', value: fmtUSD(accrualData.payout?.total_earned), accent: '#10B981' },
                        { label: 'Total Paid', value: fmtUSD(accrualData.payout?.total_paid), accent: 'var(--foreground)' },
                        { label: 'Accrual to Book', value: fmtUSD(accrualData.accrual_to_book), accent: '#F59E0B' },
                        { label: 'Open Reserve', value: fmtUSD(accrualData.open_reserve_liability), accent: '#EF4444' },
                      ].map(item => (
                        <div key={item.label} style={{
                          flex: 1, minWidth: 150, padding: '0.875rem 1rem',
                          background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10,
                        }}>
                          <div style={{ fontSize: 10, color: 'var(--foreground-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{item.label}</div>
                          <div style={{ fontSize: 18, fontWeight: 800, color: item.accent }}>{item.value}</div>
                        </div>
                      ))}
                    </div>

                    {/* Chargeback exposure */}
                    {exposureData?.by_status?.length && (
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--foreground-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.875rem' }}>
                          Chargeback Exposure by Status
                        </div>
                        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                          {exposureData.by_status.map((row: any) => {
                            const cfg = { OPEN: '#EF4444', CLOSED: '#10B981', PENDING: '#F59E0B' } as Record<string, string>;
                            const color = cfg[row.status] ?? '#6B7280';
                            return (
                              <div key={row.status} style={{
                                flex: 1, minWidth: 160, padding: '1rem 1.25rem',
                                background: `${color}10`, border: `1px solid ${color}30`, borderRadius: 12,
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.625rem' }}>
                                  <span style={{ fontSize: 12, fontWeight: 800, color }}>{row.status}</span>
                                  <span style={{ fontSize: 11, color: 'var(--foreground-muted)' }}>{row.count} records</span>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                                    <span style={{ color: 'var(--foreground-muted)' }}>Chargedback</span>
                                    <span style={{ fontWeight: 700, color }}>{fmtUSD(row.chargeback_amount)}</span>
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                                    <span style={{ color: 'var(--foreground-muted)' }}>Reserve Held</span>
                                    <span style={{ fontWeight: 700 }}>{fmtUSD(row.reserve_held)}</span>
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                                    <span style={{ color: 'var(--foreground-muted)' }}>Released</span>
                                    <span style={{ fontWeight: 700, color: '#10B981' }}>{fmtUSD(row.reserve_released)}</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Accrual rules */}
                    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10, padding: '1rem 1.25rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.625rem' }}>
                        <Info size={14} color="#0EA5E9" />
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#0EA5E9', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Accrual Policy</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: 12, color: 'var(--foreground-muted)' }}>
                        <div>• Basis: {accrualData.accrual_basis ?? '—'}</div>
                        <div>• Payroll lock date: {accrualData.payroll_lock_date ?? '—'}</div>
                        {accrualData.ffs_reserve_pct != null && (
                          <div>• FFS reserve: {accrualData.ffs_reserve_pct}% held for 6-month rescission window</div>
                        )}
                        {accrualData.accrual_policy_notes && (
                          <div>• {accrualData.accrual_policy_notes}</div>
                        )}
                      </div>
                    </div>
                  </>
                )}
                {!accrualData && (
                  <div style={{ color: 'var(--foreground-muted)', fontSize: 13, padding: '2rem', textAlign: 'center' }}>Loading accrual data…</div>
                )}
              </div>
            )}

          </div>
        </div>
      </div>

      {/* ── RIGHT: COPILOT ── */}
      <div style={{ width: 380, flexShrink: 0, position: 'sticky', top: 72 }}>
        <CompCopilot
          title="Finance Intelligence Agent"
          description="Ask about cost of sales, VPG, tour quality, SPIFF ROI, accruals, chargeback exposure, or scenario modeling."
          personaLabel="Finance"
          dataContext={copilotCtx}
          examplePrompts={FINANCE_PROMPTS}
          contextLoading={loading}
        />
      </div>

    </div>
  );
}
