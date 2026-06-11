import { useCallback, useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { renderMarkdown } from '@/components/comp/CompCopilot';
import { usePlainLanguage } from '@/hooks/usePlainLanguage';

export type SimpleViewAiFocus = 'next_step' | 'qtd_earnings';

const LABELS: Record<SimpleViewAiFocus, string> = {
  next_step: 'AI Insights',
  qtd_earnings: 'AI Insights — Money earned this quarter',
};

interface SimpleViewAiInsightProps {
  repId: string;
  periodId: string;
  roleTitle: string;
  insightsContext: string;
  focus: SimpleViewAiFocus;
  enabled?: boolean;
  /** Inline chip under hero vs standalone card */
  variant?: 'inline' | 'card';
}

export function SimpleViewAiInsight({
  repId,
  periodId,
  roleTitle,
  insightsContext,
  focus,
  enabled = true,
  variant = 'card',
}: SimpleViewAiInsightProps) {
  const { apiFlag } = usePlainLanguage();
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const fetchInsight = useCallback(async () => {
    if (!insightsContext) return;
    setLoading(true);
    setError(false);
    try {
      const res = await fetch('/api/comp/rep/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rep_id: repId,
          period_id: periodId,
          role_title: roleTitle,
          insights_context: insightsContext,
          channel: 'marketing',
          focus,
          refresh_key: crypto.randomUUID(),
          plain_english: apiFlag,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { insight?: string; source?: string };
      if (!res.ok || body.source !== 'llm' || !body.insight) {
        throw new Error('failed');
      }
      setText(body.insight.trim());
    } catch {
      setError(true);
      setText(null);
    } finally {
      setLoading(false);
    }
  }, [repId, periodId, roleTitle, insightsContext, focus, apiFlag]);

  useEffect(() => {
    if (!enabled || !insightsContext) return;
    setText(null);
    void fetchInsight();
  }, [enabled, insightsContext, fetchInsight]);

  if (!enabled) return null;

  if (variant === 'inline') {
    return (
      <div className="border-t border-border/10 bg-primary/5 px-5 py-3 text-[12px] leading-relaxed text-foreground/90">
        <div className="mb-1 flex items-center gap-1.5">
          <Sparkles size={12} className="text-primary" aria-hidden />
          <span className="font-bold text-primary">AI Insights — What&apos;s next</span>
        </div>
        {loading && <p className="text-muted-foreground animate-pulse">Generating your next step…</p>}
        {error && !loading && (
          <p className="text-muted-foreground">
            AI insight unavailable.{' '}
            <button type="button" className="underline" onClick={() => void fetchInsight()}>Retry</button>
          </p>
        )}
        {text && !loading && <div className="simple-view-ai-inline">{renderMarkdown(text)}</div>}
      </div>
    );
  }

  return (
    <div className="glass-card border border-primary/15 p-4">
      <div className="mb-2 flex items-center gap-2">
        <Sparkles size={14} className="text-primary" aria-hidden />
        <span className="text-xs font-bold text-foreground">{LABELS[focus]}</span>
      </div>
      {loading && <p className="text-[11px] text-muted-foreground animate-pulse">Analyzing your compensation data…</p>}
      {error && !loading && (
        <p className="text-[11px] text-muted-foreground">
          Unable to load AI insight.{' '}
          <button type="button" className="underline" onClick={() => void fetchInsight()}>Retry</button>
        </p>
      )}
      {text && !loading && (
        <div className="text-[12px] leading-relaxed text-foreground/90">{renderMarkdown(text)}</div>
      )}
    </div>
  );
}
