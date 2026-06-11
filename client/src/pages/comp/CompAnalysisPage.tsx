import {
  Badge,
} from '@databricks/appkit-ui/react';
import { ArrowRightLeft, Calculator, CheckCircle2, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { buildIndustryGapAssessment, getGapStatus, normalizeIndustryBenchmarkRows } from '@shared/benchmarkGrounding';
import { CompCopilot } from '@/components/comp/CompCopilot';
import { CompInterpretationPanel } from '@/components/comp/CompInterpretationPanel';
import { KpiCard } from '@/components/comp/KpiCard';
import { LuxeDbLoader } from '@/components/comp/LuxeDbLoader';
import { deriveLoadingSteps } from '@/lib/loadingSteps';
import { LOADING } from '@/lib/loadingStepLabels';
import { formatCompactCurrency, formatQueryError } from '@/lib/compFormat';
import { projectScenario } from '@shared/scenarioProjection';
import {
  formatCommissionRate,
  formatQuotaDelta,
  formatTourDelta,
  QUOTA_SLIDER,
  quotaDeltaUsdFromPct,
  quotaPctFromDeltaUsd,
  TOUR_SLIDER,
  tourDeltaFromPct,
  tourPctFromDelta,
} from '@shared/scenarioLeverUnits';
import { useAppContext } from '@/context/AppContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScenarioRecord {
  scenario_id: string;
  scenario_name: string;
  period_id: string;
  quota_change_pct: string | number;
  commission_rate_pct: string | number;
  bonus_rate_change_pct: string | number;
  accelerator_change_pct: string | number;
  tour_volume_change_pct: string | number;
  conversion_rate_change_pct: string | number;
  created_by: string;
  projected_payouts: string | number;
  budget_impact: string | number;
  projected_cost: string | number;
  expected_performance_pct: string | number;
}

const n = (v: string | number) => Number(v ?? 0);

// ─── Slider helper ────────────────────────────────────────────────────────────
interface SliderProps {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  formatValue?: (v: number) => string;
  color?: string;
  helpText?: string;
  onChange: (v: number) => void;
}

const SLIDER_HELP = {
  quota:
    'Adjusts each rep\'s sales goal in $50K steps (vs a $1M planning baseline). Higher quota = harder to hit accelerators but lowers total comp cost. After saving, compare "Expected performance" and "Budget impact" in the matrix below.',
  commission:
    'Sets the actual commission % paid on closed deals (not a percent change). Default plan is 6%. Higher rate increases rep pay and budget cost.',
  tourVolume:
    'Adds or removes tours in 100-tour steps (vs a 2,000-tour planning baseline per period). Affects tour-credit pay and downstream sales volume.',
} as const;

function Slider({ id, label, value, min, max, step, formatValue, color = 'bg-primary', helpText, onChange }: SliderProps) {
  const pct = ((value - min) / (max - min)) * 100;
  const display = formatValue ? formatValue(value) : String(value);
  const minLabel = formatValue ? formatValue(min) : String(min);
  const maxLabel = formatValue ? formatValue(max) : String(max);
  const zeroLabel = formatValue ? formatValue(0) : '0';
  return (
    <div
      className="rounded-xl border space-y-3"
      style={{ padding: '1.25rem 1.375rem', borderColor: '#e2e8f0', background: '#fafbfc' }}
    >
      <div className="flex items-center justify-between text-xs">
        <label htmlFor={id} className="font-semibold text-foreground">{label}</label>
        <span className={`rounded-full px-2.5 py-0.5 font-semibold tabular-nums ${
          value > 0 ? 'bg-primary/10 text-primary' : value < 0 ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'
        }`}>
          {display}
        </span>
      </div>
      <div className="relative h-2.5 rounded-full bg-muted/80">
        <div
          className={`absolute left-0 top-0 h-2.5 rounded-full ${color} transition-all`}
          style={{ width: `${pct}%` }}
        />
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 h-2.5 w-full cursor-pointer opacity-0"
        />
      </div>
      <div className="flex justify-between text-[9px] text-muted-foreground tabular-nums">
        <span>{minLabel}</span>
        <span>{zeroLabel}</span>
        <span>{maxLabel}</span>
      </div>
      {helpText && (
        <p className="text-[11px] leading-relaxed text-muted-foreground border-t pt-3" style={{ borderColor: '#e8edf2' }}>
          {helpText}
        </p>
      )}
    </div>
  );
}

// ─── Scenario Badge ───────────────────────────────────────────────────────────
const BUILTIN = [
  'SCN-BASELINE',
  'SCN-SIM-01',
  'SCN-PLAN-A',
  'SCN-COMP-MIX',
  'SCN-TELE-ACCEL',
  'SCN-TRAINER-REB',
  'SCN-FFS-SPIFF',
  'SCN-AL-RAMP',
  'SCN-DIAMOND-TRANS',
  'SCN-BLUEGREEN-H',
  'SCN-OWNER-SPIFF',
  'SCN-FL-DRIVE'
];

function ScenarioTag({ s }: { s: ScenarioRecord }) {
  const isBuiltin = BUILTIN.includes(s.scenario_id);
  return (
    <Badge variant={isBuiltin ? 'secondary' : 'outline'} className="font-mono text-[10px] font-normal">
      {s.scenario_id}
    </Badge>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function CompAnalysisPage() {
  const { activePeriodId, activePersonaId } = useAppContext();
  const isMarketingDirector = activePersonaId === 'marketing_director';
  const isMarketingManager = activePersonaId === 'marketing_manager';
  /** Director + sales leaders: quota & commission. Marketing manager: tour volume only. */
  const canAdjustQuotaAndCommission = !isMarketingManager;
  const benchmarkPeriodId = activePeriodId || '2026-Q2';
  const [scenarios, setScenarios] = useState<ScenarioRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [industryBenchmarks, setIndustryBenchmarks] = useState<Record<string, unknown>[]>([]);
  const [benchmarksLoading, setBenchmarksLoading] = useState(true);
  const [benchmarksError, setBenchmarksError] = useState<string | null>(null);

  // Scenarios selected for comparison (up to 4)
  const [selected, setSelected] = useState<string[]>(['SCN-BASELINE', 'SCN-SIM-01']);

  // Industry competitive market standards benchmarks & annotations
  const [benchmarkScenarioId, setBenchmarkScenarioId] = useState<string>('SCN-BASELINE');
  
  const [directorNoiWeights, setDirectorNoiWeights] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem('hgv_noi_weights');
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return {
      'SCN-BASELINE': 30,
      'SCN-SIM-01': 50,
      'SCN-PLAN-A': 75,
      'SCN-COMP-MIX': 40,
      'SCN-TELE-ACCEL': 30,
      'SCN-TRAINER-REB': 10,
      'SCN-FFS-SPIFF': 30,
      'SCN-AL-RAMP': 25,
      'SCN-DIAMOND-TRANS': 50,
      'SCN-BLUEGREEN-H': 45,
      'SCN-OWNER-SPIFF': 30,
      'SCN-FL-DRIVE': 50,
    };
  });

  const [annotations, setAnnotations] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('hgv_scenario_annotations');
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return {
      'SCN-BASELINE': 'Current operating plan. Below-market base salary gaps create high attrition risk.',
      'SCN-SIM-01': 'Q2 strategy recommendation: rebalance pay-mix volatility and improve quota targets.',
      'SCN-PLAN-A': 'Optimal alignment plan. Raises base salary mixes to competitor levels and increases NOI profitability weight.',
      'SCN-COMP-MIX': 'Scenario D - Competitor Mix (60/40 Shift): Models competitor base/variable ratios to protect seller earnings stability.',
      'SCN-TELE-ACCEL': 'Scenario E - Telemarketing Booking Acceleration: Boosts outbound package commissions by 1% to stimulate Q2 tour flow.',
      'SCN-TRAINER-REB': 'Scenario F - Sales Trainer Pay Mix Rebalance (90/10): Aligns trainer compensation with standard industry benchmarks.',
      'SCN-FFS-SPIFF': 'Scenario G - FFS SPIFF Accelerator Boost: Increases target FFS commission multipliers to capture higher package conversions.',
      'SCN-AL-RAMP': 'Scenario H - Action Line New Hire Ramp Pay Protection: Introduces a 3-month guaranteed commission draw to reduce attrition.',
      'SCN-DIAMOND-TRANS': 'Scenario I - Diamond Brand Integration Harmonizer: Standardizes regional commission structures across integrated Diamond resort sites.',
      'SCN-BLUEGREEN-H': 'Scenario J - Bluegreen Vacations Uniform Commission: Implements unified pay scales for onboarded Bluegreen sales executives.',
      'SCN-OWNER-SPIFF': 'Scenario K - High-Value Owner Referral SPIFF Plan: Authorizes premium commission splits for owner-referred high-VPG tours.',
      'SCN-FL-DRIVE': 'Scenario L - Frontline Seller Drive Performance Accelerator: Increases standard accelerators by 12% to boost closed transaction volume.',
    };
  });

  const updateNoiWeight = (id: string, val: number) => {
    setDirectorNoiWeights(prev => {
      const next = { ...prev, [id]: val };
      localStorage.setItem('hgv_noi_weights', JSON.stringify(next));
      return next;
    });
  };

  const updateAnnotation = (id: string, val: string) => {
    setAnnotations(prev => {
      const next = { ...prev, [id]: val };
      localStorage.setItem('hgv_scenario_annotations', JSON.stringify(next));
      return next;
    });
  };

  // Create scenario form
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    quota_delta_usd: 0,
    commission_rate_pct: 6.0,
    bonus_rate_change_pct: 0,
    accelerator_change_pct: 0,
    tour_delta: 0,
    conversion_rate_change_pct: 0,
    director_noi_weight: 30,
    annotation: '',
  });
  const nameRef = useRef<HTMLInputElement>(null);

  // Delete state
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchScenarios = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/comp/scenarios');
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as ScenarioRecord[];
      setScenarios(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load scenarios');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchIndustryBenchmarks = useCallback(async () => {
    setBenchmarksLoading(true);
    setBenchmarksError(null);
    try {
      const res = await fetch(`/api/comp/benchmarks/industry?period_id=${encodeURIComponent(benchmarkPeriodId)}`);
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      setIndustryBenchmarks((await res.json()) as Record<string, unknown>[]);
    } catch (err) {
      setBenchmarksError(err instanceof Error ? err.message : 'Failed to load industry benchmarks');
    } finally {
      setBenchmarksLoading(false);
    }
  }, [benchmarkPeriodId]);

  const refreshAll = useCallback(async () => {
    await Promise.all([fetchScenarios(), fetchIndustryBenchmarks()]);
  }, [fetchScenarios, fetchIndustryBenchmarks]);

  useEffect(() => { void refreshAll(); }, [refreshAll]);

  useEffect(() => {
    if (!showCreate || !isMarketingManager) return;
    setForm((f) => ({
      ...f,
      quota_delta_usd: 0,
      commission_rate_pct: 6.0,
      bonus_rate_change_pct: 0,
      accelerator_change_pct: 0,
      conversion_rate_change_pct: 0,
    }));
  }, [showCreate, isMarketingManager]);

  useEffect(() => {
    if (!showCreate) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [showCreate]);

  const pageLoading = loading;
  const pageError = error;
  const benchmarksUnavailable = !benchmarksLoading && !!benchmarksError;

  const loaderSteps = useMemo(
    () =>
      deriveLoadingSteps([
        {
          id: 'scenarios',
          label: LOADING.scenarios,
          loading,
          done: scenarios.length > 0,
          error: !!error,
        },
      ]),
    [loading, scenarios.length, error],
  );

  // Keep selected in sync with available scenarios
  useEffect(() => {
    if (scenarios.length === 0) return;
    const ids = new Set(scenarios.map((s) => s.scenario_id));
    setSelected((prev) => {
      const current = prev.filter((id) => ids.has(id));
      if (current.length === 0) {
        return ['SCN-BASELINE', 'SCN-SIM-01'].filter(id => ids.has(id));
      }
      return current;
    });
  }, [scenarios]);

  // Keep benchmarkScenarioId in sync with selected scenarios
  useEffect(() => {
    if (selected.length > 0 && !selected.includes(benchmarkScenarioId)) {
      setBenchmarkScenarioId(selected[0]);
    }
  }, [selected, benchmarkScenarioId]);

  function toggleSelect(id: string) {
    setSelected((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length >= 4
        ? prev
        : [...prev, id]
    );
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { nameRef.current?.focus(); return; }
    const id = `SCN-${form.name.trim().toUpperCase().replace(/[^A-Z0-9]/g, '-').slice(0, 12)}-${Date.now().toString(36).slice(-4).toUpperCase()}`;
    setCreating(true);
    setCreateError(null);
    try {
      const quota = isMarketingManager ? 0 : quotaPctFromDeltaUsd(form.quota_delta_usd);
      const commission = isMarketingManager ? 6.0 : form.commission_rate_pct;
      const tourPct = tourPctFromDelta(form.tour_delta);
      const res = await fetch('/api/comp/scenarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenario_id: id,
          scenario_name: form.name.trim(),
          quota_change_pct: quota,
          commission_rate_pct: commission,
          bonus_rate_change_pct: 0,
          accelerator_change_pct: 0,
          tour_volume_change_pct: tourPct,
          conversion_rate_change_pct: 0,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      updateNoiWeight(id, form.director_noi_weight);
      updateAnnotation(id, form.annotation);
      await fetchScenarios();
      setShowCreate(false);
      setForm({ name: '', quota_delta_usd: 0, commission_rate_pct: 6.0, bonus_rate_change_pct: 0, accelerator_change_pct: 0, tour_delta: 0, conversion_rate_change_pct: 0, director_noi_weight: 30, annotation: '' });
      // Auto-select the new scenario
      setSelected((prev) => (prev.length < 4 ? [...prev, id] : prev));
      setBenchmarkScenarioId(id);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    if (deleting) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/comp/scenarios/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      await fetchScenarios();
      setSelected((prev) => prev.filter((x) => x !== id));
    } catch {
      // ignore — keep scenario in list
    } finally {
      setDeleting(null);
    }
  }

  const selectedScenarios = useMemo(
    () => selected.map((id) => scenarios.find((s) => s.scenario_id === id)).filter(Boolean) as ScenarioRecord[],
    [selected, scenarios]
  );

  const dataContext = useMemo(() => {
    if (selectedScenarios.length === 0) return '';
    return selectedScenarios
      .map((s) =>
        [
          `## Scenario: ${s.scenario_name} (${s.scenario_id})`,
          `- Quota adjustment: ${formatQuotaDelta(quotaDeltaUsdFromPct(n(s.quota_change_pct)))}`,
          `- Commission rate: ${formatCommissionRate(n(s.commission_rate_pct))}`,
          `- Bonus rate change: ${n(s.bonus_rate_change_pct) > 0 ? '+' : ''}${n(s.bonus_rate_change_pct)}%`,
          `- Accelerator change: ${n(s.accelerator_change_pct) > 0 ? '+' : ''}${n(s.accelerator_change_pct)}%`,
          `- Tour volume adjustment: ${formatTourDelta(tourDeltaFromPct(n(s.tour_volume_change_pct)))}`,
          `- Conversion rate change: ${n(s.conversion_rate_change_pct) > 0 ? '+' : ''}${n(s.conversion_rate_change_pct)}%`,
          `- Projected payouts: $${n(s.projected_payouts).toLocaleString()}`,
          `- Budget impact vs baseline: $${n(s.budget_impact).toLocaleString()}`,
          `- Expected team performance: ${n(s.expected_performance_pct)}%`,
        ].join('\n')
      )
      .join('\n\n');
  }, [selectedScenarios]);

  const scenarioInterpretationContext = useMemo(() => {
    if (selectedScenarios.length === 0) return '';
    const baseline = scenarios.find((s) => s.scenario_id === 'SCN-BASELINE');
    return [
      'Baseline reference: $14.2M projected payouts (SCN-BASELINE). All budget impacts are vs this baseline.',
      baseline
        ? `Baseline stored: projected $${n(baseline.projected_payouts).toLocaleString()}, performance ${n(baseline.expected_performance_pct)}%`
        : '',
      '',
      dataContext,
    ]
      .filter(Boolean)
      .join('\n\n');
  }, [selectedScenarios, scenarios, dataContext]);

  // Live projection preview (client-side formula mirrors server)
  const preview = useMemo(() => {
    const quota = isMarketingManager ? 0 : quotaPctFromDeltaUsd(form.quota_delta_usd);
    const commission = isMarketingManager ? 6.0 : form.commission_rate_pct;
    const proj = projectScenario(
      quota,
      commission,
      0,
      0,
      tourPctFromDelta(form.tour_delta),
      0,
    );
    return { projected: proj.projected_payouts, impact: proj.budget_impact, perf: proj.expected_performance_pct };
  }, [form, isMarketingManager]);

  return (
    <>
      <div className="space-y-6 animate-fade-in-up hgv-scenario-modeler">

      {pageLoading && (
        <LuxeDbLoader loading steps={loaderSteps} title="Compensation analysis" />
      )}

      {pageError && (
        <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <X className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">Failed to load compensation analysis data</p>
            <p className="text-xs opacity-80">{formatQueryError(pageError)}</p>
            <button type="button" onClick={() => void refreshAll()} className="mt-2 text-xs underline">Retry</button>
          </div>
        </div>
      )}

      {!pageLoading && !pageError && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
          {benchmarksUnavailable && (
            <div className="lg:col-span-2 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800">
              <X className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-semibold">Industry benchmarks could not be refreshed from the warehouse</p>
                <p className="text-xs opacity-80">{formatQueryError(benchmarksError)}</p>
                <button type="button" onClick={() => void fetchIndustryBenchmarks()} className="mt-1 text-xs underline">Retry benchmarks</button>
              </div>
            </div>
          )}
          <div className="space-y-6">
            {/* Scenario Library */}
            <div
              className="rounded-2xl border bg-white space-y-4 shadow-sm"
              style={{ padding: '1.75rem 1.5rem', borderColor: '#e2e8f0' }}
            >
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <h4 className="text-sm font-bold text-foreground">Scenario Library</h4>
                  <p className="text-[11px] font-medium text-muted-foreground">
                    Select up to 4 scenarios to compare. Saved to{' '}
                    <code className="rounded-md bg-primary/10 text-primary px-1.5 py-0.5 text-[10px] font-mono">workspace.hgv_comp.scenario_run</code>
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void refreshAll()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-glass-border bg-muted/20 px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground hover:bg-muted/40 transition-colors"
                  >
                    <RotateCcw className="h-3 w-3" /> Refresh
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreate(true)}
                    id="btn-add-scenario"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground shadow-sm shadow-primary/30 hover:bg-primary/90 hover:scale-[1.02] active:scale-[0.98] transition-all"
                  >
                    <Plus className="h-3.5 w-3.5" /> New Model
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {scenarios.map((s) => {
                  const isSelected = selected.includes(s.scenario_id);
                  const isBuiltin = BUILTIN.includes(s.scenario_id);
                  const isDeleting = deleting === s.scenario_id;
                  return (
                    <div
                      key={s.scenario_id}
                      className={`flex items-center gap-3 rounded-xl border transition-all ${
                        isSelected
                          ? 'border-primary/40 bg-primary/8'
                          : 'border-glass-border hover:border-primary/20 hover:bg-card/40'
                      }`}
                      style={{ padding: '1.25rem 1.5rem' }}
                    >
                      <button
                        type="button"
                        onClick={() => toggleSelect(s.scenario_id)}
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-all ${
                          isSelected ? 'border-primary bg-primary text-primary-foreground shadow-sm shadow-primary/30' : 'border-glass-border bg-card/30'
                        }`}
                        aria-label={`${isSelected ? 'Deselect' : 'Select'} ${s.scenario_name}`}
                        disabled={!isSelected && selected.length >= 4}
                      >
                        {isSelected && <CheckCircle2 className="h-3.5 w-3.5" />}
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="text-sm font-bold text-foreground">{s.scenario_name}</p>
                          <ScenarioTag s={s} />
                          {isBuiltin && <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wide">Built-in</span>}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground tabular-nums font-medium">
                          <span>Quota {formatQuotaDelta(quotaDeltaUsdFromPct(n(s.quota_change_pct)))}</span>
                          <span>Comm {formatCommissionRate(n(s.commission_rate_pct))}</span>
                          <span>Bonus {n(s.bonus_rate_change_pct) >= 0 ? '+' : ''}{n(s.bonus_rate_change_pct)}%</span>
                          <span>Accel {n(s.accelerator_change_pct) >= 0 ? '+' : ''}{n(s.accelerator_change_pct)}%</span>
                          <span>Tours {formatTourDelta(tourDeltaFromPct(n(s.tour_volume_change_pct)))}</span>
                          <span>Conv {n(s.conversion_rate_change_pct) >= 0 ? '+' : ''}{n(s.conversion_rate_change_pct)}%</span>
                          <span className="text-primary font-bold">Proj. {formatCompactCurrency(s.projected_payouts)}</span>
                          <span className={n(s.budget_impact) > 0 ? 'text-amber-500 font-bold' : 'text-emerald-500 font-bold'}>
                            Impact {n(s.budget_impact) >= 0 ? '+' : ''}{formatCompactCurrency(s.budget_impact)}
                          </span>
                        </div>
                      </div>

                      {!isBuiltin && (
                        <button
                          type="button"
                          onClick={() => handleDelete(s.scenario_id)}
                          disabled={isDeleting}
                          className="shrink-0 rounded-lg p-1.5 text-muted-foreground/40 hover:bg-rose-500/10 hover:text-rose-400 transition-colors disabled:opacity-40"
                          title={`Delete ${s.scenario_name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              {selected.length === 4 && (
                <p className="text-center text-[11px] font-medium text-muted-foreground">Maximum 4 scenarios selected for comparison.</p>
              )}
            </div>

            {/* Comparison Matrix */}
            {selectedScenarios.length > 0 && (
              <div
                className="rounded-2xl border bg-white space-y-4 shadow-sm"
                style={{ padding: '1.75rem 1.5rem', borderColor: '#e2e8f0' }}
              >
                <div className="space-y-0.5">
                  <h4 className="text-sm font-bold flex items-center gap-2 text-foreground">
                    <ArrowRightLeft className="h-4 w-4 text-primary" />
                    Scenario Comparison Matrix
                  </h4>
                  <p className="text-[11px] font-medium text-muted-foreground">
                    Comparing {selectedScenarios.length} scenario{selectedScenarios.length !== 1 ? 's' : ''}. Budget impact is relative to the Baseline ($14.2M).
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-glass-border">
                        <th className="font-bold text-muted-foreground" style={{ padding: '1rem 1.25rem' }}>Metric</th>
                        {selectedScenarios.map((s) => (
                          <th key={s.scenario_id} className="font-bold text-right text-foreground" style={{ padding: '1rem 1.25rem' }}>
                            {s.scenario_name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/5 font-medium">
                      {[
                        { label: 'Quota adjustment', key: 'quota_change_pct', fmt: (v: number) => formatQuotaDelta(quotaDeltaUsdFromPct(v)) },
                        { label: 'Commission rate', key: 'commission_rate_pct', fmt: (v: number) => formatCommissionRate(v) },
                        { label: 'Bonus rate change', key: 'bonus_rate_change_pct', fmt: (v: number) => `${v >= 0 ? '+' : ''}${v}%` },
                        { label: 'Accelerators', key: 'accelerator_change_pct', fmt: (v: number) => `${v >= 0 ? '+' : ''}${v}%` },
                        { label: 'Tour volume', key: 'tour_volume_change_pct', fmt: (v: number) => formatTourDelta(tourDeltaFromPct(v)) },
                        { label: 'Conversion', key: 'conversion_rate_change_pct', fmt: (v: number) => `${v >= 0 ? '+' : ''}${v}%` },
                        { label: 'Expected performance', key: 'expected_performance_pct', fmt: (v: number) => `${v}%` },
                        { label: 'Projected payouts', key: 'projected_payouts', fmt: formatCompactCurrency },
                        { label: 'Budget impact', key: 'budget_impact', fmt: (v: number) => `${v >= 0 ? '+' : ''}${formatCompactCurrency(v)}`, highlight: true },
                      ].map(({ label, key, fmt, highlight }) => (
                        <tr key={key} className={`hover:bg-muted/5 transition-colors ${highlight ? 'bg-amber-500/5 font-bold' : ''}`}>
                          <td className="text-muted-foreground" style={{ padding: '1.125rem 1.25rem' }}>{label}</td>
                          {selectedScenarios.map((s) => (
                            <td
                              key={s.scenario_id}
                              className={`text-right font-mono font-bold ${
                                highlight
                                  ? n(s[key as keyof ScenarioRecord]) > 0
                                    ? 'text-amber-500'
                                    : 'text-emerald-500'
                                  : 'text-foreground'
                              }`}
                              style={{ padding: '1.125rem 1.25rem' }}
                            >
                              {fmt(n(s[key as keyof ScenarioRecord]))}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {selectedScenarios.length > 0 && (
              <CompInterpretationPanel
                endpoint="/api/comp/scenario/insights"
                insightsContext={scenarioInterpretationContext}
                roleTitle="SteerCo Analyst"
                title="Scenario Interpretation"
                subtitle="AI SteerCo narrative — projected $ and performance figures are deterministic from the matrix above."
                contextLabel={LOADING.aiScenario}
                llmLabel={LOADING.aiScenarioBrief}
                enabled={!!scenarioInterpretationContext}
              />
            )}

            {/* Industry competitive market standards benchmark widget */}
            {selectedScenarios.length > 0 && (() => {
              const benchmarkScn = scenarios.find(s => s.scenario_id === benchmarkScenarioId) || selectedScenarios[0];
              if (!benchmarkScn) return null;

              const activeWeight = directorNoiWeights[benchmarkScn.scenario_id] ?? (benchmarkScn.scenario_id === 'SCN-PLAN-A' ? 75 : benchmarkScn.scenario_id === 'SCN-SIM-01' ? 50 : 30);
              const annotationVal = annotations[benchmarkScn.scenario_id] || '';
              const hgvRate = n(benchmarkScn.commission_rate_pct);
              const accelLever = n(benchmarkScn.accelerator_change_pct);

              const benchmarkRows = normalizeIndustryBenchmarkRows(industryBenchmarks);
              const industryGap = buildIndustryGapAssessment(benchmarkRows, {
                commission_rate_pct: hgvRate,
                bonus_rate_change_pct: n(benchmarkScn.bonus_rate_change_pct),
                accelerator_change_pct: accelLever,
                quota_change_pct: n(benchmarkScn.quota_change_pct),
              });

              const { dirGap, vpGap, dirGapBaseline, vpGapBaseline, roles, optimalCommission, noiWeightMarket } = industryGap;
              const dirStatus = getGapStatus(dirGap);
              const vpStatus = getGapStatus(vpGap);

              let tagColor = 'bg-amber-500/10 text-amber-500';
              let tagLabel = 'High Cost Risk';
              if (hgvRate >= 4.0 && hgvRate <= optimalCommission + 0.5) {
                tagColor = 'bg-emerald-500/10 text-emerald-500';
                tagLabel = 'Optimal Alignment';
              } else if (hgvRate < 4.0) {
                tagColor = 'bg-rose-500/10 text-rose-500';
                tagLabel = 'Talent Attrition Risk';
              }

              const oppMin = Math.round(5 + accelLever * 0.1);
              const oppMax = Math.round(19 + accelLever * 0.2);
              const oppWithin = oppMax >= 18;

              let ratingLabel = 'Low Margin Protection';
              let ratingColor = 'text-rose-500 bg-rose-500/10';
              let ratingDesc = 'Revenue-heavy structure (~70% tied to NSV). Exposes HGV to commission overpayments when margin is weak.';

              if (activeWeight >= 50 && activeWeight <= 80) {
                ratingLabel = 'Market Standard Aligned';
                ratingColor = 'text-emerald-500 bg-emerald-500/10';
                ratingDesc = `Optimal industry alignment. Market NOI weight benchmark is ${noiWeightMarket}% (industry_comp_benchmark).`;
              } else if (activeWeight > 80) {
                ratingLabel = 'Profit-Centric (Growth Risk)';
                ratingColor = 'text-blue-500 bg-blue-500/10';
                ratingDesc = 'Extremely margin-protective, but high risk of demotivating performers on high-volume deals.';
              } else if (activeWeight >= 20) {
                ratingLabel = 'Moderate Margin Alignment';
                ratingColor = 'text-amber-500 bg-amber-500/10';
                ratingDesc = 'Moderate margin check, but still heavily reliant on revenue growth variables.';
              }

              return (
                <div
                  className="rounded-2xl border bg-white space-y-6 shadow-sm"
                  style={{ padding: '1.75rem 1.5rem', borderColor: '#e2e8f0' }}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="space-y-0.5">
                      <h4 className="text-sm font-bold flex items-center gap-2 text-foreground">
                        <span className="flex h-5 w-5 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500 text-xs">B</span>
                        HGV vs. Market Compensation Standards Gap Assessment
                      </h4>
                      <p className="text-[11px] font-medium text-muted-foreground">
                        Assess alignment against{' '}
                        <code className="rounded-md bg-primary/10 text-primary px-1.5 py-0.5 text-[10px] font-mono">workspace.hgv_comp.industry_comp_benchmark</code>
                        {' '}({benchmarkRows.length} rows loaded).
                      </p>
                    </div>
                    
                    {/* Scenario Picker for Benchmarking */}
                    <div className="flex items-center gap-2 shrink-0">
                      <label htmlFor="benchmark-selector" className="text-[10px] font-bold text-muted-foreground uppercase">Target Scenario:</label>
                      <select
                        id="benchmark-selector"
                        value={benchmarkScenarioId}
                        onChange={(e) => setBenchmarkScenarioId(e.target.value)}
                        className="rounded-lg border border-glass-border bg-card/60 px-2 py-1 text-xs font-semibold outline-none focus:border-primary/50 transition-all text-foreground"
                      >
                        {selectedScenarios.map((s) => (
                          <option key={s.scenario_id} value={s.scenario_id} className="bg-card text-foreground">
                            {s.scenario_name} ({s.scenario_id})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* 2x2 Grid of Key Gaps */}
                  <div className="grid gap-6 md:grid-cols-2">
                    
                    {/* Area 1: Below-Market Director+ Gaps */}
                    <div className="rounded-2xl border border-glass-border bg-muted/5 p-4 space-y-4">
                      <div>
                        <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-[9px] font-bold text-rose-500 uppercase tracking-wider">Area 1</span>
                        <h5 className="text-xs font-bold text-foreground mt-1">Below Market Target Cash Levels</h5>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Competitive Total Cash Compensation (TCC) gaps vs. industry standards.</p>
                      </div>

                      <div className="space-y-3">
                        {/* Director Gap */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px] font-semibold">
                            <span className="text-foreground/80">Directors / Sr. Directors Gap</span>
                            <span className={`px-1.5 py-0.5 rounded font-mono font-bold text-[10px] ${dirStatus.color}`}>
                              {dirGap.toFixed(1)}% ({dirStatus.label})
                            </span>
                          </div>
                          <div className="relative h-1.5 w-full bg-muted rounded-full overflow-hidden">
                            <div className="absolute left-0 top-0 h-full bg-rose-500 transition-all duration-300" style={{ width: `${dirGapBaseline}%`, opacity: 0.3 }} />
                            <div className={`absolute left-0 top-0 h-full transition-all duration-300 ${dirGap > 10 ? 'bg-amber-500' : dirGap > 2 ? 'bg-yellow-500' : 'bg-emerald-500'}`} style={{ width: `${dirGap}%` }} />
                          </div>
                          <div className="flex justify-between text-[8px] text-muted-foreground">
                            <span>Optimal (0% Gap)</span>
                            <span>HGV Baseline: {dirGapBaseline}% Below Market</span>
                          </div>
                        </div>

                        {/* VP Gap */}
                        <div className="space-y-1 pt-1">
                          <div className="flex justify-between text-[11px] font-semibold">
                            <span className="text-foreground/80">Sales VPs Target Cash Gap</span>
                            <span className={`px-1.5 py-0.5 rounded font-mono font-bold text-[10px] ${vpStatus.color}`}>
                              {vpGap.toFixed(1)}% ({vpStatus.label})
                            </span>
                          </div>
                          <div className="relative h-1.5 w-full bg-muted rounded-full overflow-hidden">
                            <div className="absolute left-0 top-0 h-full bg-rose-500 transition-all duration-300" style={{ width: `${vpGapBaseline}%`, opacity: 0.3 }} />
                            <div className={`absolute left-0 top-0 h-full transition-all duration-300 ${vpGap > 25 ? 'bg-rose-500' : vpGap > 10 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${vpGap}%` }} />
                          </div>
                          <div className="flex justify-between text-[8px] text-muted-foreground">
                            <span>Optimal (0% Gap)</span>
                            <span>HGV Baseline: {vpGapBaseline}% Below Market</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Area 2: Variable-Heavy Pay Mix Volatility */}
                    <div className="rounded-2xl border border-glass-border bg-muted/5 p-4 space-y-3">
                      <div>
                        <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[9px] font-bold text-blue-500 uppercase tracking-wider">Area 2</span>
                        <h5 className="text-xs font-bold text-foreground mt-1">Variable-Heavy Pay Mix Volatility</h5>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Role base/variable cash mixes vs. competitor ranges.</p>
                      </div>

                      <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                        {roles.map((role) => {
                          const hgvClamped = Math.min(90, Math.max(5, role.hgvBase));
                          const withinRange = Math.abs(hgvClamped - role.mktBase) < 8;

                          return (
                            <div key={role.name} className="border-b border-border/5 pb-2 last:border-0 last:pb-0 space-y-1">
                              <div className="flex justify-between text-[10px] font-bold">
                                <span className="text-foreground/90 truncate max-w-[170px]">{role.name}</span>
                                <span className={`text-[8px] font-semibold uppercase px-1 rounded ${withinRange ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                                  {withinRange ? 'Aligned' : 'Volatile'}
                                </span>
                              </div>
                              
                              <div className="space-y-0.5">
                                {/* HGV Active Mix */}
                                <div className="flex items-center gap-1.5 text-[9px] tabular-nums">
                                  <span className="w-12 text-muted-foreground font-semibold">Active:</span>
                                  <div className="flex-1 flex h-2 rounded bg-muted overflow-hidden">
                                    <div className="bg-primary h-full transition-all duration-300" style={{ width: `${hgvClamped}%` }} />
                                    <div className="bg-amber-500 h-full flex-1 transition-all duration-300" />
                                  </div>
                                  <span className="font-bold text-foreground w-8 text-right">{hgvClamped}/{100 - hgvClamped}</span>
                                </div>
                                {/* Market Standard */}
                                <div className="flex items-center gap-1.5 text-[9px] tabular-nums opacity-60">
                                  <span className="w-12 text-muted-foreground">Market:</span>
                                  <div className="flex-1 flex h-1 rounded bg-muted overflow-hidden">
                                    <div className="bg-slate-400 h-full" style={{ width: `${role.mktBase}%` }} />
                                    <div className="bg-slate-500 h-full flex-1" />
                                  </div>
                                  <span className="w-8 text-right font-medium">{Math.round(role.mktBase)}/{Math.round(100 - role.mktBase)}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Area 3: Lower Total Commission Rates */}
                    <div className="rounded-2xl border border-glass-border bg-muted/5 p-4 space-y-4">
                      <div>
                        <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[9px] font-bold text-amber-500 uppercase tracking-wider">Area 3</span>
                        <h5 className="text-xs font-bold text-foreground mt-1">Lower Total Commission Rates</h5>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Base rates and total opportunity margins vs. market standards.</p>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center justify-between border-b border-border/5 pb-2.5">
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase font-bold">HGV Active Base Rate</p>
                            <p className="text-sm font-extrabold text-foreground mt-0.5 font-mono">{hgvRate}%</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] text-muted-foreground uppercase font-bold">Market Base Standard</p>
                            <p className="text-xs font-bold text-foreground/80 mt-0.5">4% - {optimalCommission}%</p>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${tagColor}`}>
                            {tagLabel}
                          </span>
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px] font-semibold">
                            <span className="text-foreground/80">Total Commission Opportunity</span>
                            <span className={`px-1.5 py-0.5 rounded font-mono font-bold text-[10px] ${oppWithin ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                              {oppMin}% - {oppMax}% Opportunity
                            </span>
                          </div>
                          <div className="relative h-1.5 w-full bg-muted rounded-full overflow-hidden">
                            <div className="absolute left-[9%] right-[80%] h-full bg-emerald-500/30 rounded" />
                            <div className="absolute h-full bg-amber-500 rounded transition-all duration-300" style={{ left: `${oppMin}%`, right: `${100 - oppMax}%` }} />
                          </div>
                          <div className="flex justify-between text-[8px] text-muted-foreground">
                            <span>HGV Opportunity Range (Market: 9% - 20%)</span>
                            <span>{oppWithin ? 'Market Equivalent (Pass)' : 'Trails Market (Warning)'}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Area 4: Limited Profitability Measures within Director Plans */}
                    <div className="rounded-2xl border border-glass-border bg-muted/5 p-4 space-y-4">
                      <div>
                        <span className="rounded-full bg-purple-500/10 px-2 py-0.5 text-[9px] font-bold text-purple-500 uppercase tracking-wider">Area 4</span>
                        <h5 className="text-xs font-bold text-foreground mt-1">Director+ Plan Profitability Alignment</h5>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Shift weights from revenue-heavy Net Sales (NSV) to Net Operating Income (NOI).</p>
                      </div>

                      <div className="space-y-3.5">
                        {/* Interactive Weight Slider */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-[11px] font-semibold">
                            <span className="text-foreground/80">Director+ NOI Metric Weight</span>
                            <span className={`px-1.5 py-0.5 rounded font-mono font-bold text-[10px] ${ratingColor}`}>
                              {activeWeight}% weight
                            </span>
                          </div>
                          
                          <div className="relative h-2 rounded-full bg-muted">
                            <div
                              className="absolute left-0 top-0 h-2 rounded-full bg-purple-500 transition-all"
                              style={{ width: `${activeWeight}%` }}
                            />
                            <input
                              id="noi-weight-slider"
                              type="range"
                              min="0"
                              max="100"
                              step="5"
                              value={activeWeight}
                              onChange={(e) => updateNoiWeight(benchmarkScn.scenario_id, Number(e.target.value))}
                              className="absolute inset-0 h-2 w-full cursor-pointer opacity-0"
                            />
                          </div>
                          <div className="flex justify-between text-[8px] text-muted-foreground font-mono">
                            <span>0% (Revenue Only)</span>
                            <span>Market Standard: {Math.max(50, noiWeightMarket - 15)}% - {Math.min(80, noiWeightMarket + 15)}%</span>
                            <span>100% (NOI Only)</span>
                          </div>
                        </div>

                        <div className="p-2.5 rounded-xl border border-glass-border space-y-1">
                          <p className="text-[10px] font-bold flex items-center gap-1.5">
                            <span className={`h-1.5 w-1.5 rounded-full ${ratingColor.split(' ')[0]}`} />
                            {ratingLabel}
                          </p>
                          <p className="text-[9px] text-muted-foreground leading-normal">{ratingDesc}</p>
                        </div>
                      </div>
                    </div>

                  </div>

                  {/* Strategic Notepad */}
                  <div className="rounded-2xl border border-glass-border bg-muted/5 p-4 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label htmlFor="strategic-notepad" className="text-xs font-bold text-foreground flex items-center gap-2">
                        <span>[Note]</span>
                        Strategic Decisions & Scenario Annotations
                      </label>
                      <span className="text-[9px] text-emerald-500 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full">
                        Auto-saved to local storage
                      </span>
                    </div>
                    <textarea
                      id="strategic-notepad"
                      rows={3}
                      value={annotationVal}
                      onChange={(e) => updateAnnotation(benchmarkScn.scenario_id, e.target.value)}
                      placeholder="Document strategic rationale, business case justifications, or executive sign-off notes for this scenario plan..."
                      className="w-full rounded-xl border border-glass-border bg-card/40 px-3 py-2.5 text-xs font-medium outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-all text-foreground placeholder:text-muted-foreground/50 resize-none leading-relaxed"
                    />
                  </div>
                </div>
              );
            })()}

            {/* KPI strip for selected */}
            {selectedScenarios.length > 0 && (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {selectedScenarios.slice(0, 3).map((s) => (
                  <KpiCard
                    key={s.scenario_id}
                    label={s.scenario_name}
                    value={formatCompactCurrency(s.projected_payouts)}
                    subtext={`Impact: ${n(s.budget_impact) >= 0 ? '+' : ''}${formatCompactCurrency(s.budget_impact)}`}
                    trend={n(s.budget_impact) === 0 ? 'neutral' : n(s.budget_impact) > 0 ? 'negative' : 'positive'}
                    delta={`${n(s.expected_performance_pct)}% perf`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Right col: Copilot */}
          <div className="space-y-4">
            <CompCopilot
              title="Scenario Planning Assistant"
              description="Answers grounded in selected scenario parameters from Unity Catalog."
              personaLabel="Comp Admin / Finance"
              dataContext={dataContext}
              contextLoading={pageLoading}
              contextError={pageError}
              storageKey="comp_analysis"
              examplePrompts={[
                'Compare projected payouts across all selected scenarios.',
                'Which scenario has the best ROI on budget impact?',
                'What happens to performance if I raise quota by $100K per rep?',
                'Explain the budget impact difference between Baseline and SIM-01.',
              ]}
              insightPrompt="Analyze the selected scenarios. Summarize the trade-offs between budget cost and expected performance for each, and recommend the optimal scenario."
            />
          </div>

        </div>
      )}
      </div>

      {/* ─── Create Scenario Modal (portal — stays centered on screen) ─── */}
      {showCreate && createPortal(
        <div
          className="fixed inset-0 z-[200] overflow-y-auto"
          style={{ background: 'rgba(10, 37, 64, 0.55)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowCreate(false); }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-scenario-title"
        >
          <div className="flex min-h-full items-center justify-center p-4 sm:p-8">
          <div
            className="animate-fade-in w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden"
            style={{ background: '#fff', borderColor: '#e2e8f0', maxHeight: 'min(90vh, 880px)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b" style={{ padding: '1.25rem 1.5rem', borderColor: '#e2e8f0', background: 'linear-gradient(90deg, #f0f6ff, #fff)' }}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 id="create-scenario-title" className="text-base font-bold text-foreground">Create New Scenario</h3>
                  <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                    {isMarketingManager
                      ? 'Adjust tour volume to model marketing flow. Results appear in the comparison matrix below after you save.'
                      : isMarketingDirector
                        ? 'Set quota, commission, and tour levers. Projections update live — save to compare in the matrix.'
                        : 'Adjust plan levers below. Save to compare scenarios side-by-side.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted/40 transition-colors shrink-0"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <form onSubmit={handleCreate} className="overflow-y-auto space-y-5" style={{ padding: '1.5rem', maxHeight: 'calc(90vh - 120px)' }}>
              <div className="space-y-2">
                <label htmlFor="scenario-name" className="text-xs font-bold text-foreground">
                  Scenario name <span className="text-rose-500">*</span>
                </label>
                <input
                  ref={nameRef}
                  id="scenario-name"
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Q2 Tour Push Plan"
                  className="w-full rounded-xl border px-3 py-2.5 text-sm font-medium outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
                  style={{ borderColor: '#dde3ea' }}
                  required
                  maxLength={48}
                />
              </div>

              <div className="space-y-4">
                {canAdjustQuotaAndCommission && (
                  <>
                    <Slider
                      id="quota-change"
                      label="Quota adjustment (per rep)"
                      value={form.quota_delta_usd}
                      min={QUOTA_SLIDER.min}
                      max={QUOTA_SLIDER.max}
                      step={QUOTA_SLIDER.step}
                      formatValue={formatQuotaDelta}
                      color="bg-primary"
                      helpText={SLIDER_HELP.quota}
                      onChange={(v) => setForm((f) => ({ ...f, quota_delta_usd: v }))}
                    />
                    <Slider
                      id="commission-rate"
                      label="Commission rate"
                      value={form.commission_rate_pct}
                      min={3}
                      max={12}
                      step={0.5}
                      formatValue={formatCommissionRate}
                      color="bg-emerald-500"
                      helpText={SLIDER_HELP.commission}
                      onChange={(v) => setForm((f) => ({ ...f, commission_rate_pct: v }))}
                    />
                  </>
                )}
                <Slider
                  id="tour-volume-change"
                  label="Tour volume adjustment"
                  value={form.tour_delta}
                  min={TOUR_SLIDER.min}
                  max={TOUR_SLIDER.max}
                  step={TOUR_SLIDER.step}
                  formatValue={formatTourDelta}
                  color="bg-primary"
                  helpText={SLIDER_HELP.tourVolume}
                  onChange={(v) => setForm((f) => ({ ...f, tour_delta: v }))}
                />
              </div>

              <div
                className="rounded-xl border text-[11px] leading-relaxed text-muted-foreground space-y-2"
                style={{ padding: '1rem 1.125rem', borderColor: '#dbeafe', background: '#f8fbff' }}
              >
                <p className="font-bold text-foreground text-xs">How to view your results</p>
                <ol className="list-decimal pl-4 space-y-1">
                  <li>Click <strong>Create &amp; Save Scenario</strong> — your model is stored in the scenario library.</li>
                  <li>Check the box next to your new scenario (up to 4 at once).</li>
                  <li>Scroll to the <strong>Comparison Matrix</strong> for projected pay and budget impact.</li>
                  <li>Use the <strong>Scenario Planning Assistant</strong> on the right to ask what the numbers mean.</li>
                </ol>
              </div>

              <div className="rounded-xl border border-primary/20 bg-primary/5 space-y-2" style={{ padding: '1.125rem 1.25rem' }}>
                <p className="text-[11px] font-bold text-primary uppercase tracking-wide flex items-center gap-1.5">
                  <Calculator className="h-3 w-3" /> Live preview
                </p>
                <div className="grid grid-cols-3 gap-3 text-xs font-semibold">
                  <div>
                    <p className="text-muted-foreground font-medium">Projected payouts</p>
                    <p className="font-extrabold text-foreground mt-0.5 text-sm">{formatCompactCurrency(preview.projected)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground font-medium">Budget impact</p>
                    <p className={`font-extrabold mt-0.5 text-sm ${preview.impact > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
                      {preview.impact >= 0 ? '+' : ''}{formatCompactCurrency(preview.impact)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground font-medium">Expected perf.</p>
                    <p className="font-extrabold text-foreground mt-0.5 text-sm">{preview.perf.toFixed(1)}%</p>
                  </div>
                </div>
              </div>

              {createError && (
                <p className="text-xs font-semibold text-rose-500">{createError}</p>
              )}

              <div className="flex justify-end gap-2 pt-1 pb-1">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="rounded-xl border px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted/30"
                  style={{ borderColor: '#dde3ea' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !form.name.trim()}
                  id="btn-create-scenario-submit"
                  className="rounded-xl px-5 py-2 text-sm font-bold text-white shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: '#0a2540' }}
                >
                  {creating ? 'Saving…' : 'Create & Save Scenario'}
                </button>
              </div>
            </form>
          </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
