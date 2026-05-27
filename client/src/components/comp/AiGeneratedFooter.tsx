import { RefreshCw } from 'lucide-react';

interface AiGenerationMeta {
  generated_at: string;
  serving_endpoint?: string;
  generation_pass?: string;
}

interface AiGeneratedFooterProps {
  meta: AiGenerationMeta | null;
  onRegenerate?: () => void;
  regenerating?: boolean;
}

export function AiGeneratedFooter({ meta, onRegenerate, regenerating }: AiGeneratedFooterProps) {
  if (!meta?.generated_at) return null;

  const timeLabel = new Date(meta.generated_at).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border/10 pt-3">
      <div className="flex flex-col gap-0.5">
        <p className="text-[10px] font-medium text-muted-foreground">Generated {timeLabel}</p>
        {meta.serving_endpoint && (
          <p className={`text-[10px] font-medium ${/llama|meta-llama/i.test(meta.serving_endpoint) ? 'text-amber-600' : 'text-muted-foreground'}`}>
            Model: {meta.serving_endpoint.replace(/^databricks-/, '')}
            {/llama|meta-llama/i.test(meta.serving_endpoint) ? ' (fallback — not Sonnet)' : ''}
          </p>
        )}
      </div>
      {onRegenerate && (
        <button type="button" onClick={onRegenerate} disabled={regenerating} className="btn-text">
          <RefreshCw size={11} className={regenerating ? 'animate-spin' : ''} aria-hidden />
          {regenerating ? 'Regenerating…' : 'Regenerate'}
        </button>
      )}
    </div>
  );
}

export type { AiGenerationMeta };
