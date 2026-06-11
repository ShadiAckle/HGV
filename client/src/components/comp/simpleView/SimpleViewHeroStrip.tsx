import type { ReactNode } from 'react';
import { Sparkles } from 'lucide-react';
import type { TrafficStatus } from '@shared/simpleViewStatus';
import { TRAFFIC_COLORS, TRAFFIC_LABELS } from '@shared/simpleViewStatus';

export interface SimpleViewHeroMetric {
  label: string;
  value: string;
  hint?: string;
}

interface SimpleViewHeroStripProps {
  metrics: [SimpleViewHeroMetric, SimpleViewHeroMetric, SimpleViewHeroMetric];
  overallStatus: TrafficStatus;
  /** @deprecated Use aiNextStep instead for simple view */
  nextStep?: string;
  /** AI-generated what's-next block (replaces static nextStep when provided) */
  aiNextStep?: ReactNode;
}

export function SimpleViewHeroStrip({ metrics, overallStatus, nextStep, aiNextStep }: SimpleViewHeroStripProps) {
  const statusColors = TRAFFIC_COLORS[overallStatus];

  return (
    <div className="simple-view-hero glass-card overflow-hidden border border-primary/20">
      <div
        className="flex flex-wrap items-center justify-between gap-3 border-b border-border/10 px-5 py-3"
        style={{ background: 'linear-gradient(90deg, rgba(26,109,255,0.08), transparent)' }}
      >
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-primary" aria-hidden />
          <span className="text-xs font-bold text-foreground">Your 3 numbers that matter</span>
        </div>
        <span
          className="rounded-full px-3 py-1 text-[10px] font-bold"
          style={{ background: statusColors.bg, color: statusColors.text }}
        >
          {TRAFFIC_LABELS[overallStatus]}
        </span>
      </div>
      <div className="grid gap-0 sm:grid-cols-3">
        {metrics.map((m, i) => (
          <div
            key={m.label}
            className={`px-5 py-4 ${i > 0 ? 'border-t border-border/10 sm:border-t-0 sm:border-l sm:border-border/10' : ''}`}
          >
            <div className="text-[11px] font-semibold text-muted-foreground">{m.label}</div>
            <div className="mt-1 text-2xl font-extrabold tracking-tight text-foreground">{m.value}</div>
            {m.hint && <div className="mt-1 text-[11px] text-muted-foreground">{m.hint}</div>}
          </div>
        ))}
      </div>
      {aiNextStep}
      {!aiNextStep && nextStep && (
        <div className="border-t border-border/10 bg-primary/5 px-5 py-3 text-[12px] leading-relaxed text-foreground/90">
          <span className="font-bold text-primary">What&apos;s next: </span>
          {nextStep}
        </div>
      )}
    </div>
  );
}
