import { useAnalyticsQuery } from '@databricks/appkit-ui/react';
import { sql } from '@databricks/appkit-ui/js';
import {
  AlertTriangle,
  ArrowUpDown,
  Award,
  CheckCircle2,
  ShieldAlert,
  Users,
  Sparkles,
  Activity,
  X,
  CalendarDays,
} from 'lucide-react';
import { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router';
import { CompCopilot } from '@/components/comp/CompCopilot';
import { CompInterpretationPanel } from '@/components/comp/CompInterpretationPanel';
import { ManagerAiInsightsPanel } from '@/components/comp/ManagerAiInsightsPanel';
import { KpiCard } from '@/components/comp/KpiCard';
import { formatCurrency, formatPercent, formatQueryError } from '@/lib/compFormat';
import { useAppContext } from '@/context/AppContext';
import { PageLoadGate } from '@/components/comp/PageLoadGate';
import { deriveLoadingSteps } from '@/lib/loadingSteps';
import { LOADING } from '@/lib/loadingStepLabels';
import { RegionalBonusLevelsPanel } from '@/components/comp/RegionalBonusLevelsPanel';
import { TeamScenarioPanel } from '@/components/comp/TeamScenarioPanel';
import { combinedAtRiskFlag, type TeamMarketPosition } from '@shared/compStandards';
import { teamBonusTierCounts, attainmentToBonusLevel } from '@shared/bonusLevelsJan2025';
import {
  buildInterventionContextBlock,
  buildInterventionCopilotPrompt,
  buildInterventionDirective,
  buildInterventionGapSummary,
  buildTakeoverAdvisorPrompt,
  gapAnalysisPanelStyle,
  type InterventionAgent,
} from '@/lib/repIntervention';
import {
  DEFAULT_QUOTA_RELIEF_PCT,
  type ManagerInterventionRecord,
} from '@shared/managerIntervention';

type SortField = 'agent_name' | 'quota_attainment_pct' | 'ffs_sales_pct' | 'total_earnings';
type SortOrder = 'asc' | 'desc';

interface ManagerWorkspaceData {
  manager_name: string;
  role_title: string;
  team_rollup: {
    report_count: number;
    team_attainment_pct: number;
    at_risk_count: number;
    top_performer_count: number;
    total_team_nsv: number;
    total_team_earnings: number;
    ffs_sales_pct: number;
    ffs_target_pct: number;
  };
  direct_reports: Array<{
    rep_id: string;
    rep_name: string;
    level_code: string;
    quota_attainment_pct: number;
    total_earnings: number;
    ffs_sales_pct?: number;
    performance_band: string;
    tours_showed?: number;
    tour_close_rate_pct?: number;
  }>;
  metric_attainment?: Array<{
    metric: string;
    weight_pct: number;
    attainment_pct: number;
    payout_pct: number;
    actual: string | number;
    target: string | number;
  }>;
  upcoming_tours?: Array<{
    tour_id: string;
    rep_name: string;
    lead_source?: string;
    abc_score: string;
    showed_flag?: boolean;
    closed_flag?: boolean;
    net_sales_volume: number;
  }>;
  action_items?: Array<{
    priority: string;
    metric: string;
    recommendation: string;
    evidence: string;
  }>;
  persona_id?: string | null;
  grounding_context?: string;
  insights_context?: string;
  coaching_signals_context?: string;
}

interface DisplayAgentRow {
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

function dedupeAgentRows(rows: DisplayAgentRow[]): DisplayAgentRow[] {
  const seen = new Map<string, DisplayAgentRow>();
  for (const row of rows) {
    const key = row.rep_id?.trim() || row.agent_name.trim();
    if (!seen.has(key)) seen.set(key, row);
  }
  return [...seen.values()];
}

interface SliderProps {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  color?: string;
  onChange: (v: number) => void;
}

function Slider({ id, label, value, min, max, step, unit = '%', color = 'var(--primary)', onChange }: SliderProps) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11 }}>
        <label htmlFor={id} style={{ fontWeight: 600, color: 'var(--foreground)' }}>{label}</label>
        <span className="badge badge-neutral" style={{ fontWeight: 700, fontSize: 10 }}>
          {value > 0 ? '+' : ''}{value}{unit}
        </span>
      </div>
      <div style={{ position: 'relative', height: 6, display: 'flex', alignItems: 'center' }}>
        {/* Track track fill */}
        <div style={{ position: 'absolute', left: 0, right: 0, height: 4, background: 'var(--bg-overlay)', borderRadius: 999 }} />
        <div
          style={{
            position: 'absolute',
            left: 0,
            width: `${pct}%`,
            height: 4,
            background: color,
            borderRadius: 999,
          }}
        />
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            opacity: 0,
            cursor: 'pointer',
            zIndex: 10
          }}
        />
        {/* Thumb simulation */}
        <div
          style={{
            position: 'absolute',
            left: `calc(${pct}% - 8px)`,
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: '#fff',
            border: `2px solid ${color}`,
            boxShadow: 'var(--shadow-sm)',
            pointerEvents: 'none',
            zIndex: 5
          }}
        />
      </div>
    </div>
  );
}

export function TeamPerformancePage() {
  const { activeTeamId, activePeriodId, activeRepId, isManager, isMarketingChannel, activeRoleTitle } = useAppContext();
  const [managerWorkspace, setManagerWorkspace] = useState<ManagerWorkspaceData | null>(null);
  const [workspaceLoading, setWorkspaceLoading] = useState(true);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const useMarketingWorkspace = isMarketingChannel && isManager;

  const [teamMarketPositions, setTeamMarketPositions] = useState<TeamMarketPosition[]>([]);

  useEffect(() => {
    if (!isManager || !activePeriodId) return;
    setWorkspaceLoading(true);
    setWorkspaceError(null);
    setManagerWorkspace(null);
    void fetch(`/api/comp/manager/workspace?manager_rep_id=${encodeURIComponent(activeRepId)}&period_id=${encodeURIComponent(activePeriodId)}`)
      .then(async (r) => {
        if (!r.ok) {
          const body = (await r.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `HTTP ${r.status}`);
        }
        return r.json() as Promise<ManagerWorkspaceData>;
      })
      .then((d) => setManagerWorkspace(d))
      .catch((err) => {
        setManagerWorkspace(null);
        setWorkspaceError(err instanceof Error ? err.message : 'Failed to load manager workspace');
      })
      .finally(() => setWorkspaceLoading(false));
  }, [isManager, activeRepId, activePeriodId]);

  useEffect(() => {
    if (!isManager || !activePeriodId) return;
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
  }, [isManager, activePeriodId]);

  // Query parameters for team analytics
  const queryParams = useMemo(() => ({
    team_id: sql.string(activeTeamId),
    period_id: sql.string(activePeriodId),
  }), [activeTeamId, activePeriodId]);

  const { data: teamKpi, loading: l1, error: e1 } = useAnalyticsQuery('comp_team_kpi', queryParams);

  const [salesAgents, setSalesAgents] = useState<Record<string, unknown>[]>([]);
  const [salesAgentsLoading, setSalesAgentsLoading] = useState(false);
  const [salesAgentsError, setSalesAgentsError] = useState<string | null>(null);
  const [dataRefreshKey, setDataRefreshKey] = useState(0);

  useEffect(() => {
    if (useMarketingWorkspace || !activeTeamId || !activePeriodId) return;
    setSalesAgentsLoading(true);
    setSalesAgentsError(null);
    void fetch(
      `/api/comp/team/agent-performance?team_id=${encodeURIComponent(activeTeamId)}&period_id=${encodeURIComponent(activePeriodId)}&_=${dataRefreshKey}`,
    )
      .then(async (r) => {
        if (!r.ok) {
          const body = (await r.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `HTTP ${r.status}`);
        }
        return r.json() as Promise<{ agents: Record<string, unknown>[] }>;
      })
      .then((d) => setSalesAgents(d.agents ?? []))
      .catch((err) => {
        setSalesAgents([]);
        setSalesAgentsError(err instanceof Error ? err.message : 'Failed to load leaderboard');
      })
      .finally(() => setSalesAgentsLoading(false));
  }, [useMarketingWorkspace, activeTeamId, activePeriodId, dataRefreshKey]);

  const agents = useMarketingWorkspace ? null : salesAgents;
  const l2 = useMarketingWorkspace ? false : salesAgentsLoading;
  const e2 = useMarketingWorkspace ? null : salesAgentsError;

  const [sortField, setSortField] = useState<SortField>('quota_attainment_pct');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [copilotInput, setCopilotInput] = useState<string | undefined>(undefined);

  // Takeover drawer states
  const [activeInterventionRep, setActiveInterventionRep] = useState<InterventionAgent | null>(null);
  const [takeoverPricingActive, setTakeoverPricingActive] = useState(false);
  const [takeoverDiscount, setTakeoverDiscount] = useState(5);
  const [quotaShieldActive, setQuotaShieldActive] = useState(false);
  const [quotaReliefPct, setQuotaReliefPct] = useState(DEFAULT_QUOTA_RELIEF_PCT);
  const [selectedTourId, setSelectedTourId] = useState<string>('');
  const [activeInterventions, setActiveInterventions] = useState<ManagerInterventionRecord[]>([]);
  const [interventionSubmitting, setInterventionSubmitting] = useState(false);
  const [interventionError, setInterventionError] = useState<string | null>(null);
  const [interventionSuccess, setInterventionSuccess] = useState<string | null>(null);

  const pageLoading = useMarketingWorkspace
    ? workspaceLoading || (!managerWorkspace && !workspaceError)
    : l1 || l2;
  const error = useMarketingWorkspace ? workspaceError : (e1 || e2);

  const loaderSteps = useMemo(() => {
    if (useMarketingWorkspace) {
      return deriveLoadingSteps([
        {
          id: 'auth',
          label: LOADING.session,
          loading: false,
          done: true,
        },
        {
          id: 'workspace',
          label: LOADING.managerWorkspace,
          loading: workspaceLoading,
          done: !!managerWorkspace,
          error: !!workspaceError,
        },
      ]);
    }
    return deriveLoadingSteps([
      {
        id: 'auth',
        label: LOADING.session,
        loading: false,
        done: true,
      },
      {
        id: 'team_kpi',
        label: LOADING.teamKpi,
        loading: l1,
        done: !!teamKpi?.length,
        error: !!e1,
      },
      {
        id: 'agents',
        label: LOADING.teamLeaderboard,
        loading: l2,
        done: !!agents?.length,
        error: !!e2,
      },
    ]);
  }, [
    useMarketingWorkspace,
    workspaceLoading,
    managerWorkspace,
    workspaceError,
    l1,
    teamKpi,
    e1,
    l2,
    agents,
    e2,
  ]);

  const team = teamKpi?.[0];

  const displayTeam = useMemo(() => {
    if (team) return team;
    if (!managerWorkspace?.team_rollup) return null;
    const tr = managerWorkspace.team_rollup;
    return {
      team_name: `${managerWorkspace.role_title} — ${managerWorkspace.manager_name}`,
      team_attainment_pct: tr.team_attainment_pct,
      top_performer_count: tr.top_performer_count,
      at_risk_count: tr.at_risk_count,
      ffs_sales_pct: tr.ffs_sales_pct,
      ffs_target_pct: tr.ffs_target_pct,
      ffs_gap_pct: tr.ffs_sales_pct - tr.ffs_target_pct,
      total_team_nsv: tr.total_team_nsv,
    };
  }, [team, managerWorkspace]);

  const displayAgents = useMemo<DisplayAgentRow[]>(() => {
    if (!useMarketingWorkspace && agents && agents.length > 0) {
      return dedupeAgentRows(
        agents.map((a) => ({
          agent_name: String(a.agent_name),
          rep_id: String((a as { rep_id?: string }).rep_id ?? '') || undefined,
          level: String(a.level),
          quota_attainment_pct: Number(a.quota_attainment_pct ?? 0),
          ffs_sales_pct: Number(a.ffs_sales_pct ?? 0),
          total_earnings: Number(a.total_earnings ?? 0),
          performance_band: String((a as { performance_band?: string }).performance_band ?? ''),
        })),
      );
    }
    if (!managerWorkspace?.direct_reports?.length) return [];
    return dedupeAgentRows(
      managerWorkspace.direct_reports.map((r) => ({
        agent_name: r.rep_name,
        rep_id: r.rep_id,
        level: r.level_code,
        quota_attainment_pct: r.quota_attainment_pct,
        ffs_sales_pct: r.ffs_sales_pct ?? 0,
        total_earnings: r.total_earnings,
        performance_band: r.performance_band,
        tours_showed: r.tours_showed,
        tour_close_rate_pct: r.tour_close_rate_pct,
      })),
    );
  }, [agents, managerWorkspace]);

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  }

  // Client-side sorting
  const sortedAgents = useMemo(() => {
    if (!displayAgents.length) return [];
    const list = [...displayAgents];
    return list.sort((a, b) => {
      let aVal: string | number = a[sortField];
      let bVal: string | number = b[sortField];

      if (typeof aVal === 'string') {
        aVal = String(aVal).toLowerCase();
        bVal = String(bVal).toLowerCase();
      } else {
        aVal = Number(aVal ?? 0);
        bVal = Number(bVal ?? 0);
      }

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [displayAgents, sortField, sortOrder]);

  // Dynamic SVG chart data for Attainment Distribution
  const attainmentDistribution = useMemo(() => {
    if (!displayAgents.length) return { under70: 0, range70to100: 0, over100: 0 };
    let under70 = 0;
    let range70to100 = 0;
    let over100 = 0;

    displayAgents.forEach((a) => {
      const att = Number(a.quota_attainment_pct || 0);
      if (att < 70) under70++;
      else if (att < 100) range70to100++;
      else over100++;
    });

    return { under70, range70to100, over100 };
  }, [displayAgents]);

  const maxDistributionVal = Math.max(attainmentDistribution.under70, attainmentDistribution.range70to100, attainmentDistribution.over100, 1);

  const bonusTierDistribution = useMemo(() => {
    const attainments = displayAgents.map((a) => Number(a.quota_attainment_pct ?? 0));
    return teamBonusTierCounts(attainments);
  }, [displayAgents]);

  const maxBonusTierCount = Math.max(...bonusTierDistribution.map((b) => b.count), 1);

  const teamBaselineEarnings = useMemo(() => {
    if (managerWorkspace?.team_rollup?.total_team_earnings) {
      return managerWorkspace.team_rollup.total_team_earnings;
    }
    return displayAgents.reduce((sum, a) => sum + Number(a.total_earnings ?? 0), 0);
  }, [managerWorkspace, displayAgents]);

  const marketByRepName = useMemo(() => {
    const map = new Map<string, TeamMarketPosition>();
    for (const p of teamMarketPositions) {
      map.set(p.rep_name.split(' ').pop()?.toLowerCase() ?? p.rep_name, p);
    }
    return map;
  }, [teamMarketPositions]);

  function lookupMarket(agentName: string) {
    const last = agentName.split(' ').pop()?.toLowerCase() ?? '';
    return marketByRepName.get(last);
  }

  const interventionOptions = useMemo(
    () => ({
      useMarketingWorkspace,
      openTours: managerWorkspace?.upcoming_tours,
    }),
    [useMarketingWorkspace, managerWorkspace?.upcoming_tours],
  );

  function interventionOptsFor(agent: InterventionAgent) {
    return {
      ...interventionOptions,
      market: lookupMarket(agent.agent_name),
    };
  }

  // Dynamic grounding context for Copilot
  const dataContext = useMemo(() => {
    const mgrBlock = managerWorkspace?.grounding_context
      ? ['## Manager plan & direct-report production context', managerWorkspace.grounding_context, '']
      : [];

    const interventionBlock =
      activeInterventionRep != null
        ? [buildInterventionContextBlock(activeInterventionRep, interventionOptsFor(activeInterventionRep)), '']
        : [];

    if (!displayTeam && !managerWorkspace) return '';
    return [
      ...mgrBlock,
      ...interventionBlock,
      '## Team KPI snapshot',
      JSON.stringify(displayTeam ?? {}, null, 2),
      '',
      '## Direct reports (manager-scoped)',
      JSON.stringify(managerWorkspace?.direct_reports ?? displayAgents, null, 2),
      '',
      '## Plan metric attainment',
      JSON.stringify(managerWorkspace?.metric_attainment ?? [], null, 2),
      '',
      '## Recommended manager actions',
      JSON.stringify(managerWorkspace?.action_items ?? [], null, 2),
    ].join('\n');
  }, [displayTeam, displayAgents, managerWorkspace, activeInterventionRep, interventionOptions]);

  function triggerRepIntervention(agent: DisplayAgentRow) {
    const interventionAgent: InterventionAgent = {
      agent_name: agent.agent_name,
      rep_id: agent.rep_id,
      level: agent.level,
      quota_attainment_pct: agent.quota_attainment_pct,
      ffs_sales_pct: agent.ffs_sales_pct,
      total_earnings: agent.total_earnings,
      performance_band: agent.performance_band,
      tours_showed: agent.tours_showed,
      tour_close_rate_pct: agent.tour_close_rate_pct,
    };
    setTakeoverPricingActive(false);
    setTakeoverDiscount(5);
    setQuotaShieldActive(false);
    setQuotaReliefPct(DEFAULT_QUOTA_RELIEF_PCT);
    setSelectedTourId('');
    setInterventionError(null);
    setInterventionSuccess(null);
    setActiveInterventionRep(interventionAgent);

    if (agent.rep_id && activePeriodId) {
      void fetch(
        `/api/comp/manager/interventions?target_rep_id=${encodeURIComponent(agent.rep_id)}&period_id=${encodeURIComponent(activePeriodId)}`,
      )
        .then(async (r) => (r.ok ? ((await r.json()) as { interventions: ManagerInterventionRecord[] }) : { interventions: [] }))
        .then((d) => {
          setActiveInterventions(d.interventions ?? []);
          const to = d.interventions?.find((i) => i.intervention_type === 'TAKEOVER_PRICING');
          const qs = d.interventions?.find((i) => i.intervention_type === 'QUOTA_SHIELD');
          if (to) {
            setTakeoverPricingActive(true);
            setTakeoverDiscount(Number(to.discount_pct ?? 5));
            if (to.tour_id) setSelectedTourId(to.tour_id);
          }
          if (qs) {
            setQuotaShieldActive(true);
            setQuotaReliefPct(Number(qs.quota_relief_pct ?? DEFAULT_QUOTA_RELIEF_PCT));
          }
        })
        .catch(() => setActiveInterventions([]));
    } else {
      setActiveInterventions([]);
    }
  }

  async function recordInterventionsAndCoach(prompt: string, requireLevers: boolean) {
    if (!activeInterventionRep?.rep_id) return;
    if (requireLevers && !takeoverPricingActive && !quotaShieldActive) {
      setInterventionError('Select at least one lever to record, or use Coach Only.');
      return;
    }
    setInterventionSubmitting(true);
    setInterventionError(null);
    setInterventionSuccess(null);
    try {
      if (takeoverPricingActive || quotaShieldActive) {
        const res = await fetch('/api/comp/manager/interventions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            manager_rep_id: activeRepId,
            manager_name: managerWorkspace?.manager_name,
            target_rep_id: activeInterventionRep.rep_id,
            period_id: activePeriodId,
            takeover_pricing: takeoverPricingActive
              ? { enabled: true, discount_pct: takeoverDiscount, tour_id: selectedTourId || null }
              : { enabled: false, discount_pct: 0 },
            quota_shield: quotaShieldActive
              ? { enabled: true, relief_pct: quotaReliefPct }
              : { enabled: false },
          }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        const body = (await res.json()) as { admin_event_ids?: string[] };
        setInterventionSuccess(
          `Recorded ${body.admin_event_ids?.length ?? 0} warehouse event(s) — visible in Comp Admin audit trail.`,
        );
        setDataRefreshKey((k) => k + 1);
        if (useMarketingWorkspace) {
          setWorkspaceLoading(true);
          void fetch(
            `/api/comp/manager/workspace?manager_rep_id=${encodeURIComponent(activeRepId)}&period_id=${encodeURIComponent(activePeriodId)}&_=${Date.now()}`,
          )
            .then(async (r) => (r.ok ? r.json() : null))
            .then((d) => d && setManagerWorkspace(d as ManagerWorkspaceData))
            .finally(() => setWorkspaceLoading(false));
        }
      }
      submitInterventionToCopilot(prompt);
    } catch (err) {
      setInterventionError(err instanceof Error ? err.message : 'Failed to record intervention');
    } finally {
      setInterventionSubmitting(false);
    }
  }

  function submitInterventionToCopilot(prompt: string) {
    setCopilotInput(prompt);
    setActiveInterventionRep(null);
  }

  const activeInterventionView = useMemo(() => {
    if (!activeInterventionRep) return null;
    const opts = interventionOptsFor(activeInterventionRep);
    const gapStyle = gapAnalysisPanelStyle(activeInterventionRep.quota_attainment_pct);
    const repOpenTours = (managerWorkspace?.upcoming_tours ?? []).filter(
      (t) => t.rep_name === activeInterventionRep.agent_name,
    );
    return {
      opts,
      gapStyle,
      repOpenTours,
      gapSummary: buildInterventionGapSummary(activeInterventionRep, opts),
      directive: buildInterventionDirective(activeInterventionRep, opts),
      coachingPrompt: buildInterventionCopilotPrompt(activeInterventionRep, opts),
    };
  }, [activeInterventionRep, interventionOptions, marketByRepName, managerWorkspace?.upcoming_tours]);

  if (!isManager) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 1.5rem', textAlign: 'center', maxWidth: 500, margin: '4rem auto', border: '1px solid var(--danger-border)', background: 'var(--danger-muted)', borderRadius: 'var(--radius-lg)' }}>
        <ShieldAlert size={36} color="var(--danger)" style={{ marginBottom: '1rem' }} />
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: '0.5rem' }}>Access Restricted</h3>
        <p style={{ fontSize: 12, color: 'var(--foreground-muted)', lineHeight: 1.5 }}>
          The Management Hub is reserved for Sales Managers and Compensation Directors. Sales reps are restricted to personal performance records.
        </p>
      </div>
    );
  }

  return (
    <>
    <PageLoadGate loading={pageLoading} steps={loaderSteps} title="Team workspace">
      <div className="animate-fade-in-up" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

      {/* ── Page Header ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="badge badge-blue">
                <Sparkles size={10} style={{ marginRight: 2 }} />
                Management Console
              </span>
              {team && (
                <>
                  <span style={{ fontSize: 11, color: 'var(--foreground-muted)' }}>•</span>
                  <span style={{ fontSize: 11, color: 'var(--foreground-muted)', fontWeight: 600 }}>{displayTeam?.team_name ?? team.team_name}</span>
                </>
              )}
              {!team && displayTeam && (
                <>
                  <span style={{ fontSize: 11, color: 'var(--foreground-muted)' }}>•</span>
                  <span style={{ fontSize: 11, color: 'var(--foreground-muted)', fontWeight: 600 }}>{displayTeam.team_name}</span>
                </>
              )}
            </div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.03em' }}>
              Team Coaching <span className="text-sapphire-gradient">Hub</span>
            </h1>
            <p style={{ fontSize: 12, color: 'var(--foreground-muted)', margin: '0.25rem 0 0', maxWidth: 520 }}>
              Rep interventions, production leaderboard, team scenario modeling, and coaching priorities — payout
              mechanics live on{' '}
              <Link to="/" className="font-semibold text-primary hover:underline">My Compensation</Link>.
              Org-wide saved scenarios and plan design live in the{' '}
              <Link to="/admin-console" className="font-semibold text-primary hover:underline">Strategy Control Room</Link>.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div style={{ padding: '1rem', border: '1px solid var(--danger-border)', background: 'var(--danger-muted)', borderRadius: 'var(--radius)', fontSize: 12, color: 'var(--danger)' }}>
          {formatQueryError(error)}
        </div>
      )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>

          {/* ═════════════════════════════════════════════════════════════════
              TAB 1: COMP ANALYSIS
             ═════════════════════════════════════════════════════════════════ */}
          {displayTeam && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
              {useMarketingWorkspace && (
                <p style={{ fontSize: 12, color: 'var(--foreground-muted)', margin: 0 }}>
                  Operational view for {activeRoleTitle} — who needs intervention, which tours to chase, and where team production is slipping.
                </p>
              )}

              {managerWorkspace && (
                <ManagerAiInsightsPanel
                  managerRepId={activeRepId}
                  periodId={activePeriodId}
                  roleTitle={managerWorkspace.role_title}
                  insightsContext={managerWorkspace.insights_context}
                  personaId={managerWorkspace.persona_id ?? (isMarketingChannel ? 'marketing_manager' : 'sales_manager')}
                  focus="coaching"
                />
              )}
              {/* KPIs */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                <KpiCard
                  label="Team Attainment"
                  value={formatPercent(displayTeam.team_attainment_pct)}
                  icon={<Users size={14} />}
                />
                <KpiCard
                  label="Top Performers"
                  value={String(displayTeam.top_performer_count)}
                  subtext="Above 100% quota"
                  icon={<Award size={14} />}
                  trend="positive"
                />
                <KpiCard
                  label="At-Risk Reps"
                  value={String(displayTeam.at_risk_count)}
                  subtext="Below 70% quota"
                  icon={<AlertTriangle size={14} />}
                  trend="negative"
                />
                {useMarketingWorkspace ? (
                  <KpiCard
                    label="Team NSV"
                    value={formatCurrency(Number((displayTeam as { total_team_nsv?: number }).total_team_nsv ?? 0))}
                    subtext={`${displayAgents.length} direct reports in scope`}
                    icon={<Activity size={14} />}
                  />
                ) : (
                  <KpiCard
                    label="FFS Sales Rate"
                    value={formatPercent(displayTeam.ffs_sales_pct)}
                    subtext={`Target ${formatPercent(displayTeam.ffs_target_pct)} (${formatPercent(displayTeam.ffs_gap_pct)} gap)`}
                    icon={<CheckCircle2 size={14} />}
                    trend={Number(displayTeam.ffs_gap_pct) < 0 ? 'negative' : 'positive'}
                  />
                )}
              </div>

              {/* Redesigned SVG Visual Charts Row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                
                {/* Visual Chart 1: Attainment Distribution Bar Chart */}
                <div className="card" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h4 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--foreground-muted)' }}>Attainment Distribution</h4>
                    <span style={{ fontSize: 10, color: 'var(--foreground-muted)' }}>Count of Reps</span>
                  </div>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'end', gap: '1.5rem', minHeight: 120, paddingBottom: '0.5rem' }}>
                    {/* Bar 1 */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.375rem' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--danger)' }}>{attainmentDistribution.under70}</span>
                      <div style={{
                        width: '100%',
                        height: `${(attainmentDistribution.under70 / maxDistributionVal) * 90}px`,
                        background: 'var(--danger)',
                        borderRadius: '3px 3px 0 0',
                        opacity: 0.85
                      }} />
                      <span style={{ fontSize: 9, color: 'var(--foreground-muted)', fontWeight: 600 }}>&lt; 70%</span>
                    </div>
                    {/* Bar 2 */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.375rem' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--warning)' }}>{attainmentDistribution.range70to100}</span>
                      <div style={{
                        width: '100%',
                        height: `${(attainmentDistribution.range70to100 / maxDistributionVal) * 90}px`,
                        background: 'var(--warning)',
                        borderRadius: '3px 3px 0 0',
                        opacity: 0.85
                      }} />
                      <span style={{ fontSize: 9, color: 'var(--foreground-muted)', fontWeight: 600 }}>70 - 100%</span>
                    </div>
                    {/* Bar 3 */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.375rem' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--success)' }}>{attainmentDistribution.over100}</span>
                      <div style={{
                        width: '100%',
                        height: `${(attainmentDistribution.over100 / maxDistributionVal) * 90}px`,
                        background: 'var(--success)',
                        borderRadius: '3px 3px 0 0',
                        opacity: 0.85
                      }} />
                      <span style={{ fontSize: 9, color: 'var(--foreground-muted)', fontWeight: 600 }}>100%+</span>
                    </div>
                  </div>
                </div>

                {/* Bonus Level Achieved distribution (Jan 2025 tiers 0–8) */}
                <div className="card" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h4 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--foreground-muted)' }}>Bonus Level Achieved (Team)</h4>
                    <span style={{ fontSize: 10, color: 'var(--foreground-muted)' }}>Levels 0–8 · Jan 2025 PDF</span>
                  </div>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'end', gap: '0.375rem', minHeight: 100, paddingBottom: '0.5rem' }}>
                    {bonusTierDistribution.map(({ level, count }) => (
                      <div key={level} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                        <span style={{ fontSize: 9, fontWeight: 700, color: level >= 6 ? 'var(--gold-light)' : 'var(--primary)' }}>{count}</span>
                        <div style={{
                          width: '100%',
                          height: `${Math.max(4, (count / maxBonusTierCount) * 80)}px`,
                          background: level >= 6 ? 'var(--gold)' : level >= 3 ? 'var(--primary)' : 'var(--foreground-faint)',
                          borderRadius: '2px 2px 0 0',
                          opacity: 0.9,
                        }} />
                        <span style={{ fontSize: 8, color: 'var(--foreground-muted)' }}>L{level}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Visual Chart 2 & 3 — sales FFS charts OR marketing plan metrics */}
                {!useMarketingWorkspace && (
                  <>
                    <div className="card" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <h4 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--foreground-muted)' }}>FFS Share of Sales</h4>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1.5rem', flex: 1 }}>
                        <svg width="100" height="100" viewBox="0 0 36 36">
                          <circle cx="18" cy="18" r="15.915" fill="none" stroke="var(--bg-overlay)" strokeWidth="3" />
                          <circle
                            cx="18"
                            cy="18"
                            r="15.915"
                            fill="none"
                            stroke="var(--primary)"
                            strokeWidth="3.2"
                            strokeDasharray={`${Number(displayTeam.ffs_sales_pct)} ${100 - Number(displayTeam.ffs_sales_pct)}`}
                            strokeDashoffset="25"
                          />
                        </svg>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <div>
                            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--foreground-muted)', textTransform: 'uppercase' }}>FFS Sales Rate</div>
                            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--primary)' }}>{formatPercent(displayTeam.ffs_sales_pct)}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--foreground-muted)', textTransform: 'uppercase' }}>Target Rate</div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)' }}>{formatPercent(displayTeam.ffs_target_pct)}</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="card" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <h4 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--foreground-muted)' }}>Product Mix vs Budget</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, position: 'relative', height: '100%' }}>
                        <svg width="140" height="75" viewBox="0 0 100 50">
                          <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="var(--bg-overlay)" strokeWidth="6" strokeLinecap="round" />
                          <path
                            d="M 10 50 A 40 40 0 0 1 90 50"
                            fill="none"
                            stroke="var(--gold)"
                            strokeWidth="6"
                            strokeLinecap="round"
                            strokeDasharray={`${(Number(displayTeam.ffs_sales_pct) / Number(displayTeam.ffs_target_pct || 1)) * 125} 250`}
                          />
                        </svg>
                        <div style={{ textAlign: 'center', marginTop: '-15px' }}>
                          <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--gold-light)' }}>
                            {formatPercent(displayTeam.ffs_sales_pct)}
                          </span>
                          <div style={{ fontSize: 8, color: 'var(--foreground-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                            Target: {formatPercent(displayTeam.ffs_target_pct)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}

              </div>

              {useMarketingWorkspace && (
                <RegionalBonusLevelsPanel
                  areaId="LV-HGV-AL"
                  periodId={activePeriodId}
                  title="LV HGV Action Line — Regional Benchmark"
                />
              )}

              {/* Open tours — coaching opportunities */}
              {managerWorkspace?.upcoming_tours && managerWorkspace.upcoming_tours.length > 0 && (
                <div className="card" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <h3 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CalendarDays size={14} color="var(--primary)" />
                    Open Tours — Conversion Opportunities
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {managerWorkspace.upcoming_tours.map((t) => (
                      <div
                        key={t.tour_id}
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '0.5rem',
                          padding: '0.75rem',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border)',
                          background: 'var(--bg-surface)',
                          fontSize: 11,
                        }}
                      >
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary)' }}>{t.tour_id}</span>
                        <span style={{ fontWeight: 600 }}>{t.rep_name}</span>
                        <span style={{ color: 'var(--foreground-muted)' }}>
                          {t.lead_source ?? 'Tour'} · {t.abc_score}-lead
                        </span>
                        <span>{t.showed_flag ? 'Shown — open close' : 'Pending show'}</span>
                        <span style={{ fontWeight: 700 }}>{formatCurrency(t.net_sales_volume)} NSV</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI coaching signals — LLM interpretation of warehouse flags */}
              {managerWorkspace?.coaching_signals_context && (
                <CompInterpretationPanel
                  endpoint="/api/comp/manager/coaching-signals"
                  insightsContext={managerWorkspace.coaching_signals_context}
                  roleTitle={managerWorkspace.role_title}
                  title="Supporting Signals — AI Prioritized"
                  subtitle="LLM-ranked coaching flags from direct-report production, open tours, and metric attainment. Seed signals are SQL-sourced; recommendations are AI-synthesized."
                  contextLabel="Packaging team production and data-mined seed signals"
                  llmLabel="Prioritizing coaching signals"
                />
              )}

              {displayAgents.length > 0 && teamBaselineEarnings > 0 && (
                <TeamScenarioPanel
                  teamName={String(displayTeam.team_name ?? 'Your team')}
                  isMarketing={useMarketingWorkspace}
                  baselineEarnings={teamBaselineEarnings}
                  baselineAttainment={Number(displayTeam.team_attainment_pct ?? 0)}
                  reportCount={displayAgents.length}
                  reps={displayAgents.map((a) => ({
                    agent_name: a.agent_name,
                    quota_attainment_pct: a.quota_attainment_pct,
                    total_earnings: a.total_earnings,
                  }))}
                />
              )}

              {/* Leaderboard + Copilot Column Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr lg:grid-cols-3', gap: '1.5rem', alignItems: 'start' }}>
                
                {/* Team Leaderboard Table (Left 2 Columns) */}
                <div className="card" style={{ padding: '1.75rem', gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {useMarketingWorkspace ? 'Direct Reports — Production Leaderboard' : 'Agent Performance Leaderboard'}
                    </h3>
                    <span style={{ fontSize: 10, color: 'var(--foreground-muted)' }}>Click headers to sort</span>
                  </div>

                  <div style={{ overflowX: 'auto' }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>
                            <button onClick={() => handleSort('agent_name')} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', background: 'none', border: 'none', color: 'inherit', fontWeight: 'inherit', cursor: 'pointer', padding: 0 }}>
                              Agent
                              <ArrowUpDown size={11} />
                            </button>
                          </th>
                          <th style={{ textAlign: 'center' }}>Level</th>
                          <th style={{ textAlign: 'right' }}>
                            <button onClick={() => handleSort('quota_attainment_pct')} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', background: 'none', border: 'none', color: 'inherit', fontWeight: 'inherit', cursor: 'pointer', padding: 0 }}>
                              Quota Progress
                              <ArrowUpDown size={11} />
                            </button>
                          </th>
                          <th style={{ textAlign: 'right' }}>
                            {useMarketingWorkspace ? (
                              <span>Tours Showed</span>
                            ) : (
                              <button onClick={() => handleSort('ffs_sales_pct')} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', background: 'none', border: 'none', color: 'inherit', fontWeight: 'inherit', cursor: 'pointer', padding: 0 }}>
                                FFS Rate
                                <ArrowUpDown size={11} />
                              </button>
                            )}
                          </th>
                          <th style={{ textAlign: 'right' }}>
                            <button onClick={() => handleSort('total_earnings')} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', background: 'none', border: 'none', color: 'inherit', fontWeight: 'inherit', cursor: 'pointer', padding: 0 }}>
                              Earnings
                              <ArrowUpDown size={11} />
                            </button>
                          </th>
                          <th style={{ textAlign: 'center' }}>Bonus Tier</th>
                          {useMarketingWorkspace && (
                            <>
                              <th style={{ textAlign: 'center' }}>vs Market</th>
                              <th style={{ textAlign: 'center' }}>Risk</th>
                            </>
                          )}
                          <th style={{ textAlign: 'center' }}>Status</th>
                          <th style={{ textAlign: 'center' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedAgents.map((agent) => {
                          const att = Number(agent.quota_attainment_pct ?? 0);
                          const isTop = att >= 100;
                          const isAtRisk = att < 70;
                          const bonusTier = attainmentToBonusLevel(att);
                          const market = useMarketingWorkspace ? lookupMarket(agent.agent_name) : undefined;
                          const combined = market
                            ? combinedAtRiskFlag(att, market.tcc_gap_vs_market_pct)
                            : isAtRisk ? 'AT_RISK' : 'ON_TRACK';
                          return (
                            <tr key={agent.rep_id ?? agent.agent_name} style={{
                              background: combined === 'CRITICAL' ? 'rgba(239, 68, 68, 0.06)' : isAtRisk ? 'rgba(239, 68, 68, 0.02)' : isTop ? 'rgba(34, 197, 94, 0.02)' : 'transparent'
                            }}>
                              <td style={{ fontWeight: 700 }}>{agent.agent_name}</td>
                              <td style={{ textAlign: 'center', color: 'var(--foreground-muted)' }}>{agent.level}</td>
                              <td style={{ textAlign: 'right', fontWeight: 700, color: isTop ? 'var(--success)' : isAtRisk ? 'var(--danger)' : 'var(--foreground)' }}>
                                {formatPercent(agent.quota_attainment_pct)}
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 600 }}>
                                {useMarketingWorkspace
                                  ? (agent.tours_showed ?? '—')
                                  : formatPercent(agent.ffs_sales_pct)}
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatCurrency(agent.total_earnings)}</td>
                              <td style={{ textAlign: 'center', fontWeight: 700, color: bonusTier >= 6 ? 'var(--gold-light)' : 'var(--foreground-muted)' }}>
                                L{bonusTier}
                              </td>
                              {useMarketingWorkspace && (
                                <>
                                  <td style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: market && market.tcc_gap_vs_market_pct <= -10 ? 'var(--danger)' : 'var(--success)' }}>
                                    {market ? `${market.tcc_gap_vs_market_pct > 0 ? '+' : ''}${market.tcc_gap_vs_market_pct}%` : '—'}
                                  </td>
                                  <td style={{ textAlign: 'center' }}>
                                    <span className={`badge ${combined === 'CRITICAL' ? 'badge-red' : combined === 'AT_RISK' ? 'badge-amber' : 'badge-green'}`} style={{ fontSize: 8 }}>
                                      {combined.replace('_', ' ')}
                                    </span>
                                  </td>
                                </>
                              )}
                              <td style={{ textAlign: 'center' }}>
                                <span className={`badge ${isTop ? 'badge-green' : isAtRisk ? 'badge-red' : 'badge-neutral'}`}>
                                  {isTop ? 'Top Performer' : isAtRisk ? 'At Risk' : 'On Track'}
                                </span>
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <button
                                  type="button"
                                  onClick={() => triggerRepIntervention(agent)}
                                  className="btn btn-secondary btn-sm"
                                >
                                  Intervene
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Copilot Sidebar (Right Column) */}
                <div className="card" style={{ padding: '1rem' }}>
                  <CompCopilot
                    title="Team Coaching Copilot"
                    personaLabel="Team Copilot"
                    dataContext={dataContext}
                    contextLoading={false}
                    contextError={error}
                    initialInput={copilotInput}
                    initialInputBehavior="submit"
                    storageKey={`team_coaching_${activeRepId}`}
                    autoInsight={false}
                    examplePrompts={[
                      'Which at-risk rep should I ride with first this week?',
                      'Draft a coaching note for the lowest close-rate rep on open A-leads.',
                      'Who deserves recognition based on this leaderboard?',
                      'Which open tours should we prioritize for a team blitz?',
                    ]}
                  />
                </div>

              </div>
            </div>
          )}

          {!displayTeam && (
            <div style={{ padding: '3rem 2rem', textAlign: 'center', border: '1px dashed var(--border)', borderRadius: 'var(--radius-lg)', color: 'var(--foreground-muted)' }}>
              <Users size={32} style={{ opacity: 0.35, marginBottom: '0.75rem' }} />
              <p style={{ fontWeight: 700, fontSize: 14, color: 'var(--foreground)' }}>No team data for this period</p>
              <p style={{ fontSize: 12, marginTop: 4 }}>Try another period or confirm direct-report hierarchy in the warehouse.</p>
            </div>
          )}

        </div>
      </div>
    </PageLoadGate>


      {/* ─── Player-Coach Takeover Intervention Drawer ─── */}
      {activeInterventionRep && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(6px)',
            zIndex: 100,
            display: 'flex',
            justifyContent: 'flex-end',
            transition: 'opacity 0.3s ease',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveInterventionRep(null);
          }}
        >
          <div
            className="animate-slide-right"
            style={{
              width: '440px',
              height: '100%',
              background: 'rgba(10, 16, 30, 0.95)',
              backdropFilter: 'blur(20px)',
              borderLeft: '1px solid rgba(229, 169, 60, 0.3)', // HGV gold border
              boxShadow: '-10px 0 40px rgba(0, 0, 0, 0.8)',
              padding: '2.5rem 2rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.75rem',
              color: '#ffffff',
              overflowY: 'auto',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span className="badge badge-gold" style={{ fontSize: 9, fontWeight: 800 }}>
                  Active Supervision
                </span>
                <h3 style={{ fontSize: 18, fontWeight: 900, color: 'var(--gold-light)', marginTop: '0.25rem' }}>
                  Manager Coaching Drawer
                </h3>
                <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', marginTop: 4, lineHeight: 1.4 }}>
                  Record levers to the warehouse, then open Copilot with rep context.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveInterventionRep(null)}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '50%',
                  width: 28,
                  height: 28,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'var(--foreground-muted)',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.15)';
                  e.currentTarget.style.color = '#fff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                  e.currentTarget.style.color = 'var(--foreground-muted)';
                }}
              >
                <X size={14} />
              </button>
            </div>

            {/* Rep Card */}
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: 12,
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: '#ffffff' }}>
                  {activeInterventionRep.agent_name}
                </span>
                <span className="badge badge-neutral" style={{ fontSize: 9 }}>
                  {activeInterventionRep.level} Seller
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: 11 }}>
                <div>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 600, fontSize: 9, textTransform: 'uppercase' }}>
                    Quota Attainment
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: Number(activeInterventionRep.quota_attainment_pct) < 70 ? 'var(--danger)' : 'var(--success)' }}>
                    {formatPercent(activeInterventionRep.quota_attainment_pct)}
                  </div>
                </div>
                <div>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 600, fontSize: 9, textTransform: 'uppercase' }}>
                    {useMarketingWorkspace ? 'Tours Showed' : 'FFS Sales Rate'}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#ffffff' }}>
                    {useMarketingWorkspace
                      ? (activeInterventionRep.tours_showed ?? '—')
                      : formatPercent(activeInterventionRep.ffs_sales_pct)}
                  </div>
                </div>
                <div>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 600, fontSize: 9, textTransform: 'uppercase' }}>
                    QTD Earnings
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--gold-light)' }}>
                    {formatCurrency(activeInterventionRep.total_earnings)}
                  </div>
                </div>
                <div>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 600, fontSize: 9, textTransform: 'uppercase' }}>
                    Risk Profile
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: Number(activeInterventionRep.quota_attainment_pct) < 70 ? 'var(--danger)' : 'var(--success)' }}>
                    {activeInterventionRep.performance_band?.replace('_', ' ') ??
                      (Number(activeInterventionRep.quota_attainment_pct) < 70 ? 'AT RISK' : 'ON TRACK')}
                  </div>
                </div>
              </div>
            </div>

            {/* Coaching insight — tone follows attainment band */}
            {activeInterventionView && (
            <div
              style={{
                background: activeInterventionView.gapStyle.background,
                border: activeInterventionView.gapStyle.border,
                borderRadius: 10,
                padding: '0.875rem 1rem',
                fontSize: 11,
                lineHeight: 1.5,
                color: activeInterventionView.gapStyle.color,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontWeight: 800, marginBottom: 4 }}>
                {activeInterventionView.gapStyle.icon === 'danger' ? (
                  <AlertTriangle size={12} color="var(--danger)" />
                ) : activeInterventionView.gapStyle.icon === 'success' ? (
                  <CheckCircle2 size={12} color="var(--success)" />
                ) : (
                  <Activity size={12} color="#F59E0B" />
                )}
                {activeInterventionView.gapStyle.title}
              </div>
              {activeInterventionView.gapSummary}
            </div>
            )}

            {activeInterventions.length > 0 && (
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5, padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.04)', borderRadius: 8 }}>
                <strong style={{ color: 'rgba(255,255,255,0.75)' }}>Active warehouse levers:</strong>{' '}
                {activeInterventions.map((i) =>
                  i.intervention_type === 'TAKEOVER_PRICING'
                    ? `Co-sell pricing ≤${i.discount_pct}%`
                    : `Quota relief ${i.quota_relief_pct}%`,
                ).join(' · ')}
              </div>
            )}

            {/* Co-sell pricing authorization — writes to fact_comp_admin_log */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800 }}>Record Co-Sell Pricing Authorization</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                    Persists TAKEOVER_PRICING to comp admin audit log (not a live Varicent price change).
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Authorize Takeover Pricing Toggle"
                  data-testid="takeover-pricing-toggle"
                  onClick={() => setTakeoverPricingActive(v => !v)}
                  style={{
                    width: 38,
                    height: 20,
                    borderRadius: 100,
                    background: takeoverPricingActive ? 'var(--primary)' : 'rgba(255,255,255,0.15)',
                    border: 'none',
                    position: 'relative',
                    cursor: 'pointer',
                    transition: 'background 0.2s',
                  }}
                >
                  <div
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      background: '#ffffff',
                      position: 'absolute',
                      top: 3,
                      left: takeoverPricingActive ? 21 : 3,
                      transition: 'left 0.2s',
                    }}
                  />
                </button>
              </div>

              {takeoverPricingActive && (
                <div
                  className="animate-fade-in"
                  style={{
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    borderRadius: 10,
                    padding: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.875rem',
                  }}
                >
                  {activeInterventionView && activeInterventionView.repOpenTours.length > 0 && (
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 10 }}>
                      <span style={{ fontWeight: 700, color: 'rgba(255,255,255,0.55)' }}>Linked tour (optional)</span>
                      <select
                        value={selectedTourId}
                        onChange={(e) => setSelectedTourId(e.target.value)}
                        style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '0.5rem', color: '#fff', fontSize: 11 }}
                      >
                        <option value="">— Select open tour —</option>
                        {activeInterventionView.repOpenTours.map((t) => (
                          <option key={t.tour_id} value={t.tour_id}>
                            {t.tour_id} · {t.abc_score}-lead · {t.lead_source}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <Slider
                    id="takeover-discount"
                    label="Co-Sell Pricing Discount"
                    value={takeoverDiscount}
                    min={0}
                    max={15}
                    step={1}
                    unit="%"
                    color="var(--gold)"
                    onChange={setTakeoverDiscount}
                  />
                  <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.4)', lineHeight: 1.4, fontStyle: 'italic' }}>
                    Creates fact_comp_admin_log + fact_manager_intervention rows. Discounts above 10% should follow director approval policy.
                  </div>
                </div>
              )}
            </div>

            {/* Quota relief — updates effective attainment in leaderboard SQL */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800 }}>Record Quota Relief</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                  Persists QUOTA_SHIELD — recalculates effective attainment on the leaderboard.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setQuotaShieldActive(v => !v)}
                style={{
                  width: 38,
                  height: 20,
                  borderRadius: 100,
                  background: quotaShieldActive ? 'var(--success)' : 'rgba(255,255,255,0.15)',
                  border: 'none',
                  position: 'relative',
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                }}
              >
                <div
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: '50%',
                    background: '#ffffff',
                    position: 'absolute',
                    top: 3,
                    left: quotaShieldActive ? 21 : 3,
                    transition: 'left 0.2s',
                  }}
                />
              </button>
            </div>
            {quotaShieldActive && (
              <Slider
                id="quota-relief"
                label="Quota relief %"
                value={quotaReliefPct}
                min={5}
                max={25}
                step={1}
                unit="%"
                color="var(--success)"
                onChange={setQuotaReliefPct}
              />
            )}
            </div>

            {(interventionError || interventionSuccess) && (
              <div style={{
                fontSize: 10,
                padding: '0.625rem 0.75rem',
                borderRadius: 8,
                background: interventionError ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)',
                color: interventionError ? '#fca5a5' : '#6ee7b7',
                border: `1px solid ${interventionError ? 'rgba(239,68,68,0.25)' : 'rgba(16,185,129,0.25)'}`,
              }}>
                {interventionError ?? interventionSuccess}
              </div>
            )}

            {/* Coaching Directive Summary */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>
                Active Coaching Directive
              </div>
              <div
                style={{
                  background: 'rgba(0, 0, 0, 0.25)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  borderRadius: 10,
                  padding: '1rem',
                  fontSize: 11.5,
                  lineHeight: 1.6,
                  color: 'rgba(255, 255, 255, 0.85)',
                }}
              >
                <strong>Focus Area:</strong> {activeInterventionView?.directive}
              </div>
            </div>

            {/* Footer Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: 'auto', paddingTop: '1rem' }}>
              <button
                type="button"
                data-testid="coach-with-copilot"
                disabled={interventionSubmitting}
                onClick={() => {
                  if (activeInterventionView?.coachingPrompt) {
                    void recordInterventionsAndCoach(activeInterventionView.coachingPrompt, false);
                  }
                }}
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 12,
                  padding: '0.75rem',
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#ffffff',
                  cursor: interventionSubmitting ? 'wait' : 'pointer',
                  opacity: interventionSubmitting ? 0.6 : 1,
                  transition: 'all 0.2s',
                }}
              >
                Coach Only (no warehouse write)
              </button>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="button"
                disabled={interventionSubmitting}
                onClick={() => setActiveInterventionRep(null)}
                style={{
                  flex: 1,
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 12,
                  padding: '0.75rem',
                  fontSize: 12,
                  fontWeight: 700,
                  color: 'rgba(255,255,255,0.7)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                Dismiss
              </button>
              <button
                type="button"
                data-testid="submit-ask-advisor"
                disabled={interventionSubmitting}
                onClick={() => {
                  if (!activeInterventionRep || !activeInterventionView) return;
                  void recordInterventionsAndCoach(
                    buildTakeoverAdvisorPrompt(
                      activeInterventionRep,
                      takeoverPricingActive ? takeoverDiscount : 0,
                      quotaShieldActive,
                      activeInterventionView.opts,
                      quotaReliefPct,
                    ),
                    true,
                  );
                }}
                style={{
                  flex: 1.5,
                  background: 'linear-gradient(135deg, var(--gold) 0%, var(--gold-light) 100%)',
                  border: 'none',
                  borderRadius: 12,
                  padding: '0.75rem',
                  fontSize: 12,
                  fontWeight: 800,
                  color: '#000000',
                  cursor: interventionSubmitting ? 'wait' : 'pointer',
                  opacity: interventionSubmitting ? 0.7 : 1,
                  boxShadow: '0 4px 12px rgba(229,169,60,0.3)',
                  transition: 'all 0.2s',
                }}
              >
                {interventionSubmitting ? 'Recording…' : 'Record Levers & Coach'}
              </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
