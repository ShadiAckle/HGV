import { useCallback, useEffect, useMemo, useState } from 'react';
import { renderMarkdown } from '@/components/comp/CompCopilot';
import { AiGeneratedFooter, type AiGenerationMeta } from '@/components/comp/AiGeneratedFooter';
import { LuxeDbLoader } from '@/components/comp/LuxeDbLoader';
import { deriveLoadingSteps } from '@/lib/loadingSteps';

export type ManagerInsightFocus = 'payout' | 'coaching';

const PANEL_COPY: Record<
  ManagerInsightFocus,
  { title: string; subtitle: string; contextLabel: string; llmLabel: string }
> = {
  payout: {
    title: 'AI Insights — Maximize Your Payout',
    subtitle: 'Personalized brief from your plan metrics and payout curve.',
    contextLabel: 'Packaging plan weights and payout curve context',
    llmLabel: 'Summarizing your payout opportunities',
  },
  coaching: {
    title: 'AI Insights — Team Coaching Priorities',
    subtitle: 'Executive coaching brief from direct-report production. Detailed rep/tour signals appear in Supporting Signals below.',
    contextLabel: 'Reviewing direct-report production signals',
    llmLabel: 'Prioritizing team coaching actions',
  },
};

interface ManagerAiInsightsPanelProps {
  managerRepId: string;
  periodId: string;
  roleTitle: string;
  focus: ManagerInsightFocus;
  personaId?: string;
  /** When provided, skips re-fetching workspace context on the server. */
  insightsContext?: string;
  enabled?: boolean;
}

export function ManagerAiInsightsPanel({
  managerRepId,
  periodId,
  roleTitle,
  focus,
  personaId,
  insightsContext,
  enabled = true,
}: ManagerAiInsightsPanelProps) {
  const copy = PANEL_COPY[focus];
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
      const res = await fetch('/api/comp/manager/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manager_rep_id: managerRepId,
          period_id: periodId,
          role_title: roleTitle,
          insights_context: insightsContext,
          persona_id: personaId,
          focus,
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
  }, [managerRepId, periodId, roleTitle, personaId, insightsContext, focus]);

  useEffect(() => {
    if (!enabled) return;
    setAiInsights(null);
    void fetchInsights();
  }, [enabled, fetchInsights]);

  const steps = useMemo(
    () =>
      deriveLoadingSteps([
        {
          id: 'context',
          label: copy.contextLabel,
          loading: false,
          done: enabled,
        },
        {
          id: 'llm',
          label: copy.llmLabel,
          loading,
          done: aiInsightSource === 'llm',
          error: !!error,
        },
      ]),
    [copy, enabled, loading, aiInsightSource, error],
  );

  if (!enabled) return null;

  return (
    <div className="glass-card border border-gold/20 hgv-card-hover animate-fade-in-up">
      <h3 className="mb-1 text-sm font-bold uppercase tracking-wider text-gold">{copy.title}</h3>
      <p className="mb-4 text-[11px] text-muted-foreground">{copy.subtitle}</p>
      {loading && <LuxeDbLoader loading variant="inline" steps={steps} title="AI Insights" />}
      {error && !loading && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>
      )}
      {aiInsights && !loading && aiInsightSource === 'llm' && (
        <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/8 to-transparent p-4 text-sm leading-relaxed text-foreground/90">
          {renderMarkdown(aiInsights)}
          <AiGeneratedFooter meta={meta} onRegenerate={() => void fetchInsights()} regenerating={loading} />
        </div>
      )}
    </div>
  );
}
