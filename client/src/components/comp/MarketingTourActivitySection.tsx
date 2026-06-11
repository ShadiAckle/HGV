import { useState } from 'react';
import { CalendarDays, HandHelping } from 'lucide-react';
import { formatCurrency } from '@/lib/compFormat';
import { formatTourCode } from '@shared/normalizeText';
import type { MarketingTourEmailInput } from '@shared/marketingEmailTemplates';
import type { MarketingMoneyMap } from '@shared/marketingMoneyMap';
import { tourChipForId } from '@shared/marketingMoneyMap';
import { TourImpactChipBadge } from '@/components/comp/MarketingMoneyMapPanel';
import { MarketingTourInterveneDrawer } from '@/components/comp/MarketingTourInterveneDrawer';

export type MarketingTourRow = MarketingTourEmailInput & {
  code: string;
  lead_source?: string;
  abc_score?: string;
  planned_tour_location?: { location_name?: string; market?: string };
};

interface MarketingTourActivitySectionProps {
  tours: Array<Record<string, unknown>>;
  repName: string;
  repId: string;
  periodId: string;
  assignedArea: string;
  moneyMap?: MarketingMoneyMap | null;
  /** Promoted in simple view — always expanded */
  prominent?: boolean;
}

function normalizeTour(raw: Record<string, unknown>): MarketingTourRow {
  const planned = raw.planned_tour_location as Record<string, unknown> | undefined;
  return {
    tour_id: String(raw.tour_id ?? ''),
    guest_name: String(raw.guest_name ?? ''),
    guest_type: String(raw.guest_type ?? ''),
    arrival_date: raw.arrival_date != null ? String(raw.arrival_date) : undefined,
    tour_status: String(raw.tour_status ?? ''),
    code: String(raw.code ?? ''),
    payout: Number(raw.payout ?? 0),
    fps_potential: Number(raw.fps_potential ?? 0),
    tour_booked_date: raw.tour_booked_date != null ? String(raw.tour_booked_date) : undefined,
    guest_email: raw.guest_email != null ? String(raw.guest_email) : undefined,
    properties_owned: Array.isArray(raw.properties_owned)
      ? raw.properties_owned.map(String)
      : raw.properties_owned
        ? [String(raw.properties_owned)]
        : [],
    current_property: raw.current_property != null ? String(raw.current_property) : undefined,
    stay_duration_nights: raw.stay_duration_nights != null ? Number(raw.stay_duration_nights) : undefined,
    owner_status: raw.owner_status != null ? String(raw.owner_status) : undefined,
    notes: raw.notes != null ? String(raw.notes) : undefined,
    lead_source: raw.lead_source != null ? String(raw.lead_source) : undefined,
    abc_score: raw.abc_score != null ? String(raw.abc_score) : undefined,
    planned_tour_location: planned
      ? { location_name: String(planned.location_name ?? ''), market: String(planned.market ?? '') }
      : undefined,
  };
}

export function MarketingTourActivitySection({
  tours,
  repName,
  repId,
  periodId,
  assignedArea,
  moneyMap,
  prominent = false,
}: MarketingTourActivitySectionProps) {
  const rows = tours.map(normalizeTour);
  const [interveneTour, setInterveneTour] = useState<MarketingTourRow | null>(null);

  return (
    <>
      <div className={`glass-card hgv-card-hover overflow-hidden ${prominent ? 'p-6 ring-1 ring-primary/10' : 'p-6'}`}>
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CalendarDays size={15} className="text-[var(--gold)]" aria-hidden />
            <h3 className="text-sm font-bold uppercase tracking-wider">Tour Activity &amp; Credits</h3>
          </div>
          {prominent && (
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold text-primary">
              {rows.length} tours
            </span>
          )}
        </div>
        <div className="overflow-x-auto rounded-xl border border-border/10">
          <table className="data-table data-table-compact w-full text-left text-xs">
            <thead>
              <tr>
                <th>Tour ID</th>
                <th>Guest</th>
                <th>Owner / NB</th>
                <th>Planned location</th>
                <th>ABC</th>
                <th>Tour booked</th>
                <th>Arrival</th>
                <th>Status</th>
                <th>Comp impact</th>
                <th>Code</th>
                <th style={{ textAlign: 'right' }}>Payout</th>
                <th style={{ textAlign: 'right' }}>FPS Pot.</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => {
                const guestType = t.guest_type;
                const tourStatus = t.tour_status;
                const chip = tourChipForId(moneyMap, t.tour_id);
                const plannedLabel = t.planned_tour_location?.location_name
                  ? t.planned_tour_location.location_name.replace(/Sales Center.*/i, '').trim() ||
                    t.planned_tour_location.location_name
                  : '—';
                return (
                  <tr key={t.tour_id}>
                    <td className="font-mono text-primary">{t.tour_id}</td>
                    <td className="font-semibold">{t.guest_name}</td>
                    <td>
                      <span className={`badge ${guestType === 'Owner' ? 'badge-blue' : guestType === 'New Buyer' ? 'badge-green' : 'badge-neutral'}`}>
                        {guestType}
                      </span>
                    </td>
                    <td className="max-w-[140px] truncate text-muted-foreground" title={plannedLabel}>
                      {plannedLabel}
                    </td>
                    <td>
                      {t.abc_score ? (
                        <span className="badge badge-neutral font-mono">{t.abc_score}</span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>{t.tour_booked_date ?? '—'}</td>
                    <td>{t.arrival_date ?? '—'}</td>
                    <td>
                      <span className={`badge ${tourStatus === 'SHOWN' ? 'badge-green' : tourStatus === 'NO_SHOW' ? 'badge-rose' : 'badge-amber'}`}>
                        {tourStatus.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="min-w-[140px]">
                      {chip ? <TourImpactChipBadge chip={chip} /> : '—'}
                    </td>
                    <td className="font-mono text-muted-foreground">{formatTourCode(t.code)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--primary)' }}>{formatCurrency(t.payout)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: t.fps_potential > 0 ? 'var(--gold-light)' : 'var(--foreground-muted)' }}>
                      {t.fps_potential > 0 ? formatCurrency(t.fps_potential) : '—'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={() => setInterveneTour(t)}
                        className="inline-flex items-center gap-1 rounded-lg border border-primary/25 bg-primary/5 px-2 py-1 text-[10px] font-bold text-primary hover:bg-primary/10"
                      >
                        <HandHelping size={10} />
                        Intervene
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {interveneTour && (
        <MarketingTourInterveneDrawer
          tour={interveneTour}
          repName={repName}
          repId={repId}
          periodId={periodId}
          assignedArea={assignedArea}
          onClose={() => setInterveneTour(null)}
        />
      )}
    </>
  );
}
