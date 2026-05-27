/** Governed manager intervention types — persisted to fact_manager_intervention + fact_comp_admin_log */

export type ManagerInterventionType = 'TAKEOVER_PRICING' | 'QUOTA_SHIELD';

export type ManagerInterventionStatus = 'ACTIVE' | 'REVOKED';

export interface ManagerInterventionRecord {
  intervention_id: string;
  manager_rep_id: string;
  target_rep_id: string;
  target_rep_name?: string;
  period_id: string;
  intervention_type: ManagerInterventionType;
  status: ManagerInterventionStatus;
  discount_pct: number | null;
  quota_relief_pct: number | null;
  tour_id: string | null;
  notes: string | null;
  admin_event_id: string | null;
  created_at: string;
}

export interface SubmitManagerInterventionPayload {
  manager_rep_id: string;
  target_rep_id: string;
  period_id: string;
  takeover_pricing?: {
    enabled: boolean;
    discount_pct: number;
    tour_id?: string | null;
  };
  quota_shield?: {
    enabled: boolean;
    relief_pct?: number;
  };
  notes?: string;
}

export const DEFAULT_QUOTA_RELIEF_PCT = 10;
export const MAX_TAKEOVER_DISCOUNT_PCT = 15;

export function interventionGapTone(attainmentPct: number): 'success' | 'warning' | 'danger' {
  if (attainmentPct >= 100) return 'success';
  if (attainmentPct < 70) return 'danger';
  return 'warning';
}
