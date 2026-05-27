/**
 * Unified plan assessments — Marketing (C2a–C2c) and Sales Manager override plans.
 */
import {
  getMarketingPlanAssessment,
  MARKETING_PLAN_ASSESSMENTS,
  SALES_MANAGER_ASSESSMENT,
  type MarketingPersonaId,
  type MarketingPlanAssessment,
  type PlanAssessmentRow,
  type PlanAssessmentSegment,
} from './marketingPlanAssessment';

export type { PlanAssessmentRow, PlanAssessmentSegment, MarketingPlanAssessment, MarketingPersonaId };
export { getMarketingPlanAssessment, MARKETING_PLAN_ASSESSMENTS };

export interface PlanAssessment {
  planId: string;
  roleTitle: string;
  channelCode: string;
  compBasis: string;
  rows: PlanAssessmentRow[];
}

/** PLAN-MGR-2025 — Sales Manager override plan (player-coach / team volume). */
export const SALES_MANAGER_PLAN: PlanAssessment = {
  planId: SALES_MANAGER_ASSESSMENT.planId,
  roleTitle: SALES_MANAGER_ASSESSMENT.roleTitle,
  channelCode: SALES_MANAGER_ASSESSMENT.channelCode,
  compBasis: 'Paid on direct-report closed volume, team quota attainment, FFS mix, and override credits when stepping in on takeovers (TOs).',
  rows: SALES_MANAGER_ASSESSMENT.rows,
};

export function getPlanForManager(
  _repId: string,
  personaId: MarketingPersonaId | null,
): PlanAssessment {
  if (personaId === 'marketing_manager') {
    const m = getMarketingPlanAssessment('marketing_manager');
    return { ...m, compBasis: 'Paid on site LM Tours, LM NSV, Club Penetration, and Contribution — all driven by direct-report tour flow and downstream sales.' };
  }
  if (personaId === 'marketing_director') {
    const m = getMarketingPlanAssessment('marketing_director');
    return { ...m, compBasis: 'Paid on regional NSV, New Owner NSV, DC Contribution, and club penetration qualifiers across all sites in the region.' };
  }
  return SALES_MANAGER_PLAN;
}

export function marketingPlanToAssessment(m: MarketingPlanAssessment): PlanAssessment {
  return {
    planId: m.planId,
    roleTitle: m.roleTitle,
    channelCode: m.channelCode,
    compBasis: '',
    rows: m.rows,
  };
}
