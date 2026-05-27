import type { PlanAssessmentRow } from '../shared/planAssessmentCatalog.js';
import { enrichPlanAssessmentPayload, getPlanAssessmentFallback } from '../shared/planAssessmentCatalog.js';
import { normalizeDisplayText } from '../shared/normalizeText.js';
import { CURRENT_PERIOD_ID } from '../shared/compPeriods.js';

export type RunSql = (sql: string) => Promise<Record<string, unknown>[]>;

export interface PlanAssessmentPayload {
  persona_id: string;
  plan_id: string;
  role_title: string;
  channel_code: string;
  effective_period: string;
  rows: PlanAssessmentRow[];
  key_findings: string[];
}

function buildPayload(
  personaId: string,
  planId: string,
  roleTitle: string,
  channelCode: string,
  periodId: string,
  rows: PlanAssessmentRow[],
): PlanAssessmentPayload {
  const enriched = enrichPlanAssessmentPayload(personaId, rows);
  return {
    persona_id: personaId,
    plan_id: planId,
    role_title: roleTitle,
    channel_code: channelCode,
    effective_period: periodId,
    rows: enriched.rows,
    key_findings: enriched.keyFindings,
  };
}

export async function fetchPlanAssessment(
  runSql: RunSql,
  personaId: string,
  periodId = CURRENT_PERIOD_ID,
): Promise<PlanAssessmentPayload | null> {
  const safePersona = personaId.replace(/'/g, "''");
  const safePeriod = periodId.replace(/'/g, "''");

  try {
    const profiles = await runSql(`
      SELECT persona_id, plan_id, role_title, channel_code, effective_period
      FROM workspace.hgv_comp.plan_assessment_profile
      WHERE persona_id = '${safePersona}' AND effective_period = '${safePeriod}'
    `);
    if (!profiles.length) {
      const fb = getPlanAssessmentFallback(personaId);
      if (!fb) return null;
      return buildPayload(fb.personaId, fb.planId, fb.roleTitle, fb.channelCode, periodId, fb.rows);
    }

    const segments = await runSql(`
      SELECT attribute, attribute_order, side, segment_order, segment_label, segment_value
      FROM workspace.hgv_comp.plan_assessment_segment
      WHERE persona_id = '${safePersona}' AND effective_period = '${safePeriod}'
      ORDER BY attribute_order, side, segment_order
    `);
    if (!segments.length) {
      const fb = getPlanAssessmentFallback(personaId);
      if (!fb) return null;
      return buildPayload(fb.personaId, fb.planId, fb.roleTitle, fb.channelCode, periodId, fb.rows);
    }

    const profile = profiles[0];
    const rowMap = new Map<string, PlanAssessmentRow>();

    for (const seg of segments) {
      const attribute = normalizeDisplayText(String(seg.attribute));
      if (!rowMap.has(attribute)) {
        rowMap.set(attribute, { attribute, hgvPlan: [], marketStandard: [] });
      }
      const row = rowMap.get(attribute)!;
      const entry = {
        ...(seg.segment_label ? { label: normalizeDisplayText(String(seg.segment_label)) } : {}),
        value: normalizeDisplayText(String(seg.segment_value)),
      };
      if (String(seg.side) === 'market') row.marketStandard.push(entry);
      else row.hgvPlan.push(entry);
    }

    return buildPayload(
      String(profile.persona_id),
      String(profile.plan_id),
      String(profile.role_title),
      String(profile.channel_code),
      String(profile.effective_period),
      [...rowMap.values()],
    );
  } catch {
    const fb = getPlanAssessmentFallback(personaId);
    if (!fb) return null;
    return buildPayload(fb.personaId, fb.planId, fb.roleTitle, fb.channelCode, periodId, fb.rows);
  }
}
