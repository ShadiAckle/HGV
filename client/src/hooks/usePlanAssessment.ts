import { useCallback, useEffect, useState } from 'react';
import type { PlanAssessmentRow } from '@/data/marketingPlanAssessment';
import { getPlanAssessmentFallback } from '@/data/marketingPlanAssessment';
import { CURRENT_PERIOD_ID } from '@shared/compPeriods';

export interface PlanAssessmentData {
  planId: string;
  roleTitle: string;
  channelCode: string;
  rows: PlanAssessmentRow[];
  keyFindings: string[];
}

export function usePlanAssessment(personaId: string | null, periodId = CURRENT_PERIOD_ID) {
  const [assessment, setAssessment] = useState<PlanAssessmentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!personaId) {
      setAssessment(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/comp/plan-assessment?persona_id=${encodeURIComponent(personaId)}&period_id=${encodeURIComponent(periodId)}`,
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as {
        plan_id: string;
        role_title: string;
        channel_code: string;
        rows: PlanAssessmentRow[];
        key_findings?: string[];
      };
      setAssessment({
        planId: data.plan_id,
        roleTitle: data.role_title,
        channelCode: data.channel_code,
        rows: data.rows,
        keyFindings: data.key_findings ?? [],
      });
    } catch (err) {
      const fb = getPlanAssessmentFallback(personaId);
      if (fb) {
        setAssessment({
          planId: fb.planId,
          roleTitle: fb.roleTitle,
          channelCode: fb.channelCode,
          rows: fb.rows,
          keyFindings: fb.keyFindings,
        });
        setError(null);
      } else {
        setError(err instanceof Error ? err.message : 'Plan assessment unavailable');
        setAssessment(null);
      }
    } finally {
      setLoading(false);
    }
  }, [personaId, periodId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { assessment, loading, error, reload: load };
}
