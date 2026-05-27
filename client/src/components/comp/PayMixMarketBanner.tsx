import { AlertTriangle, CheckCircle2, Scale } from 'lucide-react';
import { assessPayMix } from '@shared/compStandards';

interface PayMixMarketBannerProps {
  roleKey: string;
  basePct: number;
  variablePct: number;
  tccGapPct?: number;
}

function statusLabel(assessment: ReturnType<typeof assessPayMix>): string {
  if (assessment.inverted) return 'Inverted vs market';
  if (assessment.aligned) return 'Aligned with market';
  return 'Drift vs market';
}

function statusTone(assessment: ReturnType<typeof assessPayMix>): 'aligned' | 'inverted' | 'drift' {
  if (assessment.inverted) return 'inverted';
  if (assessment.aligned) return 'aligned';
  return 'drift';
}

const TONE_STYLES = {
  aligned: {
    border: 'var(--success-border)',
    bg: 'linear-gradient(135deg, rgba(34,197,94,0.08) 0%, rgba(34,197,94,0.02) 100%)',
    icon: CheckCircle2,
    iconColor: 'var(--success)',
    badge: 'badge-green',
  },
  inverted: {
    border: 'var(--danger-border)',
    bg: 'linear-gradient(135deg, rgba(239,68,68,0.10) 0%, rgba(239,68,68,0.02) 100%)',
    icon: AlertTriangle,
    iconColor: 'var(--danger)',
    badge: 'badge-red',
  },
  drift: {
    border: 'var(--warning-border)',
    bg: 'linear-gradient(135deg, rgba(245,158,11,0.10) 0%, rgba(245,158,11,0.02) 100%)',
    icon: Scale,
    iconColor: 'var(--warning)',
    badge: 'badge-amber',
  },
} as const;

function PayMixBar({ basePct, marketBasePct }: { basePct: number; marketBasePct: number }) {
  return (
    <div className="mt-3 space-y-2">
      <div>
        <div className="mb-1 flex justify-between text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
          <span>Your pay mix</span>
          <span>{basePct}% base / {100 - basePct}% variable</span>
        </div>
        <div className="progress-bar flex h-2 overflow-hidden">
          <div className="progress-fill h-full bg-[var(--primary)]" style={{ width: `${basePct}%` }} />
          <div className="h-full flex-1 bg-[var(--gold)] opacity-80" />
        </div>
      </div>
      <div>
        <div className="mb-1 flex justify-between text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
          <span>Market standard</span>
          <span>{marketBasePct}% base / {100 - marketBasePct}% variable</span>
        </div>
        <div className="progress-bar flex h-2 overflow-hidden opacity-70">
          <div className="progress-fill h-full bg-muted-foreground/40" style={{ width: `${marketBasePct}%` }} />
          <div className="h-full flex-1 bg-muted-foreground/20" />
        </div>
      </div>
    </div>
  );
}

export function PayMixMarketBanner({ roleKey, basePct, variablePct, tccGapPct }: PayMixMarketBannerProps) {
  const assessment = assessPayMix(roleKey, basePct);
  const tone = statusTone(assessment);
  const styles = TONE_STYLES[tone];
  const StatusIcon = styles.icon;

  return (
    <div className="glass-card hgv-card-hover overflow-hidden !p-0" style={{ borderColor: styles.border }}>
      <div className="p-5" style={{ background: styles.bg }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="label-overline">Pay Mix vs Market</span>
            <p className="mt-2 text-lg font-extrabold tracking-tight text-foreground">
              {basePct}/{variablePct}
              <span className="mx-2 font-normal text-muted-foreground/50">vs</span>
              {assessment.marketBasePct}/{assessment.marketVariablePct}
            </p>
          </div>
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
            style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${styles.border}` }}
          >
            <StatusIcon size={16} color={styles.iconColor} />
          </div>
        </div>

        <PayMixBar basePct={basePct} marketBasePct={assessment.marketBasePct} />

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className={`badge ${styles.badge}`}>{statusLabel(assessment)}</span>
          {tccGapPct != null && (
            <span className={`badge ${tccGapPct <= -10 ? 'badge-red' : 'badge-neutral'}`}>
              TCC {tccGapPct > 0 ? '+' : ''}{tccGapPct}% vs market
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
