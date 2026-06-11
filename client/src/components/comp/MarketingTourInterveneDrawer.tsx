import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Check, Copy, Loader2, Mail, X } from 'lucide-react';
import { formatCurrency } from '@/lib/compFormat';
import {
  MARKETING_EMAIL_TEMPLATES,
  buildTourEmailContext,
  mailtoHref,
  renderMarketingEmail,
  suggestEmailTemplateId,
  type MarketingEmailTemplateId,
  type MarketingTourEmailInput,
} from '@shared/marketingEmailTemplates';
import { computeTourImpactChip } from '@shared/marketingMoneyMap';
import type { MarketingTourContextPayload } from '@shared/marketingTourContext';
import { TourImpactChipBadge } from '@/components/comp/MarketingMoneyMapPanel';

interface MarketingTourInterveneDrawerProps {
  tour: MarketingTourEmailInput;
  repName: string;
  repId: string;
  periodId: string;
  assignedArea: string;
  onClose: () => void;
}

export function MarketingTourInterveneDrawer({
  tour,
  repName,
  repId,
  periodId,
  assignedArea,
  onClose,
}: MarketingTourInterveneDrawerProps) {
  const [context, setContext] = useState<MarketingTourContextPayload | null>(null);
  const [loadingContext, setLoadingContext] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoadingContext(true);
    const params = new URLSearchParams({ rep_id: repId, period_id: periodId });
    fetch(`/api/comp/marketing/tour/${encodeURIComponent(tour.tour_id)}/context?${params}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: MarketingTourContextPayload | null) => {
        if (!cancelled) setContext(data);
      })
      .catch(() => {
        if (!cancelled) setContext(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingContext(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tour.tour_id, repId, periodId]);

  const mergedTour = useMemo((): MarketingTourEmailInput => {
    if (!context) return tour;
    return {
      ...tour,
      guest_email: context.guest_email ?? tour.guest_email,
      owner_status: context.owner_status ?? tour.owner_status,
      tour_booked_date: context.tour_booked_date ?? tour.tour_booked_date,
      current_property: context.current_stay_location?.location_name ?? context.current_property ?? tour.current_property,
      stay_duration_nights: context.stay_duration_nights ?? tour.stay_duration_nights,
      properties_owned: context.properties_owned ?? tour.properties_owned,
      notes: context.notes ?? tour.notes,
    };
  }, [tour, context]);

  const emailContext = useMemo(
    () => buildTourEmailContext(mergedTour, repName, assignedArea),
    [mergedTour, repName, assignedArea],
  );

  const [templateId, setTemplateId] = useState<MarketingEmailTemplateId>(() =>
    suggestEmailTemplateId(emailContext),
  );
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const rendered = renderMarketingEmail(templateId, emailContext);
    setSubject(rendered.subject);
    setBody(rendered.body);
  }, [templateId, emailContext]);

  const activeTemplate = MARKETING_EMAIL_TEMPLATES.find((t) => t.id === templateId);

  const copyDraft = useCallback(async () => {
    const text = `To: ${emailContext.guest_email || emailContext.guest_name}\nSubject: ${subject}\n\n${body}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }, [emailContext.guest_email, emailContext.guest_name, subject, body]);

  const openMailClient = useCallback(() => {
    const to = emailContext.guest_email || '';
    window.location.href = mailtoHref(to, subject, body);
  }, [emailContext.guest_email, subject, body]);

  const compImpact = useMemo(
    () =>
      computeTourImpactChip({
        tour_id: mergedTour.tour_id,
        guest_name: mergedTour.guest_name,
        guest_type: mergedTour.guest_type,
        tour_status: mergedTour.tour_status,
        code: mergedTour.code,
        payout: mergedTour.payout,
        fps_potential: mergedTour.fps_potential,
        notes: mergedTour.notes,
      }),
    [mergedTour],
  );

  const planned = context?.planned_tour_location;
  const stay = context?.current_stay_location;
  const demo = context?.demographics;
  const quality = context?.quality;

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
      style={{ background: 'rgba(4, 6, 10, 0.75)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="card w-full max-w-2xl animate-fade-in-up"
        style={{ padding: '1.5rem', maxHeight: '92vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-primary">Intervene — guest comp context</div>
            <h4 className="mt-1 text-lg font-bold">{mergedTour.guest_name}</h4>
            <p className="text-xs text-muted-foreground font-mono">
              {mergedTour.tour_id}
              {context?.guest_id ? ` · ${context.guest_id}` : ''}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>

        {loadingContext && (
          <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 size={14} className="animate-spin" />
            Loading governed guest profile…
          </div>
        )}

        <div
          className={`mb-4 rounded-xl border p-3 ${
            compImpact.tier === 'green'
              ? 'border-emerald-500/25 bg-emerald-500/5'
              : compImpact.tier === 'amber'
                ? 'border-amber-500/25 bg-amber-500/5'
                : 'border-rose-500/25 bg-rose-500/5'
          }`}
        >
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Comp impact</div>
          <p className="mt-1 text-sm font-semibold leading-relaxed text-foreground">{compImpact.comp_impact_line}</p>
          <div className="mt-2">
            <TourImpactChipBadge chip={compImpact} />
          </div>
        </div>

        <section className="mb-4">
          <SectionTitle>This tour</SectionTitle>
          <dl className="grid gap-2 text-xs sm:grid-cols-2">
            <ProfileField label="Owner / guest type" value={mergedTour.owner_status ?? mergedTour.guest_type} />
            <ProfileField label="Qualification code" value={context?.qualification_code ?? '—'} />
            <ProfileField label="Tour booked" value={mergedTour.tour_booked_date ?? '—'} />
            <ProfileField label="Arrival" value={mergedTour.arrival_date ?? '—'} />
            <ProfileField label="Status / code" value={`${mergedTour.tour_status}${mergedTour.code ? ` · ${mergedTour.code}` : ''}`} />
            <ProfileField label="Lead / ABC / package" value={formatLeadQuality(context)} />
            <ProfileField
              label="Planned tour location"
              value={planned ? `${planned.location_name} (${planned.market} · ${planned.brand})` : '—'}
              className="sm:col-span-2"
            />
            <ProfileField
              label="Current stay"
              value={
                stay
                  ? `${stay.location_name}${mergedTour.stay_duration_nights != null ? ` · ${mergedTour.stay_duration_nights} nights` : ''}`
                  : mergedTour.current_property ?? '—'
              }
              className="sm:col-span-2"
            />
            <ProfileField
              label="Compensation"
              value={`Payout ${formatCurrency(mergedTour.payout)}${mergedTour.fps_potential > 0 ? ` · FPS pot. ${formatCurrency(mergedTour.fps_potential)}` : ''}`}
              className="sm:col-span-2"
            />
            {quality && (
              <ProfileField
                label="Sales outcome"
                value={`${quality.showed_flag ? 'Showed' : 'No-show'} · ${quality.closed_flag ? 'Closed' : 'No sale'}${quality.vpg > 0 ? ` · VPG ${formatCurrency(quality.vpg)}` : ''}${quality.rescission_flag ? ' · Rescinded' : ''}`}
                className="sm:col-span-2"
              />
            )}
          </dl>
        </section>

        {demo && (
          <section className="mb-4">
            <SectionTitle>Demographics (governed bands)</SectionTitle>
            <dl className="grid gap-2 text-xs sm:grid-cols-2">
              <ProfileField label="Household size" value={demo.hh_size_band} />
              <ProfileField label="Income band" value={demo.income_band} />
              <ProfileField label="Home market" value={demo.home_msa ?? '—'} className="sm:col-span-2" />
            </dl>
          </section>
        )}

        <section className="mb-4">
          <SectionTitle>HGV relationship</SectionTitle>
          <dl className="grid gap-2 text-xs sm:grid-cols-2">
            <ProfileField
              label="Ownership"
              value={
                context?.ownership?.length
                  ? context.ownership.map((o) => `${o.property_name} (${o.contract_status})`).join(' · ')
                  : mergedTour.properties_owned?.length
                    ? mergedTour.properties_owned.join(' · ')
                    : 'None on file'
              }
              className="sm:col-span-2"
            />
            <ProfileField
              label="Stays & rentals"
              value={
                context?.rental_stays?.length
                  ? context.rental_stays
                      .slice(0, 3)
                      .map((s) => `${s.stay_type.replace(/_/g, ' ')} @ ${s.location.location_name} (${s.nights}n)`)
                      .join(' · ')
                  : context?.rental_stay_count
                    ? `${context.rental_stay_count} stay record(s) on file`
                    : '—'
              }
              className="sm:col-span-2"
            />
            <ProfileField
              label="Prior tours"
              value={
                context?.tour_history?.length
                  ? context.tour_history
                      .slice(0, 4)
                      .map((h) => `${h.tour_id} ${h.tour_status} (${h.tour_date})`)
                      .join(' · ')
                  : context?.prior_tour_count
                    ? `${context.prior_tour_count} prior tour(s)`
                    : 'First tour on file'
              }
              className="sm:col-span-2"
            />
          </dl>
        </section>

        <div className="space-y-3 border-t border-border/15 pt-4">
          <div className="flex items-center gap-2">
            <Mail size={14} className="text-primary" />
            <span className="text-xs font-bold uppercase tracking-wider">Templated email</span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Compensation follow-up only — opens your email client with a pre-filled draft. No message is sent from this app.
          </p>

          <label className="block text-[11px] font-semibold text-muted-foreground">
            Template
            <select
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value as MarketingEmailTemplateId)}
            >
              {MARKETING_EMAIL_TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          {activeTemplate && (
            <p className="text-[10px] text-muted-foreground">{activeTemplate.description}</p>
          )}

          <label className="block text-[11px] font-semibold text-muted-foreground">
            To
            <input
              readOnly
              className="mt-1 w-full rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs"
              value={emailContext.guest_email || '(add guest email in CRM)'}
            />
          </label>

          <label className="block text-[11px] font-semibold text-muted-foreground">
            Subject
            <input
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </label>

          <label className="block text-[11px] font-semibold text-muted-foreground">
            Message
            <textarea
              className="mt-1 min-h-[160px] w-full rounded-lg border border-border bg-background px-3 py-2 text-xs leading-relaxed"
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </label>

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={() => void copyDraft()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-3 py-2 text-[11px] font-bold hover:bg-muted/50"
            >
              {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
              {copied ? 'Copied' : 'Copy draft'}
            </button>
            <button
              type="button"
              onClick={openMailClient}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-[11px] font-bold text-primary-foreground shadow-sm hover:bg-primary/90"
            >
              <Mail size={12} />
              Open in email client
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h5 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{children}</h5>
  );
}

function formatLeadQuality(ctx: MarketingTourContextPayload | null): string {
  if (!ctx?.lead_source && !ctx?.abc_score) return '—';
  const parts = [ctx.lead_source, ctx.abc_score ? `ABC ${ctx.abc_score}` : '', ctx.package_type].filter(Boolean);
  return parts.join(' · ') || '—';
}

function ProfileField({
  label,
  value,
  className = '',
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={`rounded-lg border border-border/15 bg-muted/20 p-2.5 ${className}`}>
      <dt className="font-bold text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-semibold text-foreground">{value}</dd>
    </div>
  );
}
