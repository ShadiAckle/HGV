import { useCallback, useEffect, useMemo, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { renderMarkdown } from '@/components/comp/CompCopilot';
import { AiGeneratedFooter, type AiGenerationMeta } from '@/components/comp/AiGeneratedFooter';
import { LuxeDbLoader } from '@/components/comp/LuxeDbLoader';
import { deriveLoadingSteps } from '@/lib/loadingSteps';
import { LOADING } from '@/lib/loadingStepLabels';
import { usePlainLanguage } from '@/hooks/usePlainLanguage';

interface CompInterpretationPanelProps {
  endpoint: string;
  insightsContext: string;
  roleTitle?: string;
  title: string;
  subtitle?: string;
  contextLabel?: string;
  llmLabel?: string;
  enabled?: boolean;
  compact?: boolean;
  className?: string;
}

export function CompInterpretationPanel({
  endpoint,
  insightsContext,
  roleTitle = 'Compensation Analyst',
  title,
  subtitle,
  contextLabel = LOADING.aiContext,
  llmLabel = 'Drafting interpretation',
  enabled = true,
  compact = false,
  className = '',
}: CompInterpretationPanelProps) {
  const { label, apiFlag } = usePlainLanguage();
  const displayTitle = label(title);
  const displaySubtitle = subtitle ? label(subtitle) : undefined;
  const [insight, setInsight] = useState<string | null>(null);
  const [source, setSource] = useState<'llm' | null>(null);
  const [meta, setMeta] = useState<AiGenerationMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInsight = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSource(null);
    setMeta(null);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          insights_context: insightsContext,
          role_title: roleTitle,
          refresh_key: crypto.randomUUID(),
          plain_english: apiFlag,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        insight?: string;
        source?: string;
        error?: string;
        meta?: AiGenerationMeta;
      };
      if (!res.ok) throw new Error(body.error ?? 'Unable to generate interpretation right now.');
      if (body.source !== 'llm' || !body.insight) {
        throw new Error('Unable to generate interpretation right now.');
      }
      setInsight(body.insight);
      setSource('llm');
      setMeta(body.meta ?? null);
    } catch {
      setError('Unable to generate interpretation right now. Please try again.');
      setInsight(null);
    } finally {
      setLoading(false);
    }
  }, [endpoint, insightsContext, roleTitle, apiFlag]);

  useEffect(() => {
    if (!enabled || !insightsContext.trim()) return;
    setInsight(null);
    void fetchInsight();
  }, [enabled, insightsContext, fetchInsight]);

  const steps = useMemo(
    () =>
      deriveLoadingSteps([
        { id: 'context', label: contextLabel, loading: false, done: !!insightsContext.trim() },
        { id: 'llm', label: llmLabel, loading, done: source === 'llm', error: !!error },
      ]),
    [contextLabel, llmLabel, insightsContext, loading, source, error],
  );

  if (!enabled) return null;

  const padding = compact ? 'p-4' : 'p-5';

  return (
    <div className={`glass-card border border-primary/15 hgv-card-hover animate-fade-in-up ${padding} ${className}`}>
      <div className="mb-3 flex items-start gap-2">
        <Sparkles size={14} className="mt-0.5 shrink-0 text-primary" aria-hidden />
        <div>
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-primary">{displayTitle}</h4>
          {displaySubtitle && <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">{displaySubtitle}</p>}
        </div>
      </div>

      {loading && <LuxeDbLoader loading variant="inline" steps={steps} title={displayTitle} />}
      {error && !loading && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          {error}
          <button type="button" onClick={() => void fetchInsight()} className="btn-text ml-2">
            Retry
          </button>
        </div>
      )}
      {insight && !loading && source === 'llm' && (
        <div className="rounded-xl border border-primary/15 bg-gradient-to-br from-primary/6 to-transparent p-3.5 text-xs leading-relaxed text-foreground/90">
          {renderMarkdown(insight)}
          <AiGeneratedFooter meta={meta} onRegenerate={() => void fetchInsight()} regenerating={loading} />
        </div>
      )}
    </div>
  );
}
