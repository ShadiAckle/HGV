import { useCallback, useEffect, useMemo, useState } from 'react';
import { Scale, TrendingDown, TrendingUp, Info, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { AiGeneratedFooter, type AiGenerationMeta } from '@/components/comp/AiGeneratedFooter';
import { LuxeDbLoader } from '@/components/comp/LuxeDbLoader';
import { deriveLoadingSteps } from '@/lib/loadingSteps';
import { LOADING } from '@/lib/loadingStepLabels';
import type { CompImpactLine, CompImpactStatus } from '@shared/compStatementImpact';
import { usePlainLanguage } from '@/hooks/usePlainLanguage';

interface CompStatementImpactPanelProps {
  repId: string;
  periodId: string;
  roleTitle: string;
  roleKey: string;
  insightsContext: string;
  enabled?: boolean;
}

function statusIcon(status: CompImpactStatus) {
  if (status === 'aligned') return <CheckCircle2 size={13} color="var(--success)" />;
  if (status === 'at_risk') return <AlertTriangle size={13} color="var(--danger)" />;
  if (status === 'gap') return <TrendingDown size={13} color="var(--warning)" />;
  return <Info size={13} color="var(--primary)" />;
}

function statusBorder(status: CompImpactStatus): string {
  if (status === 'aligned') return 'rgba(16,185,129,0.35)';
  if (status === 'at_risk') return 'rgba(239,68,68,0.35)';
  if (status === 'gap') return 'rgba(245,158,11,0.35)';
  return 'rgba(26,109,255,0.25)';
}

function ImpactRow({ line, index, plain }: { line: CompImpactLine; index: number; plain: boolean }) {
  const staggerClass = ['animate-stagger-1', 'animate-stagger-2', 'animate-stagger-3', 'animate-stagger-4'][index] ?? 'animate-fade-in-up';
  return (
    <div
      className={`comp-impact-row rounded-xl border p-3.5 ${staggerClass}`}
      style={{
        borderColor: statusBorder(line.status),
        background: 'rgba(255,255,255,0.02)',
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          {statusIcon(line.status)}
          <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
            {plain ? `Topic ${line.areaId}` : `Area ${line.areaId}`}
          </span>
          <span
            className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide"
            style={{
              background: 'rgba(212,175,55,0.12)',
              color: 'var(--gold)',
              border: '1px solid rgba(212,175,55,0.25)',
            }}
          >
            {line.badge}
          </span>
        </div>
      </div>
      <div className="mt-2 text-xs font-bold text-foreground">{line.areaHeadline}</div>
      <div
        className="mt-1.5 text-sm font-extrabold"
        style={{
          color:
            line.status === 'at_risk'
              ? 'var(--danger)'
              : line.status === 'aligned'
                ? 'var(--success)'
                : 'var(--foreground)',
        }}
      >
        {line.statementImpact}
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{line.detail}</p>
      {line.marketAlignedPreview && (
        <p
          className="mt-2 rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-2 text-[10.5px] leading-relaxed text-foreground/85"
        >
          <span className="font-bold text-primary">{plain ? 'What good looks like: ' : 'Market-aligned preview: '}</span>
          {line.marketAlignedPreview}
        </p>
      )}
    </div>
  );
}

export function CompStatementImpactPanel({
  repId,
  periodId,
  roleTitle,
  roleKey,
  insightsContext,
  enabled = true,
}: CompStatementImpactPanelProps) {
  const { enabled: plainEnglish, apiFlag } = usePlainLanguage();
  const [lines, setLines] = useState<CompImpactLine[]>([]);
  const [source, setSource] = useState<'llm' | null>(null);
  const [meta, setMeta] = useState<AiGenerationMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchImpact = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSource(null);
    setMeta(null);
    try {
      const res = await fetch('/api/comp/rep/benchmark-impact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rep_id: repId,
          period_id: periodId,
          role_title: roleTitle,
          role_key: roleKey,
          insights_context: insightsContext,
          refresh_key: crypto.randomUUID(),
          plain_english: apiFlag,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        areas?: CompImpactLine[];
        source?: string;
        error?: string;
        meta?: AiGenerationMeta;
      };
      if (!res.ok) {
        throw new Error(body.error ?? 'Unable to generate benchmark impact right now.');
      }
      if (body.source !== 'llm' || !body.areas?.length) {
        throw new Error('Unable to generate benchmark impact right now.');
      }
      setLines(body.areas);
      setSource('llm');
      setMeta(body.meta ?? null);
    } catch {
      setError('Unable to generate benchmark impact right now. Please try again.');
      setLines([]);
    } finally {
      setLoading(false);
    }
  }, [repId, periodId, roleTitle, roleKey, insightsContext, apiFlag]);

  useEffect(() => {
    if (!enabled || !insightsContext) return;
    setLines([]);
    void fetchImpact();
  }, [enabled, insightsContext, fetchImpact]);

  const loaderSteps = useMemo(
    () =>
      deriveLoadingSteps([
        {
          id: 'context',
          label: LOADING.benchmarkImpactContext,
          loading: false,
          done: !!insightsContext,
        },
        {
          id: 'llm',
          label: LOADING.benchmarkImpactLlm,
          loading,
          done: source === 'llm',
          error: !!error,
        },
      ]),
    [insightsContext, loading, source, error],
  );

  const atRiskCount = lines.filter((l) => l.status === 'at_risk' || l.status === 'gap').length;

  if (!enabled) return null;

  return (
    <div className="glass-card overflow-hidden hgv-card-hover" style={{ padding: '1.5rem' }}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Scale size={14} color="var(--gold)" />
            <span className="text-[9px] font-bold uppercase tracking-wider text-amber-500">
              {plainEnglish ? 'How the Market Affects Your Pay' : 'Industry Benchmark Impact'}
            </span>
          </div>
          <h3 className="mt-1 text-sm font-bold text-foreground">
            {plainEnglish
              ? 'What Industry Standards Mean for Your Paycheck'
              : 'How Market Standards Affect Your Comp Statement'}
          </h3>
          <p className="mt-1 max-w-xl text-[11px] leading-relaxed text-muted-foreground">
            {plainEnglish
              ? 'Simple look at your pay vs what similar roles earn in the market.'
              : 'Personalized to your live earnings, pay mix, and role-specific market benchmarks.'}
          </p>
        </div>
        {source === 'llm' && atRiskCount > 0 && (
          <div
            className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold"
            style={{ background: 'var(--danger-muted)', color: 'var(--danger)', border: '1px solid var(--danger-border)' }}
          >
            <TrendingUp size={11} />
            {atRiskCount} area{atRiskCount !== 1 ? 's' : ''} affecting your statement
          </div>
        )}
      </div>

      {loading && <LuxeDbLoader loading variant="inline" steps={loaderSteps} title="Benchmark impact" />}
      {error && !loading && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
          <button type="button" onClick={() => void fetchImpact()} className="ml-2 text-xs underline">
            Retry
          </button>
        </div>
      )}

      {source === 'llm' && !loading && (
        <div className="flex flex-col gap-3">
          {lines.map((line, index) => (
            <ImpactRow key={line.areaId} line={line} index={index} plain={plainEnglish} />
          ))}
          <AiGeneratedFooter meta={meta} onRegenerate={() => void fetchImpact()} regenerating={loading} />
        </div>
      )}
    </div>
  );
}
