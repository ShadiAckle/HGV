import type { CSSProperties } from 'react';
import { PlanAssessmentCell } from '@/components/comp/PlanAssessmentCell';
import type { PlanAssessmentRow } from '@/data/marketingPlanAssessment';

export interface PlanAssessmentPanelData {
  planId: string;
  roleTitle: string;
  channelCode: string;
  rows: PlanAssessmentRow[];
}

interface MarketingPlanAssessmentPanelProps {
  assessment: PlanAssessmentPanelData | null;
  compact?: boolean;
  loading?: boolean;
}

function varianceRowStyle(varies?: boolean): CSSProperties | undefined {
  if (!varies) return undefined;
  return {
    background: 'rgba(254, 202, 202, 0.12)',
    boxShadow: 'inset 3px 0 0 rgba(244, 63, 94, 0.55)',
  };
}

export function MarketingPlanAssessmentPanel({ assessment, compact = false, loading = false }: MarketingPlanAssessmentPanelProps) {
  if (loading || !assessment) {
    return (
      <div className="glass-card animate-pulse overflow-hidden" style={{ padding: compact ? '1.25rem 1.5rem' : '1.5rem 1.75rem', minHeight: 220 }}>
        <div style={{ height: 10, width: 140, borderRadius: 6, background: 'var(--border)' }} />
        <div style={{ height: 16, width: 280, borderRadius: 6, background: 'var(--border)', marginTop: 12 }} />
        <div style={{ height: 120, borderRadius: 10, background: 'var(--border)', marginTop: 16, opacity: 0.5 }} />
      </div>
    );
  }

  const hasVariance = assessment.rows.some((r) => r.variesFromMarket);

  return (
    <div className="glass-card overflow-hidden animate-fade-in-up hgv-card-hover" style={{ padding: compact ? '1.25rem 1.5rem' : '1.5rem 1.75rem' }}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="text-[9px] font-bold uppercase tracking-wider text-amber-500">
            External Compensation Plan Assessment · {assessment.channelCode}
          </span>
          <h4 className="mt-1 text-sm font-bold text-foreground">{assessment.roleTitle}</h4>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {assessment.planId} - HGV Plan vs Market Competitor Standard
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border/10">
        <table className="data-table data-table-compact w-full">
          <thead>
            <tr>
              <th style={{ minWidth: 130 }}>Category</th>
              <th>HGV Plan</th>
              <th>Market Plan</th>
            </tr>
          </thead>
          <tbody>
            {assessment.rows.map((row) => (
              <tr key={row.attribute} style={varianceRowStyle(row.variesFromMarket)}>
                <td className="align-top font-semibold text-muted-foreground">
                  <div className="flex flex-col gap-1">
                    <span>{row.attribute}</span>
                    {row.variesFromMarket && (
                      <span
                        className="inline-flex w-fit rounded px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide"
                        style={{ background: 'rgba(244, 63, 94, 0.15)', color: 'rgb(251, 113, 133)' }}
                      >
                        Varies from market
                      </span>
                    )}
                  </div>
                </td>
                <td className="align-top">
                  <PlanAssessmentCell segments={row.hgvPlan} attribute={row.attribute} />
                </td>
                <td className="align-top">
                  <PlanAssessmentCell segments={row.marketStandard} attribute={row.attribute} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {hasVariance && (
          <div className="mt-3 flex items-center gap-2 text-[10px] text-muted-foreground">
            <span
              className="inline-block h-3 w-3 rounded-sm border border-rose-400/40"
              style={{ background: 'rgba(254, 202, 202, 0.25)' }}
            />
            Shaded rows indicate where HGV varies from the market.
          </div>
        )}
      </div>
    </div>
  );
}
