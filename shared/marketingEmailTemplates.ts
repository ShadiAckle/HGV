/** Minimal tour fields needed to compose guest outreach emails. */
export interface MarketingTourEmailInput {
  tour_id: string;
  guest_name: string;
  guest_type: string;
  tour_status: string;
  arrival_date?: string;
  tour_booked_date?: string;
  current_property?: string;
  stay_duration_nights?: number;
  properties_owned?: string[];
  owner_status?: string;
  payout: number;
  fps_potential: number;
  notes?: string;
  guest_email?: string;
  code?: string;
  planned_tour_location?: { location_name?: string; market?: string; brand?: string };
}

export interface TourEmailContext {
  rep_name: string;
  assigned_area: string;
  guest_name: string;
  guest_email: string;
  tour_id: string;
  tour_status: string;
  guest_type: string;
  owner_status?: string;
  tour_booked_date?: string;
  arrival_date?: string;
  current_property?: string;
  stay_duration_nights?: number;
  properties_owned?: string[];
  payout: number;
  fps_potential: number;
  notes?: string;
}

export type MarketingEmailTemplateId =
  | 'tour_arrival_confirmation'
  | 'no_show_rebook'
  | 'fps_follow_up'
  | 'qualification_clarification'
  | 'owner_portfolio_review';

export interface MarketingEmailTemplate {
  id: MarketingEmailTemplateId;
  label: string;
  description: string;
  subject: (ctx: TourEmailContext) => string;
  body: (ctx: TourEmailContext) => string;
}

const fmtUSD = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

export const MARKETING_EMAIL_TEMPLATES: MarketingEmailTemplate[] = [
  {
    id: 'tour_arrival_confirmation',
    label: 'Tour arrival confirmation',
    description: 'Confirm scheduled presentation and desk location before guest arrival.',
    subject: (ctx) => `Your HGV vacation presentation — ${ctx.arrival_date ?? 'upcoming visit'}`,
    body: (ctx) =>
      `Dear ${ctx.guest_name},

Thank you for booking your Hilton Grand Vacations presentation (Tour ${ctx.tour_id}).

We look forward to welcoming you on ${ctx.arrival_date ?? ctx.tour_booked_date ?? 'your scheduled date'} at ${ctx.current_property ?? ctx.assigned_area}. Please check in at the ${ctx.assigned_area} desk upon arrival.

If your plans change, reply to this message so we can adjust your reservation and keep your tour credit active.

Best regards,
${ctx.rep_name}
Marketing Representative | ${ctx.assigned_area}
Hilton Grand Vacations`,
  },
  {
    id: 'no_show_rebook',
    label: 'No-show rebook',
    description: 'Recover a missed tour and offer a new appointment window.',
    subject: (ctx) => `We missed you — let's reschedule your HGV tour (${ctx.tour_id})`,
    body: (ctx) =>
      `Dear ${ctx.guest_name},

We noticed you were unable to attend your scheduled presentation on ${ctx.arrival_date ?? ctx.tour_booked_date ?? 'your recent visit'} (Tour ${ctx.tour_id}).

We would still love to host you at ${ctx.current_property ?? ctx.assigned_area}. Reply with a preferred date and time this week and I will hold a new tour slot for you.

Best regards,
${ctx.rep_name}
Marketing Representative | ${ctx.assigned_area}
Hilton Grand Vacations`,
  },
  {
    id: 'fps_follow_up',
    label: 'FPS package follow-up',
    description: 'Follow up after a qualified tour where FPS was not sold — compensation-relevant conversion.',
    subject: (ctx) => `Flexible Points Package information — Tour ${ctx.tour_id}`,
    body: (ctx) =>
      `Dear ${ctx.guest_name},

Thank you for completing your Hilton Grand Vacations presentation on ${ctx.arrival_date ?? 'your recent visit'} (Tour ${ctx.tour_id}).

As discussed, the Flexible Points Package can extend the value of your stay at ${ctx.current_property ?? 'your resort'}. I am happy to walk through package options that fit your travel plans${ctx.fps_potential > 0 ? ` (estimated package value ${fmtUSD(ctx.fps_potential)})` : ''}.

Reply if you would like a brief follow-up before you depart.

Best regards,
${ctx.rep_name}
Marketing Representative | ${ctx.assigned_area}
Hilton Grand Vacations`,
  },
  {
    id: 'qualification_clarification',
    label: 'Tour qualification clarification',
    description: 'Explain courtesy / non-qualified tour status tied to payout rules.',
    subject: (ctx) => `Tour ${ctx.tour_id} — guest type & qualification summary`,
    body: (ctx) =>
      `Dear ${ctx.guest_name},

Thank you for visiting Hilton Grand Vacations (Tour ${ctx.tour_id}).

This note confirms your guest classification as ${ctx.guest_type}${ctx.notes ? `: ${ctx.notes}` : ''}. If you believe any detail on your arrival record is incorrect, reply with your confirmation number and I will route it for review under our tour qualification policy.

Best regards,
${ctx.rep_name}
Marketing Representative | ${ctx.assigned_area}
Hilton Grand Vacations`,
  },
  {
    id: 'owner_portfolio_review',
    label: 'Owner portfolio review',
    description: 'Owner guest — reference existing ownership and on-property stay.',
    subject: (ctx) => `Owner portfolio review — ${ctx.current_property ?? ctx.assigned_area}`,
    body: (ctx) =>
      `Dear ${ctx.guest_name},

Thank you for being a valued Hilton Grand Vacations Owner${ctx.properties_owned?.length ? ` (${ctx.properties_owned.join('; ')})` : ''}.

During your stay at ${ctx.current_property ?? ctx.assigned_area}${ctx.stay_duration_nights ? ` (${ctx.stay_duration_nights} nights)` : ''}, I would welcome a brief portfolio review tied to Tour ${ctx.tour_id} on ${ctx.arrival_date ?? ctx.tour_booked_date ?? 'your visit'}.

Reply with a convenient time and I will confirm your appointment at the ${ctx.assigned_area} desk.

Best regards,
${ctx.rep_name}
Marketing Representative | ${ctx.assigned_area}
Hilton Grand Vacations`,
  },
];

export function buildTourEmailContext(
  tour: MarketingTourEmailInput,
  repName: string,
  assignedArea: string,
  guestEmail?: string,
): TourEmailContext {
  return {
    rep_name: repName,
    assigned_area: assignedArea,
    guest_name: tour.guest_name,
    guest_email: guestEmail ?? tour.guest_email ?? '',
    tour_id: tour.tour_id,
    tour_status: tour.tour_status,
    guest_type: tour.guest_type,
    owner_status: tour.owner_status,
    tour_booked_date: tour.tour_booked_date,
    arrival_date: tour.arrival_date,
    current_property: tour.current_property,
    stay_duration_nights: tour.stay_duration_nights,
    properties_owned: tour.properties_owned,
    payout: tour.payout,
    fps_potential: tour.fps_potential,
    notes: tour.notes,
  };
}

/** Pick the best default template from tour status and guest context. */
export function suggestEmailTemplateId(ctx: TourEmailContext): MarketingEmailTemplateId {
  const status = ctx.tour_status.toUpperCase();
  const code = String(ctx.notes ?? '').toLowerCase();

  if (status === 'NO_SHOW') return 'no_show_rebook';
  if (ctx.guest_type === 'Owner' || ctx.owner_status === 'Owner') return 'owner_portfolio_review';
  if (ctx.guest_type === 'Non-Owner' || code.includes('courtesy') || code.includes('non-qualified')) {
    return 'qualification_clarification';
  }
  if (ctx.fps_potential > 0 && (code.includes('fps not sold') || code.includes('fps not'))) {
    return 'fps_follow_up';
  }
  if (status === 'SHOWN' && ctx.fps_potential > 0) return 'fps_follow_up';
  return 'tour_arrival_confirmation';
}

export function renderMarketingEmail(
  templateId: MarketingEmailTemplateId,
  ctx: TourEmailContext,
): { subject: string; body: string } {
  const template = MARKETING_EMAIL_TEMPLATES.find((t) => t.id === templateId) ?? MARKETING_EMAIL_TEMPLATES[0];
  return { subject: template.subject(ctx), body: template.body(ctx) };
}

export function mailtoHref(to: string, subject: string, body: string): string {
  const parts: string[] = [];
  if (subject) parts.push(`subject=${encodeURIComponent(subject)}`);
  if (body) parts.push(`body=${encodeURIComponent(body)}`);
  const addr = to ? encodeURIComponent(to) : '';
  return `mailto:${addr}${parts.length ? `?${parts.join('&')}` : ''}`;
}
