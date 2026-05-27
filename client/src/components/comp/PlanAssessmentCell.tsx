import type { PlanAssessmentSegment } from '@/data/marketingPlanAssessment';
import { normalizeDisplayText } from '@shared/normalizeText';

interface PlanAssessmentCellProps {
  segments: PlanAssessmentSegment[];
  attribute: string;
}

function isChipRow(attribute: string, segments: PlanAssessmentSegment[]): boolean {
  if (attribute === 'Metrics / Weights') return true;
  return segments.length > 1 && segments.every((s) => !s.label);
}

export function PlanAssessmentCell({ segments, attribute }: PlanAssessmentCellProps) {
  if (!segments.length) return null;

  const normalized = segments.map((seg) => ({
    ...seg,
    label: seg.label ? normalizeDisplayText(seg.label) : seg.label,
    value: normalizeDisplayText(seg.value),
  }));

  if (isChipRow(attribute, segments)) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {normalized.map((seg) => (
          <span
            key={seg.value}
            className="inline-flex rounded-md border border-border/20 bg-muted/40 px-2 py-0.5 text-[11px] font-medium leading-snug text-foreground"
          >
            {seg.value}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {normalized.map((seg) => (
        <div key={`${seg.label ?? 'row'}-${seg.value}`} className="flex flex-col gap-1">
          {seg.label && (
            <span className="inline-flex w-fit rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary">
              {seg.label}
            </span>
          )}
          <span className="text-[11px] leading-relaxed text-foreground">{seg.value}</span>
        </div>
      ))}
    </div>
  );
}
