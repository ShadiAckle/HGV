import { TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';
import { usePlainLanguage } from '@/hooks/usePlainLanguage';

interface KpiCardProps {
  label: string;
  value: string;
  subtext?: string;
  delta?: string;
  trend?: 'positive' | 'negative' | 'neutral';
  icon?: ReactNode;
  className?: string;
}

export function KpiCard({ label, value, subtext, delta, trend = 'neutral', icon, className }: KpiCardProps) {
  const { label: plainLabel, enabled } = usePlainLanguage();
  const displayLabel = plainLabel(label);
  const displaySubtext = subtext ? plainLabel(subtext) : undefined;
  const TrendIcon =
    trend === 'positive' ? TrendingUp :
    trend === 'negative' ? TrendingDown :
    Minus;

  return (
    <div className={cn('glass-card p-6 hgv-card-hover group', className)}>
      <div className="flex items-center justify-between">
        <span className={cn(
          'flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground',
          enabled && 'plain-kpi-label',
        )}>
          {icon && <span className="text-primary">{icon}</span>}
          {displayLabel}
        </span>
        {delta && (
          <span className={cn(
            'flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold',
            trend === 'positive' && 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20',
            trend === 'negative' && 'bg-amber-500/10 text-amber-500 border border-amber-500/20',
            trend === 'neutral' && 'bg-muted text-muted-foreground border border-border/10',
          )}>
            <TrendIcon className="h-2.5 w-2.5" aria-hidden />
            {delta}
          </span>
        )}
      </div>

      <p className="mt-3 text-2xl font-extrabold tracking-tight text-foreground group-hover:text-primary transition-colors duration-300">
        {value}
      </p>

      {displaySubtext && (
        <p className={cn(
          'mt-1.5 flex items-center gap-1 text-[11px] font-medium',
          trend === 'positive' && 'text-emerald-500',
          trend === 'negative' && 'text-amber-500',
          trend === 'neutral' && 'text-muted-foreground',
        )}>
          <TrendIcon className="h-3 w-3 shrink-0" aria-hidden />
          {displaySubtext}
        </p>
      )}
    </div>
  );
}

