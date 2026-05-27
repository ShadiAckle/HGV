import { MarketingPlanAssessmentPanel } from '@/components/comp/MarketingPlanAssessmentPanel';
import { usePlanAssessment } from '@/hooks/usePlanAssessment';

interface PlanAssessmentFromWarehouseProps {
  personaId: string;
  periodId?: string;
  compact?: boolean;
}

export function PlanAssessmentFromWarehouse({ personaId, periodId, compact }: PlanAssessmentFromWarehouseProps) {
  const { assessment, loading } = usePlanAssessment(personaId, periodId);
  if (!assessment && !loading) return null;
  return <MarketingPlanAssessmentPanel assessment={assessment!} loading={loading} compact={compact} />;
}
