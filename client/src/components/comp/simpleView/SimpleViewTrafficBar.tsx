import type { TrafficStatus } from '@shared/simpleViewStatus';
import { TRAFFIC_COLORS, TRAFFIC_LABELS } from '@shared/simpleViewStatus';

interface SimpleViewTrafficBarProps {
  label: string;
  pct: number;
  status: TrafficStatus;
  caption?: string;
  valueLabel?: string;
}

export function SimpleViewTrafficBar({ label, pct, status, caption, valueLabel }: SimpleViewTrafficBarProps) {
  const colors = TRAFFIC_COLORS[status];
  const clamped = Math.min(100, Math.max(0, pct));

  return (
    <div
      className="simple-view-traffic-bar rounded-xl border p-4"
      style={{ borderColor: `${colors.bar}44`, background: 'rgba(255,255,255,0.02)' }}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-foreground">{label}</span>
        <span
          className="rounded-full px-2.5 py-0.5 text-[10px] font-bold"
          style={{ background: colors.bg, color: colors.text }}
        >
          {TRAFFIC_LABELS[status]}
        </span>
      </div>
      <div
        className="h-3 w-full overflow-hidden rounded-full"
        style={{ background: 'var(--bg-elevated)' }}
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${clamped}%`, background: colors.bar }}
        />
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span>{caption}</span>
        {valueLabel && <span className="font-bold text-foreground">{valueLabel}</span>}
      </div>
    </div>
  );
}
