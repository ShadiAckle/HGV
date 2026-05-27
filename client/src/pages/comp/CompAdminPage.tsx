import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAppContext } from '@/context/AppContext';
import { isMarketingChannelRepId } from '@/data/identityCatalog';
import { CompCopilot } from '@/components/comp/CompCopilot';
import {
  ClipboardCheck, Clock, DollarSign,
  ChevronDown, RefreshCw, User, Calendar, Shield, TrendingDown,
  FileText, ArrowUpRight, Circle
} from 'lucide-react';
import { LuxeDbLoader } from '@/components/comp/LuxeDbLoader';
import { initLoadingSteps, patchLoadingStep, type LoadingStep } from '@/lib/loadingSteps';
import { ADMIN_LOAD_STEP_DEFS } from '@/lib/loadingStepLabels';

// ── Helpers ────────────────────────────────────────────────────────────────────
const fmt = (n: number | null | undefined, dec = 0) =>
  n == null ? '—' : n.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
const fmtUSD = (n: number | null | undefined) =>
  n == null ? '—' : '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtPct = (n: number | null | undefined) =>
  n == null ? '—' : `${Number(n).toFixed(1)}%`;
const dateStr = (s: string | null | undefined) =>
  s ? s.split(' ')[0] : '—';

type TabId = 'eligibility' | 'audit' | 'chargebacks' | 'payroll';

type AdminPayeeRow = {
  rep_id: string;
  rep_name: string;
  level_code: string;
  region: string;
};

const ADMIN_LOAD_STEPS = [...ADMIN_LOAD_STEP_DEFS];

const DEFAULT_ADMIN_REP_ID = 'REP-JASON';

/** Sales reps on the comp-admin payroll roster for a period (excludes marketing channel roster). */
function isCompAdminPayeeRepId(repId: string): boolean {
  return !isMarketingChannelRepId(repId)
    && !repId.startsWith('MKT-')
    && repId !== 'REP-MGR-01';
}

function resolveAdminRepId(activeRepId: string, reps: Array<{ rep_id: string }>): string {
  if (activeRepId && isCompAdminPayeeRepId(activeRepId) && reps.some((r) => r.rep_id === activeRepId)) {
    return activeRepId;
  }
  const salesReps = reps.filter((r) => isCompAdminPayeeRepId(r.rep_id));
  return salesReps.find((r) => r.rep_id === DEFAULT_ADMIN_REP_ID)?.rep_id
    ?? salesReps[0]?.rep_id
    ?? DEFAULT_ADMIN_REP_ID;
}

const ADMIN_PROMPTS = [
  'Is Jason Morrison eligible for the Q2 2026 commission plan?',
  'Which components apply to an L6 rep at the LAS location?',
  'Show me the full payout calculation trail for Jason Morrison in Q2 2026.',
  'D. Lee started mid-January — what is their proration percentage?',
  'Was E. Carter on LOA during Q1? How does that affect their payout?',
  'Which reps have open chargebacks this period?',
  'What is the total reserve liability for Q2 2026?',
  'Show all manual adjustments pending approval this period.',
  'What SPIFF events were approved in Q1 and by whom?',
  'Are there any data quality issues affecting the Varicent file this period?',
  'What is the payroll lock date for Q2 2026?',
  'Summarize the audit trail for R. Smith in Q1 — include the transfer and rescission.',
  'Which deals are at risk of chargeback due to short rescission window?',
  'What is the net payable for all reps after adjustments in Q1?',
  'Explain the reserve release schedule for FFS product commissions.',
] as const;

function buildAdminContext(data: {
  eligibility?: Record<string, unknown> | null;
  rep?: Record<string, unknown> | null;
  planRoster?: Record<string, unknown>[];
  planComponents?: Record<string, unknown>[];
  payoutTrail?: {
    quota?: Record<string, unknown> | null;
    payout?: Record<string, unknown> | null;
    deals?: Record<string, unknown>[];
    adjustments?: Record<string, unknown>[];
    summary?: Record<string, unknown> | null;
  } | null;
  chargebacks?: Record<string, unknown>[];
  chargebackTotals?: Record<string, unknown> | null;
  auditLog?: Record<string, unknown>[];
  payroll?: Record<string, unknown>[];
  payrollGrandTotal?: number;
  selectedRepId: string;
  selectedPeriodId: string;
}): string {
  const parts: string[] = [];
  parts.push(`## Comp Admin Context — ${data.selectedPeriodId}`);

  if (data.rep) {
    const r = data.rep as any;
    parts.push(`\n### Selected Rep: ${r.rep_name ?? data.selectedRepId} (${r.level_code ?? '—'}, ${r.region ?? '—'})`);
  }

  if (data.eligibility) {
    const e = data.eligibility as any;
    parts.push(`\n### Plan Eligibility`);
    parts.push(`- Plan: ${e.plan_name ?? e.plan_version_id ?? '—'}`);
    parts.push(`- Eligible: ${e.eligibility_flag === 'true' || e.eligibility_flag === true ? 'YES' : 'NO'}`);
    parts.push(`- Proration: ${fmtPct(e.proration_pct)} of full period`);
    parts.push(`- Job Code: ${e.job_code ?? '—'} | Location: ${e.location_code ?? '—'} | Brand: ${e.brand ?? '—'}`);
    parts.push(`- Effective: ${dateStr(e.effective_start)} – ${e.effective_end ? dateStr(e.effective_end) : 'Current'}`);
    if (e.exclusion_reason) parts.push(`- Exclusion Reason: ${e.exclusion_reason}`);
  }

  if (data.planRoster?.length) {
    parts.push(`\n### Plan Eligibility Roster (${data.planRoster.length} reps)`);
    data.planRoster.forEach((row: any) => {
      parts.push(`- ${row.rep_name ?? row.rep_id}: ${row.job_code ?? '—'} @ ${row.location_code ?? '—'} (${row.level_code ?? '—'}) — ${row.plan_name ?? row.plan_version_id ?? '—'}`);
    });
  }

  if (data.planComponents?.length) {
    parts.push(`\n### Plan Components (dim_plan_component)`);
    let lastKey = '';
    data.planComponents.forEach((c: any) => {
      const key = `${c.job_code}|${c.location_code ?? 'ALL'}`;
      if (key !== lastKey) {
        parts.push(`\n**${c.job_code} @ ${c.location_code ?? 'ALL'}**`);
        lastKey = key;
      }
      const rate = c.rate_pct != null ? `${Number(c.rate_pct).toFixed(1)}%` : null;
      const thresh = c.threshold_pct != null ? ` @ ${Number(c.threshold_pct).toFixed(0)}%+` : '';
      const amt = c.amount_usd != null ? fmtUSD(c.amount_usd) : null;
      parts.push(`- ${c.component_name}: ${rate ?? amt ?? ''}${thresh}${c.rule_notes ? ` — ${c.rule_notes}` : ''}`);
    });
  }

  if (data.payoutTrail) {
    const pt = data.payoutTrail;
    if (pt.quota) {
      const q = pt.quota as any;
      parts.push(`\n### Quota & Attainment`);
      parts.push(`- Quota: ${fmtUSD(q.quota_amount)} | Credited: ${fmtUSD(q.credited_amount)} | Attainment: ${fmtPct(q.attainment_pct)}`);
      parts.push(`- Deals Closed: ${q.deals_closed_count ?? '—'}`);
    }
    if (pt.payout) {
      const p = pt.payout as any;
      parts.push(`\n### Payout Breakdown`);
      parts.push(`- Base Pay: ${fmtUSD(p.base_pay)} | Commission: ${fmtUSD(p.commission)} | Bonus: ${fmtUSD(p.bonus)}`);
      parts.push(`- Total Earnings: ${fmtUSD(p.total_earnings)} | Total Paid: ${fmtUSD(p.total_paid)}`);
    }
    if (pt.summary) {
      const s = pt.summary as any;
      parts.push(`- Manual Adjustments Net: ${fmtUSD(s.total_adjustments)} | Net Commission After Adj: ${fmtUSD(s.net_commission_after_adj)}`);
    }
    if (pt.adjustments?.length) {
      parts.push(`\n### Adjustments (${pt.adjustments.length})`);
      pt.adjustments.slice(0, 5).forEach((a: any) => {
        parts.push(`- [${a.event_type}] ${fmtUSD(a.amount)} — ${a.reason} (Approved by: ${a.approved_by ?? 'PENDING'})`);
      });
    }
  }

  if (data.chargebacks?.length) {
    parts.push(`\n### Chargebacks (${data.chargebacks.length} records)`);
    const t = data.chargebackTotals as any;
    if (t) {
      parts.push(`- Total Chargedback: ${fmtUSD(t.total_chargebacks)} | Reserve Held: ${fmtUSD(t.total_reserve_held)} | Released: ${fmtUSD(t.total_reserve_released)}`);
      parts.push(`- Open: ${t.open_count} | Closed: ${t.closed_count}`);
    }
  }

  if (data.auditLog?.length) {
    parts.push(`\n### Audit Events (${data.auditLog.length} total)`);
    data.auditLog.slice(0, 8).forEach((e: any) => {
      parts.push(`- [${dateStr(e.created_at)}] ${e.event_type}: ${e.reason}${e.amount != null ? ` (${fmtUSD(e.amount)})` : ''}`);
    });
  }

  if (data.payroll?.length) {
    parts.push(`\n### Payroll Preview — Grand Total: ${fmtUSD(data.payrollGrandTotal)}`);
    data.payroll.slice(0, 6).forEach((r: any) => {
      parts.push(`- ${r.rep_name ?? r.rep_id}: Net Payable ${fmtUSD(r.net_payable)}`);
    });
  }

  parts.push(`\n### Plan Rules (PLAN-FT-2026 defaults)`);
  parts.push(`- Base Commission Rate: 6.0% on credited deals`);
  parts.push(`- Volume Bonus: 2.5% at 100%+ quota attainment`);
  parts.push(`- Proration: New hires pro-rated by days in period; LOA suspends eligibility`);
  parts.push(`- Reserve: 12% held on FFS product sales for 6 months`);
  parts.push(`- SPIFF Approval: <$5K auto, $5K-15K Regional Dir, $15K-30K VP Comp, >$30K EVP`);
  parts.push(`- Payroll Lock: 15th of following month`);

  return parts.join('\n');
}

// ── Event icon/color mapping ──────────────────────────────────────────────────
const EVENT_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  ADJUSTMENT:       { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', label: 'Adjustment' },
  MANUAL_PAY:       { color: '#10B981', bg: 'rgba(16,185,129,0.12)', label: 'Manual Pay' },
  SPIFF:            { color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)', label: 'SPIFF' },
  SPIFF_APPROVAL:   { color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)', label: 'SPIFF Approved' },
  LOA_START:        { color: '#EF4444', bg: 'rgba(239,68,68,0.12)',  label: 'LOA Start' },
  LOA_END:          { color: '#10B981', bg: 'rgba(16,185,129,0.12)', label: 'LOA End' },
  TRANSFER:         { color: '#3B82F6', bg: 'rgba(59,130,246,0.12)', label: 'Transfer' },
  TERMINATION:      { color: '#EF4444', bg: 'rgba(239,68,68,0.12)',  label: 'Termination' },
  RESCISSION:       { color: '#F97316', bg: 'rgba(249,115,22,0.12)', label: 'Rescission' },
  CHARGEBACK:       { color: '#EF4444', bg: 'rgba(239,68,68,0.12)',  label: 'Chargeback' },
  DATA_QUALITY_FIX: { color: '#6B7280', bg: 'rgba(107,114,128,0.12)', label: 'Data Fix' },
};

const STATUS_CHIP: Record<string, { color: string; bg: string }> = {
  OPEN:    { color: '#F59E0B', bg: 'rgba(245,158,11,0.15)'  },
  CLOSED:  { color: '#10B981', bg: 'rgba(16,185,129,0.15)' },
  PENDING: { color: '#3B82F6', bg: 'rgba(59,130,246,0.15)' },
};

// ── Sub-components ────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, icon: Icon, accent }: {
  label: string; value: string; sub?: string; icon: React.ComponentType<any>; accent?: string;
}) {
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius)', padding: '1.25rem 1.5rem',
      display: 'flex', alignItems: 'flex-start', gap: '1rem', flex: 1, minWidth: 180,
      boxShadow: 'var(--shadow-sm)',
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10,
        background: accent ? `${accent}20` : 'var(--primary-muted)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon size={18} color={accent ?? 'var(--primary)'} />
      </div>
      <div>
        <div style={{ fontSize: 11, color: 'var(--foreground-muted)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--foreground)', lineHeight: 1.1 }}>{value}</div>
        {sub && <div style={{ fontSize: 11, color: 'var(--foreground-muted)', marginTop: 4 }}>{sub}</div>}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export function CompAdminPage() {
  const { activeRepId, activePeriodId, metadata } = useAppContext();
  const [activeTab, setActiveTab] = useState<TabId>('eligibility');

  const [selectedRepId, setSelectedRepId] = useState(DEFAULT_ADMIN_REP_ID);
  const [repPickerOpen, setRepPickerOpen] = useState(false);
  const [repSearch, setRepSearch] = useState('');

  // Data states
  const [eligData, setEligData]           = useState<any>(null);
  const [payoutTrail, setPayoutTrail]     = useState<any>(null);
  const [cbData, setCbData]               = useState<any>(null);
  const [auditData, setAuditData]         = useState<any>(null);
  const [payrollData, setPayrollData]     = useState<any>(null);
  const [catalogData, setCatalogData]     = useState<any>(null);
  const [loading, setLoading]             = useState(false);
  const [loadError, setLoadError]         = useState<string | null>(null);
  const [loadSteps, setLoadSteps] = useState<LoadingStep[]>(() => initLoadingSteps([...ADMIN_LOAD_STEPS]));

  const [showAuditExport, setShowAuditExport] = useState(false);

  const periodId = activePeriodId ?? '2026-Q2';

  /** Payees on payroll for this period — same source as Active Payees KPI and rep picker. */
  const adminPayees = useMemo<AdminPayeeRow[]>(
    () =>
      (payrollData?.payroll ?? [])
        .filter((row: { rep_id?: string }) => row.rep_id && isCompAdminPayeeRepId(row.rep_id))
        .map((row: { rep_id: string; rep_name?: string; level_code?: string; region?: string }) => ({
          rep_id: row.rep_id,
          rep_name: row.rep_name ?? row.rep_id,
          level_code: row.level_code ?? '—',
          region: row.region ?? '—',
        })),
    [payrollData?.payroll],
  );

  const repsList = adminPayees;
  const selectedRep = repsList.find((r) => r.rep_id === selectedRepId);

  useEffect(() => {
    if (adminPayees.length) return;
    const reps = metadata?.reps ?? [];
    if (!reps.length) return;
    setSelectedRepId((current) => {
      const salesReps = reps.filter((r) => isCompAdminPayeeRepId(r.rep_id));
      if (salesReps.some((r) => r.rep_id === current)) return current;
      return resolveAdminRepId(activeRepId, salesReps);
    });
  }, [activeRepId, metadata?.reps, adminPayees.length]);

  useEffect(() => {
    if (!adminPayees.length) return;
    setSelectedRepId((current) => {
      if (adminPayees.some((r) => r.rep_id === current)) return current;
      return resolveAdminRepId(activeRepId, adminPayees);
    });
  }, [adminPayees, activeRepId]);

  useEffect(() => {
    if (!repPickerOpen) setRepSearch('');
  }, [repPickerOpen]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setLoadSteps(initLoadingSteps([...ADMIN_LOAD_STEPS]));

    const fetchStep = async (id: string, url: string) => {
      setLoadSteps((prev) => patchLoadingStep(prev, id, 'active'));
      try {
        const res = await fetch(url);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setLoadSteps((prev) => patchLoadingStep(prev, id, 'error'));
          return null;
        }
        setLoadSteps((prev) => patchLoadingStep(prev, id, 'done'));
        return data;
      } catch {
        setLoadSteps((prev) => patchLoadingStep(prev, id, 'error'));
        return null;
      }
    };

    const [elig, trail, cb, audit, payroll] = await Promise.all([
      fetchStep('eligibility', `/api/comp/admin/eligibility?rep_id=${selectedRepId}&period_id=${periodId}`),
      fetchStep('trail', `/api/comp/admin/payout-trail?rep_id=${selectedRepId}&period_id=${periodId}`),
      fetchStep('chargebacks', `/api/comp/admin/chargebacks?period_id=${periodId}`),
      fetchStep('audit', `/api/comp/admin/audit-log?rep_id=${selectedRepId}&period_id=${periodId}`),
      fetchStep('payroll', `/api/comp/admin/payroll-preview?period_id=${periodId}`),
    ]);

    let catalog: { roster?: unknown[]; components?: unknown[] } | null = null;
    try {
      const catalogRes = await fetch(`/api/comp/admin/catalog-context?period_id=${periodId}`);
      if (catalogRes.ok) catalog = await catalogRes.json();
    } catch {
      catalog = null;
    }

    setEligData(elig);
    setPayoutTrail(trail);
    setCbData(cb);
    setAuditData(audit);
    setPayrollData(payroll);
    setCatalogData(catalog);

    const allEmpty = !elig && !trail && !cb && !audit && !payroll;
    const allFailed = [elig, trail, cb, audit, payroll].every((d) => d == null);
    if (allFailed) {
      setLoadError('Comp Admin data could not be loaded. Admin tables may still be seeding — try Refresh in a moment.');
    } else if (allEmpty) {
      setLoadError(`No comp admin records found for ${selectedRepId} in ${periodId}. Pick a sales rep from the dropdown.`);
    }

    setLoading(false);
  }, [selectedRepId, periodId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // KPI rollups
  const openCBCount  = cbData?.totals?.open_count ?? 0;
  const totalReserve = cbData?.totals?.total_reserve_held ?? 0;
  const payrollTotal = payrollData?.grand_total ?? 0;
  const payrollCount = adminPayees.length || payrollData?.payroll?.length || 0;
  const auditCount   = auditData?.total ?? 0;

  // Copilot context
  const groundingContext = buildAdminContext({
    eligibility: eligData?.eligibility,
    rep: eligData?.rep,
    planRoster: catalogData?.roster,
    planComponents: catalogData?.components,
    payoutTrail: payoutTrail ? {
      quota: payoutTrail.quota,
      payout: payoutTrail.payout,
      deals: payoutTrail.deals,
      adjustments: payoutTrail.adjustments,
      summary: payoutTrail.summary,
    } : null,
    chargebacks: cbData?.chargebacks,
    chargebackTotals: cbData?.totals,
    auditLog: auditData?.events,
    payroll: payrollData?.payroll,
    payrollGrandTotal: payrollTotal,
    selectedRepId,
    selectedPeriodId: periodId,
  });

  const TABS: { id: TabId; label: string; icon: React.ComponentType<any> }[] = [
    { id: 'eligibility', label: 'Eligibility',     icon: Shield },
    { id: 'audit',       label: 'Audit Trail',     icon: Clock },
    { id: 'chargebacks', label: 'Chargebacks',     icon: TrendingDown },
    { id: 'payroll',     label: 'Payroll Preview', icon: DollarSign },
  ];

  return (
    <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>

      {/* ── LEFT MAIN CONTENT ── */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '1.5rem', position: 'relative', minHeight: '600px' }}>
        <LuxeDbLoader loading={loading} steps={loadSteps} title="Comp admin console" />

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: 6 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(245,158,11,0.35)',
              }}>
                <ClipboardCheck size={18} color="#fff" />
              </div>
              <div>
                <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--foreground)', margin: 0, lineHeight: 1.1 }}>
                  Comp Administration Agent
                </h1>
                <div style={{ fontSize: 12, color: 'var(--foreground-muted)', marginTop: 2 }}>
                  Plan eligibility · Audit trail · Chargebacks · Payroll · Data quality
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexShrink: 0 }}>
            {/* Rep Picker */}
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setRepPickerOpen(v => !v)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)', padding: '0.375rem 0.75rem',
                  fontSize: 12, fontWeight: 600, color: 'var(--foreground)', cursor: 'pointer',
                }}
              >
                <User size={13} color="var(--foreground-muted)" />
                {selectedRep?.rep_name ?? selectedRepId}
                <ChevronDown size={12} color="var(--foreground-muted)" style={{ transform: repPickerOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
              </button>
              {repPickerOpen && (
                <div className="animate-fade-in" style={{
                  position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 100,
                  background: 'var(--bg-overlay)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)', padding: '0.25rem', minWidth: 220,
                  boxShadow: 'var(--shadow-lg)',
                  maxHeight: '280px',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                }}>
                  <div style={{ padding: '0.25rem', position: 'sticky', top: 0, background: 'var(--bg-overlay)', zIndex: 10, borderBottom: '1px solid var(--border)', marginBottom: '0.25rem' }}>
                    <input
                      type="text"
                      placeholder="Search representative..."
                      value={repSearch}
                      onChange={(e) => setRepSearch(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        width: '100%',
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border)',
                        borderRadius: '4px',
                        padding: '0.35rem 0.5rem',
                        fontSize: '11px',
                        color: 'var(--foreground)',
                        outline: 'none',
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                    {repsList.length === 0 && (
                      <div style={{ padding: '0.75rem', fontSize: 11, color: 'var(--foreground-muted)', textAlign: 'center' }}>
                        {loading ? 'Loading payees…' : 'No payees on payroll for this period.'}
                      </div>
                    )}
                    {repsList
                      .filter((rep: AdminPayeeRow) => {
                        const name = String(rep.rep_name ?? '').toLowerCase();
                        const id = String(rep.rep_id ?? '').toLowerCase();
                        const q = repSearch.toLowerCase();
                        return name.includes(q) || id.includes(q);
                      })
                      .map((rep: any) => (
                        <button key={rep.rep_id} type="button"
                          onClick={() => { setSelectedRepId(rep.rep_id); setRepPickerOpen(false); }}
                          style={{
                            width: '100%', textAlign: 'left', padding: '0.5rem 0.75rem',
                            borderRadius: 6, fontSize: 12, fontWeight: 600,
                            background: selectedRepId === rep.rep_id ? 'rgba(245,158,11,0.12)' : 'transparent',
                            color: selectedRepId === rep.rep_id ? '#F59E0B' : 'var(--foreground)',
                            border: 'none', cursor: 'pointer',
                          }}
                        >{rep.rep_name} <span style={{ color: 'var(--foreground-muted)', fontWeight: 400 }}>({rep.level_code})</span></button>
                      ))}
                  </div>
                </div>
              )}
            </div>

            <button
              type="button" onClick={loadAll} disabled={loading}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.375rem',
                padding: '0.375rem 0.75rem', background: 'var(--bg-elevated)',
                border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                fontSize: 11, fontWeight: 600, color: 'var(--foreground-muted)', cursor: 'pointer',
              }}
            >
              <RefreshCw size={12} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
              {loading ? 'Loading…' : 'Refresh'}
            </button>
          </div>
        </div>

        {loadError && (
          <div style={{
            padding: '0.875rem 1rem',
            border: '1px solid var(--warning-border, rgba(245,158,11,0.35))',
            background: 'rgba(245,158,11,0.08)',
            borderRadius: 'var(--radius)',
            fontSize: 12,
            color: 'var(--foreground)',
          }}>
            {loadError}
          </div>
        )}

        {/* KPI Cards */}
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <KpiCard
            label="Active Payees"
            value={fmt(payrollCount)}
            sub={`${periodId} · on payroll · ${fmtUSD(payrollTotal)} total`}
            icon={User}
            accent="#F59E0B"
          />
          <KpiCard
            label="Open Chargebacks"
            value={fmt(openCBCount)}
            sub={`${fmtUSD(totalReserve)} reserve held`}
            icon={TrendingDown}
            accent="#EF4444"
          />
          <KpiCard
            label="Audit Events"
            value={fmt(auditCount)}
            sub="This period — selected rep"
            icon={FileText}
            accent="#8B5CF6"
          />
          <KpiCard
            label="Payroll Lock Date"
            value="Jul 15"
            sub={`${periodId} final`}
            icon={Calendar}
            accent="#10B981"
          />
        </div>

        {/* Tabs */}
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', overflow: 'hidden',
          boxShadow: 'var(--shadow-sm)',
        }}>
          {/* Tab bar */}
          <div style={{
            display: 'flex', borderBottom: '1px solid var(--border)',
            background: 'var(--bg-elevated)', padding: '0 1.25rem',
          }}>
            {TABS.map(tab => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.375rem',
                    padding: '0.75rem 1rem', fontSize: 12, fontWeight: 700,
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    color: isActive ? '#F59E0B' : 'var(--foreground-muted)',
                    borderBottom: isActive ? '2px solid #F59E0B' : '2px solid transparent',
                    transition: 'color 0.15s',
                  }}
                >
                  <tab.icon size={13} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Tab content */}
          <div style={{ padding: '1.5rem' }}>

            {/* ELIGIBILITY TAB */}
            {activeTab === 'eligibility' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {/* Plan assignment card */}
                <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.25rem' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--foreground-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '1rem' }}>Plan Assignment</div>
                  {eligData?.eligibility ? (() => {
                    const e = eligData.eligibility;
                    return (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem' }}>
                        {[
                          { label: 'Plan', value: e.plan_name ?? e.plan_version_id },
                          { label: 'Status', value: e.eligibility_flag === 'true' || e.eligibility_flag === true ? '✓ Eligible' : '✗ Ineligible', accent: e.eligibility_flag ? '#10B981' : '#EF4444' },
                          { label: 'Proration', value: fmtPct(e.proration_pct) },
                          { label: 'Job Code', value: e.job_code },
                          { label: 'Location', value: e.location_code },
                          { label: 'Brand', value: e.brand },
                          { label: 'Effective Start', value: dateStr(e.effective_start) },
                          { label: 'Effective End', value: e.effective_end ? dateStr(e.effective_end) : 'Current' },
                        ].map(item => (
                          <div key={item.label}>
                            <div style={{ fontSize: 10, color: 'var(--foreground-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{item.label}</div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: (item as any).accent ?? 'var(--foreground)' }}>{item.value ?? '—'}</div>
                          </div>
                        ))}
                      </div>
                    );
                  })() : (
                    <div style={{ color: 'var(--foreground-muted)', fontSize: 13 }}>No eligibility record found for this rep in {periodId}.</div>
                  )}
                </div>

                {/* Payout trail */}
                {payoutTrail && (
                  <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.25rem' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--foreground-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '1rem' }}>Calculation Trail</div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      {[
                        { label: 'Quota', value: fmtUSD(payoutTrail.quota?.quota_amount) },
                        { label: 'Credited', value: fmtUSD(payoutTrail.quota?.credited_amount) },
                        { label: 'Attainment', value: fmtPct(payoutTrail.quota?.attainment_pct) },
                        { label: 'Commission', value: fmtUSD(payoutTrail.payout?.commission) },
                        { label: 'Bonus', value: fmtUSD(payoutTrail.payout?.bonus) },
                        { label: 'Adjustments', value: fmtUSD(payoutTrail.summary?.total_adjustments) },
                        { label: 'Total Earned', value: fmtUSD(payoutTrail.payout?.total_earnings) },
                      ].map((step, i, arr) => (
                        <div key={step.label} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 10, color: 'var(--foreground-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{step.label}</div>
                            <div style={{ fontSize: 14, fontWeight: 800, color: i === arr.length - 1 ? '#F59E0B' : 'var(--foreground)' }}>{step.value}</div>
                          </div>
                          {i < arr.length - 1 && <ArrowUpRight size={14} color="var(--foreground-muted)" />}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* AUDIT TRAIL TAB */}
            {activeTab === 'audit' && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--foreground-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Event Timeline — {selectedRep?.rep_name ?? selectedRepId} · {periodId}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAuditExport(true)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.375rem',
                      padding: '0.375rem 0.75rem', background: 'var(--bg-elevated)',
                      border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                      fontSize: 11, fontWeight: 700, color: 'var(--foreground)', cursor: 'pointer',
                      boxShadow: 'var(--shadow-sm)', transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = '#F59E0B'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                  >
                    <FileText size={13} style={{ marginRight: 4 }} color="var(--foreground-muted)" /> Export Audit Log
                  </button>
                </div>
                {auditData?.events?.length ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 0, position: 'relative' }}>
                    {/* Vertical line */}
                    <div style={{
                      position: 'absolute', left: 19, top: 20, bottom: 20,
                      width: 2, background: 'var(--border)',
                    }} />
                    {(auditData.events as any[]).map((event: any, i: number) => {
                      const cfg = EVENT_CONFIG[event.event_type] ?? { color: '#6B7280', bg: 'rgba(107,114,128,0.12)', label: event.event_type };
                      return (
                        <div key={event.event_id ?? i} style={{ display: 'flex', gap: '1rem', padding: '0.75rem 0', position: 'relative', zIndex: 1 }}>
                          {/* Node */}
                          <div style={{
                            width: 40, height: 40, borderRadius: '50%',
                            background: cfg.bg, border: `2px solid ${cfg.color}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0,
                          }}>
                            <Circle size={10} color={cfg.color} fill={cfg.color} />
                          </div>
                          <div style={{
                            flex: 1, background: cfg.bg, border: `1px solid ${cfg.color}30`,
                            borderRadius: 10, padding: '0.75rem 1rem',
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{
                                  fontSize: 10, fontWeight: 800, color: cfg.color,
                                  background: `${cfg.color}20`, padding: '2px 8px',
                                  borderRadius: 100, letterSpacing: '0.05em', textTransform: 'uppercase',
                                }}>{cfg.label}</span>
                                {event.amount != null && (
                                  <span style={{ fontSize: 13, fontWeight: 700, color: Number(event.amount) >= 0 ? '#10B981' : '#EF4444' }}>
                                    {Number(event.amount) >= 0 ? '+' : ''}{fmtUSD(event.amount)}
                                  </span>
                                )}
                              </div>
                              <span style={{ fontSize: 10, color: 'var(--foreground-muted)' }}>{dateStr(event.created_at)}</span>
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--foreground)', marginTop: 4 }}>{event.reason}</div>
                            {event.approved_by && (
                              <div style={{ fontSize: 10, color: 'var(--foreground-muted)', marginTop: 3 }}>
                                Approved by: {event.approved_by}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ color: 'var(--foreground-muted)', fontSize: 13, padding: '2rem', textAlign: 'center' }}>
                    No audit events found for this rep in {periodId}.
                  </div>
                )}
              </div>
            )}

            {/* CHARGEBACKS TAB */}
            {activeTab === 'chargebacks' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {/* Totals */}
                {cbData?.totals && (() => {
                  const t = cbData.totals;
                  return (
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                      {[
                        { label: 'Total Chargedback', value: fmtUSD(t.total_chargebacks), color: '#EF4444' },
                        { label: 'Reserve Held', value: fmtUSD(t.total_reserve_held), color: '#F59E0B' },
                        { label: 'Reserve Released', value: fmtUSD(t.total_reserve_released), color: '#10B981' },
                        { label: 'Open / Closed', value: `${t.open_count} / ${t.closed_count}`, color: 'var(--foreground)' },
                      ].map(item => (
                        <div key={item.label} style={{
                          flex: 1, minWidth: 140, padding: '0.875rem 1rem',
                          background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10,
                        }}>
                          <div style={{ fontSize: 10, color: 'var(--foreground-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{item.label}</div>
                          <div style={{ fontSize: 16, fontWeight: 800, color: item.color }}>{item.value}</div>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {/* Table */}
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        {['Chargeback ID', 'Deal ID', 'Rep', 'Orig Commission', 'Chargeback', 'Reserve Held', 'Released', 'Reason', 'Status'].map(h => (
                          <th key={h} style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--foreground-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(cbData?.chargebacks ?? []).map((cb: any, i: number) => {
                        const sc = STATUS_CHIP[cb.status] ?? { color: '#6B7280', bg: 'rgba(107,114,128,0.12)' };
                        return (
                          <tr key={cb.chargeback_id ?? i} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.15s' }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                          >
                            <td style={{ padding: '0.625rem 0.75rem', fontFamily: 'monospace', color: '#F59E0B', fontWeight: 700, fontSize: 11 }}>{cb.chargeback_id}</td>
                            <td style={{ padding: '0.625rem 0.75rem', fontFamily: 'monospace', fontSize: 11, color: 'var(--foreground-muted)' }}>{cb.deal_id}</td>
                            <td style={{ padding: '0.625rem 0.75rem', fontWeight: 600 }}>{cb.rep_id}</td>
                            <td style={{ padding: '0.625rem 0.75rem', textAlign: 'right' }}>{fmtUSD(cb.original_commission)}</td>
                            <td style={{ padding: '0.625rem 0.75rem', textAlign: 'right', color: '#EF4444', fontWeight: 700 }}>{fmtUSD(cb.chargeback_amount)}</td>
                            <td style={{ padding: '0.625rem 0.75rem', textAlign: 'right', color: '#F59E0B' }}>{fmtUSD(cb.reserve_held)}</td>
                            <td style={{ padding: '0.625rem 0.75rem', textAlign: 'right', color: '#10B981' }}>{fmtUSD(cb.reserve_released)}</td>
                            <td style={{ padding: '0.625rem 0.75rem', color: 'var(--foreground-muted)' }}>{cb.reason}</td>
                            <td style={{ padding: '0.625rem 0.75rem' }}>
                              <span style={{
                                fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 100,
                                background: sc.bg, color: sc.color, letterSpacing: '0.05em',
                              }}>{cb.status}</span>
                            </td>
                          </tr>
                        );
                      })}
                      {!cbData?.chargebacks?.length && (
                        <tr><td colSpan={9} style={{ padding: '2rem', textAlign: 'center', color: 'var(--foreground-muted)' }}>No chargeback records found for {periodId}.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* PAYROLL PREVIEW TAB */}
            {activeTab === 'payroll' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)' }}>Payroll Preview — {periodId}</div>
                    <div style={{ fontSize: 11, color: 'var(--foreground-muted)', marginTop: 2 }}>
                      Amounts include manual adjustments from <code>fact_comp_admin_log</code>.
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: 'var(--foreground-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Grand Total</div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: '#F59E0B' }}>{fmtUSD(payrollData?.grand_total)}</div>
                  </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        {['Rep', 'Level', 'Region', 'Base Pay', 'Commission', 'Bonus', 'Adjustments', 'Net Payable'].map(h => (
                          <th key={h} style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--foreground-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(payrollData?.payroll ?? []).map((row: any, i: number) => (
                          <tr key={row.rep_id ?? i}
                            style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.15s' }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                          >
                            <td style={{ padding: '0.625rem 0.75rem', fontWeight: 700 }}>{row.rep_name}</td>
                            <td style={{ padding: '0.625rem 0.75rem', color: 'var(--foreground-muted)' }}>{row.level_code}</td>
                            <td style={{ padding: '0.625rem 0.75rem', color: 'var(--foreground-muted)' }}>{row.region}</td>
                            <td style={{ padding: '0.625rem 0.75rem', textAlign: 'right' }}>{fmtUSD(row.base_pay)}</td>
                            <td style={{ padding: '0.625rem 0.75rem', textAlign: 'right' }}>{fmtUSD(row.commission)}</td>
                            <td style={{ padding: '0.625rem 0.75rem', textAlign: 'right' }}>{fmtUSD(row.bonus)}</td>
                            <td style={{ padding: '0.625rem 0.75rem', textAlign: 'right', color: Number(row.manual_adjustments) !== 0 ? (Number(row.manual_adjustments) > 0 ? '#10B981' : '#EF4444') : 'var(--foreground-muted)' }}>
                              {Number(row.manual_adjustments) > 0 ? '+' : ''}{fmtUSD(row.manual_adjustments)}
                            </td>
                            <td style={{ padding: '0.625rem 0.75rem', textAlign: 'right', fontWeight: 800, color: '#F59E0B' }}>{fmtUSD(row.net_payable)}</td>
                          </tr>
                        ))}
                      {!payrollData?.payroll?.length && (
                        <tr><td colSpan={8} style={{ padding: '2rem', textAlign: 'center', color: 'var(--foreground-muted)' }}>No payroll data found for {periodId}.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* ── RIGHT: COPILOT ── */}
      <div style={{ width: 380, flexShrink: 0, position: 'sticky', top: 72 }}>
        <CompCopilot
          title="Comp Admin Agent"
          description="Ask about plan eligibility, adjustment history, chargebacks, and payroll from Unity Catalog."
          personaLabel="Comp Admin"
          dataContext={groundingContext}
          examplePrompts={ADMIN_PROMPTS}
          contextLoading={loading}
        />
      </div>

      {/* ─── Audit log print export ─── */}
      {showAuditExport && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '1rem',
        }}>
          <style dangerouslySetInnerHTML={{__html: `
            @media print {
              body * { visibility: hidden; }
              #audit-print-area, #audit-print-area * { visibility: visible; }
              #audit-print-area { position: absolute; left: 0; top: 0; width: 100%; }
              .no-print { display: none !important; }
            }
          `}} />
          <div id="audit-print-area" className="animate-fade-in" style={{
            width: '100%', maxWidth: '780px', background: '#ffffff',
            color: '#1a202c', border: '1px solid #e2e8f0', borderRadius: '16px',
            boxShadow: 'var(--shadow-2xl)', overflow: 'hidden',
          }}>
            <div style={{ background: '#0F172A', color: '#ffffff', padding: '2rem' }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, letterSpacing: '0.05em' }}>Comp Admin Audit Log</h2>
              <p style={{ margin: '4px 0 0', fontSize: 11, color: '#94A3B8', fontWeight: 600 }}>
                {selectedRep?.rep_name ?? selectedRepId} · {periodId} · sourced from workspace.hgv_comp.fact_comp_admin_log
              </p>
            </div>

            <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '1rem', borderRadius: 10, fontSize: 11 }}>
                <div>
                  <span style={{ color: '#64748B', fontWeight: 600 }}>PERIOD</span>
                  <div style={{ fontWeight: 800, marginTop: 2, fontSize: 12 }}>{periodId}</div>
                </div>
                <div>
                  <span style={{ color: '#64748B', fontWeight: 600 }}>EVENTS</span>
                  <div style={{ fontWeight: 800, marginTop: 2, fontSize: 12 }}>{auditData?.total ?? 0}</div>
                </div>
                <div>
                  <span style={{ color: '#64748B', fontWeight: 600 }}>EXPORTED</span>
                  <div style={{ fontWeight: 800, marginTop: 2, fontSize: 12 }}>{new Date().toLocaleString()}</div>
                </div>
              </div>

              <div>
                <h4 style={{ fontSize: 12, fontWeight: 800, color: '#0F172A', borderBottom: '2px solid #E2E8F0', paddingBottom: 4, margin: '0 0 0.5rem' }}>Audit Events</h4>
                <table style={{ width: '100%', fontSize: 10, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #CBD5E1', textAlign: 'left', fontWeight: 800, color: '#475569' }}>
                      <th style={{ padding: '0.5rem 0.25rem' }}>Event ID</th>
                      <th style={{ padding: '0.5rem 0.25rem' }}>Type</th>
                      <th style={{ padding: '0.5rem 0.25rem' }}>Amount</th>
                      <th style={{ padding: '0.5rem 0.25rem' }}>Reason</th>
                      <th style={{ padding: '0.5rem 0.25rem' }}>Approved By</th>
                      <th style={{ padding: '0.5rem 0.25rem' }}>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(auditData?.events ?? []).map((e: any, idx: number) => (
                      <tr key={e.event_id ?? idx} style={{ borderBottom: '1px solid #E2E8F0' }}>
                        <td style={{ padding: '0.5rem 0.25rem', fontFamily: 'monospace' }}>{e.event_id ?? '—'}</td>
                        <td style={{ padding: '0.5rem 0.25rem', fontWeight: 600 }}>{e.event_type}</td>
                        <td style={{ padding: '0.5rem 0.25rem', fontWeight: 700, color: Number(e.amount ?? 0) >= 0 ? '#10B981' : '#EF4444' }}>
                          {e.amount != null ? `${Number(e.amount) >= 0 ? '+' : ''}${fmtUSD(e.amount)}` : '—'}
                        </td>
                        <td style={{ padding: '0.5rem 0.25rem', color: '#475569' }}>{e.reason}</td>
                        <td style={{ padding: '0.5rem 0.25rem' }}>{e.approved_by ?? '—'}</td>
                        <td style={{ padding: '0.5rem 0.25rem' }}>{dateStr(e.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="no-print" style={{ display: 'flex', justifyContent: 'end', gap: '0.5rem', marginTop: '1rem', borderTop: '1px solid #E2E8F0', paddingTop: '1rem' }}>
                <button
                  type="button" onClick={() => setShowAuditExport(false)}
                  style={{
                    padding: '0.5rem 1rem', background: '#F1F5F9', border: '1px solid #CBD5E1',
                    borderRadius: '6px', fontSize: 12, fontWeight: 700, color: '#475569', cursor: 'pointer'
                  }}
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  style={{
                    padding: '0.5rem 1.25rem', background: '#0F172A', border: 'none',
                    borderRadius: '6px', fontSize: 12, fontWeight: 800, color: '#fff', cursor: 'pointer',
                  }}
                >
                  Print Audit Log
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
