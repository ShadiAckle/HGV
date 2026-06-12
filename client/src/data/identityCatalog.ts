/**
 * Identity catalog — maps rep records to stakeholder-facing role titles
 * and marketing channel personas (slides 40–42).
 */
import type { MarketingPersonaId } from './marketingPlanAssessment';

export type IdentityGroup = 'sales_executive' | 'sales_manager' | 'marketing_channel';

export interface RepIdentity {
  rep_id: string;
  rep_name: string;
  level_code: string;
  team_id: string;
  region: string;
  is_active: boolean;
  role_title?: string;
  persona_id?: string;
  plan_id?: string;
  identity_group?: IdentityGroup;
}

export interface MarketingChannelIdentity extends RepIdentity {
  role_title: string;
  identity_group: 'marketing_channel';
  persona_id: MarketingPersonaId;
  plan_id: string;
}

/** Virtual marketing identities — not stored in dim_rep (Persona Sandbox channel plans). */
export const MARKETING_CHANNEL_IDENTITIES: readonly MarketingChannelIdentity[] = [
  {
    rep_id: 'PERSONA-MKT-REP',
    rep_name: 'T. Brooks',
    level_code: 'C2a',
    team_id: 'TEAM-MKT-LAS',
    region: 'West',
    is_active: true,
    role_title: 'Marketing Representative',
    identity_group: 'marketing_channel',
    persona_id: 'marketing_rep',
    plan_id: 'PLAN-MKT-REP-2026',
  },
  {
    rep_id: 'PERSONA-MKT-MGR',
    rep_name: 'R. Castillo',
    level_code: 'C2b',
    team_id: 'TEAM-MKT-LAS',
    region: 'West',
    is_active: true,
    role_title: 'Marketing Manager',
    identity_group: 'marketing_channel',
    persona_id: 'marketing_manager',
    plan_id: 'PLAN-MKT-MGR-2026',
  },
  {
    rep_id: 'PERSONA-MKT-DIR',
    rep_name: 'D. Whitfield',
    level_code: 'C2c',
    team_id: 'TEAM-MKT-REG',
    region: 'West',
    is_active: true,
    role_title: 'Marketing Director',
    identity_group: 'marketing_channel',
    persona_id: 'marketing_director',
    plan_id: 'PLAN-MKT-DIR-2026',
  },
] as const;

export function isMarketingChannelRepId(repId: string): boolean {
  return repId.startsWith('PERSONA-MKT-');
}

export function isMarketingChannelIdentity(
  rep: Pick<RepIdentity, 'rep_id' | 'identity_group'>,
): boolean {
  return rep.identity_group === 'marketing_channel' || isMarketingChannelRepId(rep.rep_id);
}

export function getMarketingPersonaId(
  repId: string,
  rep?: Pick<RepIdentity, 'persona_id' | 'identity_group'> | null,
): MarketingPersonaId | null {
  if (rep?.persona_id) return rep.persona_id as MarketingPersonaId;
  const match = MARKETING_CHANNEL_IDENTITIES.find((i) => i.rep_id === repId);
  if (match) return match.persona_id;
  if (rep?.identity_group === 'marketing_channel') return 'marketing_rep';
  return null;
}

export function resolveRoleTitle(rep: Pick<RepIdentity, 'rep_id' | 'level_code'> & { role_title?: string }): string {
  if (rep.role_title) return rep.role_title;
  const marketing = MARKETING_CHANNEL_IDENTITIES.find((m) => m.rep_id === rep.rep_id);
  if (marketing) return marketing.role_title;
  if (rep.rep_id.includes('MGR') || rep.level_code === 'L9') return 'Sales Manager';
  return 'Sales Executive';
}

export function resolveIdentityGroup(repId: string, levelCode: string): IdentityGroup {
  if (isMarketingChannelRepId(repId)) return 'marketing_channel';
  if (repId.includes('MGR') || levelCode === 'L9') return 'sales_manager';
  return 'sales_executive';
}

export function mergeMarketingIdentities(reps: RepIdentity[]): RepIdentity[] {
  const hasLiveMarketing = reps.some(
    (r) => r.identity_group === 'marketing_channel' && !isMarketingChannelRepId(r.rep_id),
  );
  if (hasLiveMarketing) return reps;
  const dbIds = new Set(reps.map((r) => r.rep_id));
  const marketing = MARKETING_CHANNEL_IDENTITIES.filter((m) => !dbIds.has(m.rep_id));
  return [...marketing, ...reps];
}

export function sortIdentitiesForDropdown(reps: RepIdentity[]): RepIdentity[] {
  const marketing = reps.filter((r) => isMarketingChannelRepId(r.rep_id));
  const managers = reps.filter((r) => !isMarketingChannelRepId(r.rep_id) && (r.rep_id.includes('MGR') || r.level_code === 'L9'));
  const sales = reps.filter((r) => !isMarketingChannelRepId(r.rep_id) && !r.rep_id.includes('MGR') && r.level_code !== 'L9');
  return [...marketing, ...managers, ...sales];
}

/** Identity picker — marketing channel plans only (slides 40–42). */
export function getMarketingDropdownIdentities(reps?: RepIdentity[]): RepIdentity[] {
  const fromWarehouse = (reps ?? []).filter((r) => isMarketingChannelIdentity(r));
  if (fromWarehouse.length > 0) return fromWarehouse;
  return [...MARKETING_CHANNEL_IDENTITIES];
}

export const DEFAULT_MARKETING_REP_ID = MARKETING_CHANNEL_IDENTITIES[0].rep_id;
