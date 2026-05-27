import { useCallback, useEffect, useMemo, useState } from 'react';
import { renderMarkdown } from '@/components/comp/CompCopilot';
import { AiGeneratedFooter, type AiGenerationMeta } from '@/components/comp/AiGeneratedFooter';
import { LuxeDbLoader } from '@/components/comp/LuxeDbLoader';
import { deriveLoadingSteps } from '@/lib/loadingSteps';

export type RepInsightChannel = 'sales' | 'marketing';

const PANEL_COPY: Record<
  RepInsightChannel,
  { title: string; subtitle: string; contextLabel: string; llmLabel: string }
> = {
  sales: {
    title: 'AI Insights — Maximize Your Commissions',
    subtitle: 'Personalized brief from your quota, earnings, deals, and market benchmarks.',
    contextLabel: 'Packaging quota, earnings, and deal context',
    llmLabel: 'Drafting personalized earnings guidance',
  },
  marketing: {
    title: 'AI Insights — Tour Earnings & Tier Progress',
    subtitle: 'Personalized brief from tour activity, SPIFF status, and tier progress.',
    contextLabel: 'Summarizing tours, tiers, and upcoming arrivals',
    llmLabel: 'Drafting personalized earnings guidance',
  },
};

interface RepAiInsightsPanelProps {
  repId: string;
  periodId: string;
  roleTitle: string;
  channel?: RepInsightChannel;
  /** Required for marketing virtual personas; optional for sales reps (server loads from SQL). */
  insightsContext?: string;
  enabled?: boolean;
}

export function RepAiInsightsPanel({
  repId,
  periodId,
  roleTitle,
  channel = 'sales',
  insightsContext,
  enabled = true,
}: RepAiInsightsPanelProps) {
  const copy = PANEL_COPY[channel];
  const [aiInsights, setAiInsights] = useState<string | null>(null);
  const [aiInsightSource, setAiInsightSource] = useState<'llm' | null>(null);
  const [meta, setMeta] = useState<AiGenerationMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInsights = useCallback(async () => {
    setLoading(true);
    setError(null);
    setAiInsightSource(null);
    setMeta(null);
    try {
      const res = await fetch('/api/comp/rep/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rep_id: repId,
          period_id: periodId,
          role_title: roleTitle,
          insights_context: insightsContext,
          channel,
          refresh_key: crypto.randomUUID(),
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        insight?: string;
        source?: string;
        error?: string;
        meta?: AiGenerationMeta;
      };
      if (!res.ok) {
        throw new Error(body.error ?? 'Unable to generate insights right now.');
      }
      if (body.source !== 'llm' || !body.insight) {
        throw new Error('Unable to generate insights right now.');
      }
      setAiInsights(body.insight);
      setAiInsightSource('llm');
      setMeta(body.meta ?? null);
    } catch {
      setError('Unable to generate insights right now. Please try again.');
      setAiInsights(null);
    } finally {
      setLoading(false);
    }
  }, [repId, periodId, roleTitle, insightsContext, channel]);

  useEffect(() => {
    if (!enabled) return;
    if (channel === 'marketing' && !insightsContext) return;
    setAiInsights(null);
    void fetchInsights();
  }, [enabled, channel, insightsContext, fetchInsights]);

  const steps = useMemo(
    () =>
      deriveLoadingSteps([
        {
          id: 'context',
          label: copy.contextLabel,
          loading: false,
          done: channel === 'sales' || !!insightsContext,
        },
        {
          id: 'llm',
          label: copy.llmLabel,
          loading,
          done: aiInsightSource === 'llm',
          error: !!error,
        },
      ]),
    [copy, channel, insightsContext, loading, aiInsightSource, error],
  );

  if (!enabled) return null;

  return (
    <div className="glass-card border border-gold/20 hgv-card-hover" style={{ padding: '1.75rem' }}>
      <h3
        style={{
          fontSize: 13,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          color: 'var(--gold-light)',
          marginBottom: 4,
        }}
      >
        {copy.title}
      </h3>
      <p style={{ fontSize: 11, color: 'var(--foreground-muted)', margin: '0 0 1rem' }}>{copy.subtitle}</p>
      {loading && <LuxeDbLoader loading variant="inline" steps={steps} title="AI Insights" />}
      {error && !loading && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>
      )}
      {aiInsights && !loading && aiInsightSource === 'llm' && (
        <div
          className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/8 to-transparent p-4 text-sm leading-relaxed text-foreground/90"
        >
          {renderMarkdown(aiInsights)}
          <AiGeneratedFooter meta={meta} onRegenerate={() => void fetchInsights()} regenerating={loading} />
        </div>
      )}
    </div>
  );
}
