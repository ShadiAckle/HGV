import { CheckCircle2, Circle, Loader2, XCircle } from 'lucide-react';
import type { LoadingStep } from '@/lib/loadingSteps';

interface LuxeDbLoaderProps {
  loading: boolean;
  /** Real progress steps — no fake rotation when provided. */
  steps?: LoadingStep[];
  title?: string;
  variant?: 'overlay' | 'inline';
}

function stepTextClass(status: LoadingStep['status']): string {
  if (status === 'done') return 'text-muted-foreground';
  if (status === 'error') return 'text-destructive';
  if (status === 'active') return 'font-semibold text-foreground';
  return 'text-foreground-faint font-medium';
}

function StepIcon({ status }: { status: LoadingStep['status'] }) {
  if (status === 'done') return <CheckCircle2 size={14} className="text-[var(--success)]" aria-hidden />;
  if (status === 'active') return <Loader2 size={14} className="animate-spin text-primary" aria-hidden />;
  if (status === 'error') return <XCircle size={14} className="text-destructive" aria-hidden />;
  return <Circle size={14} className="text-foreground-faint" aria-hidden />;
}

function LoadingStepList({ steps, title }: { steps: LoadingStep[]; title?: string }) {
  const active = steps.filter((s) => s.status === 'active');
  const doneCount = steps.filter((s) => s.status === 'done').length;

  return (
    <div className="flex w-full flex-col gap-3.5">
      <div className="flex flex-col gap-1">
        <span className="label-overline text-[var(--gold-light)]">{title ?? 'Loading'}</span>
        {active.length > 0 && (
          <p className="m-0 text-xs font-semibold leading-snug text-foreground">
            {active.map((s) => s.label).join(' · ')}
          </p>
        )}
        <p className="m-0 text-[10px] text-muted-foreground">
          {doneCount} of {steps.length} complete
        </p>
      </div>

      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {steps.map((step) => (
          <li key={step.id} className={`flex items-center gap-2 text-[11px] ${stepTextClass(step.status)}`}>
            <StepIcon status={step.status} />
            <span>{step.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function LuxeDbLoader({ loading, steps, title, variant = 'overlay' }: LuxeDbLoaderProps) {
  if (!loading) return null;

  const body = steps?.length ? (
    <LoadingStepList steps={steps} title={title} />
  ) : (
    <div className="flex flex-col items-center gap-3">
      <Loader2 size={28} className="animate-spin text-primary" aria-hidden />
      <p className="m-0 text-sm font-semibold text-foreground">{title ?? 'Loading…'}</p>
    </div>
  );

  if (variant === 'inline') {
    return (
      <div className="animate-fade-in min-h-[120px] rounded-xl border border-primary/20 bg-card/40 p-4">
        {body}
      </div>
    );
  }

  return (
    <div className="animate-fade-in absolute inset-0 z-50 flex min-h-[260px] flex-col items-center justify-center rounded-[var(--radius-lg)] border border-border bg-[rgba(8,13,26,0.45)] p-8 text-center backdrop-blur-md">
      <div className="w-full max-w-[380px] rounded-[var(--radius-xl)] border border-primary/25 bg-[rgba(13,20,36,0.85)] p-7 shadow-[var(--shadow-lg),0_0_30px_rgba(26,109,255,0.15)]">
        {body}
      </div>
    </div>
  );
}
