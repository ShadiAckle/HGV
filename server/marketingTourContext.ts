import { formatTourCode, normalizeDisplayText } from '../shared/normalizeText.js';
import type {
  GuestDemographics,
  GuestLocationSummary,
  GuestOwnershipRecord,
  GuestRentalStay,
  GuestTourHistoryEntry,
  MarketingTourContextPayload,
  MarketingTourEnrichment,
  TourQualityOutcome,
} from '../shared/marketingTourContext.js';

type RunSql = (sql: string) => Promise<Record<string, unknown>[]>;

function esc(value: string): string {
  return value.replace(/'/g, "''");
}

function n(v: unknown): number {
  return Number(v ?? 0);
}

function b(v: unknown): boolean {
  return v === true || v === 'true' || v === 1;
}

function locationFromRow(row: Record<string, unknown>, prefix: string): GuestLocationSummary | undefined {
  const id = row[`${prefix}_location_id`];
  if (!id) return undefined;
  return {
    location_id: String(id),
    location_name: String(row[`${prefix}_location_name`] ?? ''),
    location_type: String(row[`${prefix}_location_type`] ?? ''),
    market: String(row[`${prefix}_market`] ?? ''),
    brand: String(row[`${prefix}_brand`] ?? ''),
    desk_label: row[`${prefix}_desk_label`] != null ? String(row[`${prefix}_desk_label`]) : undefined,
  };
}

function qualityFromRow(row: Record<string, unknown>): TourQualityOutcome | undefined {
  if (!row.lead_source && !row.abc_score && row.showed_flag == null) return undefined;
  return {
    lead_source: String(row.lead_source ?? ''),
    abc_score: String(row.abc_score ?? ''),
    package_type: String(row.package_type ?? row.tq_package_type ?? ''),
    showed_flag: b(row.showed_flag),
    closed_flag: b(row.closed_flag),
    contract_status: String(row.contract_status ?? 'NONE'),
    rescission_flag: b(row.rescission_flag),
    net_sales_volume: n(row.net_sales_volume),
    vpg: n(row.vpg),
  };
}

function demographicsFromRow(row: Record<string, unknown>): GuestDemographics | undefined {
  if (!row.household_id) return undefined;
  return {
    household_id: String(row.household_id),
    hh_size_band: String(row.hh_size_band ?? ''),
    income_band: String(row.income_band ?? ''),
    home_msa: row.home_msa != null ? String(row.home_msa) : undefined,
  };
}

function ownerStatus(guestType: string, ownerFlag: boolean): string {
  if (ownerFlag || guestType === 'Owner') return 'Owner';
  if (guestType === 'New Buyer') return 'New Buyer';
  if (guestType === 'Non-Owner') return 'Non-Owner';
  return guestType || 'Courtesy';
}

const TOUR_ENRICHMENT_SELECT = `
  SELECT
    tp.tour_id, tp.rep_id, tp.period_id, tp.guest_name, tp.guest_type,
    tp.arrival_date, tp.tour_status, tp.code, tp.payout, tp.fps_eligible, tp.fps_potential, tp.notes,
    tp.guest_id, tp.household_id, tp.lead_source, tp.abc_score, tp.package_type, tp.xref_tour_id,
    tp.tour_booked_date,
    g.email AS guest_email, g.phone_token, g.qualification_code, g.owner_flag,
    hh.hh_size_band, hh.income_band, hh.home_msa,
    pl.location_id AS planned_location_id, pl.location_name AS planned_location_name,
    pl.location_type AS planned_location_type, pl.market AS planned_market, pl.brand AS planned_brand,
    pl.desk_label AS planned_desk_label,
    cs.location_id AS stay_location_id, cs.location_name AS stay_location_name,
    cs.location_type AS stay_location_type, cs.market AS stay_market, cs.brand AS stay_brand,
    cs.desk_label AS stay_desk_label,
    tq.lead_source AS tq_lead_source, tq.abc_score AS tq_abc_score, tq.package_type AS tq_package_type,
    tq.showed_flag, tq.closed_flag, tq.contract_status, tq.rescission_flag,
    tq.net_sales_volume, tq.vpg,
    COALESCE(stay.nights, 0) AS stay_duration_nights,
    COALESCE(hist.prior_tour_count, 0) AS prior_tour_count,
    COALESCE(rent.rental_stay_count, 0) AS rental_stay_count
  FROM workspace.hgv_comp.fact_marketing_tour_payout tp
  LEFT JOIN workspace.hgv_comp.dim_guest g ON g.guest_id = tp.guest_id
  LEFT JOIN workspace.hgv_comp.dim_household hh ON hh.household_id = tp.household_id
  LEFT JOIN workspace.hgv_comp.dim_location pl ON pl.location_id = tp.planned_tour_location_id
  LEFT JOIN workspace.hgv_comp.dim_location cs ON cs.location_id = tp.current_stay_location_id
  LEFT JOIN workspace.hgv_comp.fact_tour_quality tq
    ON tq.tour_id = COALESCE(tp.xref_tour_id, tp.tour_id)
  LEFT JOIN (
    SELECT guest_id, MAX(nights) AS nights
    FROM workspace.hgv_comp.fact_guest_rental_stay
    GROUP BY guest_id
  ) stay ON stay.guest_id = tp.guest_id
  LEFT JOIN (
    SELECT guest_id, COUNT(*) AS prior_tour_count
    FROM workspace.hgv_comp.fact_guest_tour_history
    GROUP BY guest_id
  ) hist ON hist.guest_id = tp.guest_id
  LEFT JOIN (
    SELECT guest_id, COUNT(*) AS rental_stay_count
    FROM workspace.hgv_comp.fact_guest_rental_stay
    GROUP BY guest_id
  ) rent ON rent.guest_id = tp.guest_id
`;

function mapTourEnrichmentRow(row: Record<string, unknown>): MarketingTourEnrichment & Record<string, unknown> {
  const guestType = String(row.guest_type ?? '');
  const ownerFlag = b(row.owner_flag);
  const planned = locationFromRow(row, 'planned');
  const stay = locationFromRow(row, 'stay');
  const quality = qualityFromRow({
    ...row,
    lead_source: row.lead_source ?? row.tq_lead_source,
    abc_score: row.abc_score ?? row.tq_abc_score,
    package_type: row.package_type ?? row.tq_package_type,
  });

  return {
    guest_id: row.guest_id != null ? String(row.guest_id) : undefined,
    household_id: row.household_id != null ? String(row.household_id) : undefined,
    guest_email: row.guest_email != null ? String(row.guest_email) : undefined,
    phone_token: row.phone_token != null ? String(row.phone_token) : undefined,
    qualification_code: row.qualification_code != null ? String(row.qualification_code) : undefined,
    owner_flag: ownerFlag,
    owner_status: ownerStatus(guestType, ownerFlag),
    tour_booked_date: row.tour_booked_date != null ? String(row.tour_booked_date) : undefined,
    lead_source: quality?.lead_source,
    abc_score: quality?.abc_score,
    package_type: quality?.package_type,
    planned_tour_location: planned,
    current_stay_location: stay,
    stay_duration_nights: row.stay_duration_nights != null ? n(row.stay_duration_nights) : undefined,
    demographics: demographicsFromRow(row),
    properties_owned: [],
    quality,
    prior_tour_count: n(row.prior_tour_count),
    rental_stay_count: n(row.rental_stay_count),
    current_property: stay?.location_name,
  };
}

export async function fetchOwnershipByGuestIds(
  runSql: RunSql,
  guestIds: string[],
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (!guestIds.length) return map;
  const inList = guestIds.map((id) => `'${esc(id)}'`).join(', ');
  try {
    const rows = await runSql(`
      SELECT guest_id, property_name
      FROM workspace.hgv_comp.fact_guest_ownership
      WHERE guest_id IN (${inList})
      ORDER BY property_name
    `);
    for (const r of rows) {
      const gid = String(r.guest_id);
      const list = map.get(gid) ?? [];
      list.push(String(r.property_name));
      map.set(gid, list);
    }
  } catch {
    /* guest ownership table may still be seeding */
  }
  return map;
}

export async function fetchOwnershipForGuest(
  runSql: RunSql,
  guestId: string,
): Promise<GuestOwnershipRecord[]> {
  const safeGuest = esc(guestId);
  try {
    const rows = await runSql(`
      SELECT o.ownership_id, o.property_name, o.contract_status, o.points_balance, o.brand,
             l.location_id, l.location_name, l.location_type, l.market, l.brand AS loc_brand, l.desk_label
      FROM workspace.hgv_comp.fact_guest_ownership o
      LEFT JOIN workspace.hgv_comp.dim_location l ON l.location_id = o.location_id
      WHERE o.guest_id = '${safeGuest}'
      ORDER BY o.property_name
    `);
    return rows.map((r) => ({
      ownership_id: String(r.ownership_id),
      property_name: String(r.property_name),
      contract_status: String(r.contract_status),
      points_balance: r.points_balance != null ? n(r.points_balance) : undefined,
      brand: r.brand != null ? String(r.brand) : undefined,
      location: r.location_id
        ? {
            location_id: String(r.location_id),
            location_name: String(r.location_name ?? ''),
            location_type: String(r.location_type ?? ''),
            market: String(r.market ?? ''),
            brand: String(r.loc_brand ?? r.brand ?? ''),
            desk_label: r.desk_label != null ? String(r.desk_label) : undefined,
          }
        : undefined,
    }));
  } catch {
    return [];
  }
}

export async function fetchRentalStaysForGuest(runSql: RunSql, guestId: string): Promise<GuestRentalStay[]> {
  const safeGuest = esc(guestId);
  const rows = await runSql(`
    SELECT s.stay_id, s.stay_type, s.check_in, s.check_out, s.nights,
           l.location_id, l.location_name, l.location_type, l.market, l.brand, l.desk_label
    FROM workspace.hgv_comp.fact_guest_rental_stay s
    JOIN workspace.hgv_comp.dim_location l ON l.location_id = s.location_id
    WHERE s.guest_id = '${safeGuest}'
    ORDER BY s.check_in DESC
  `);
  return rows.map((r) => ({
    stay_id: String(r.stay_id),
    stay_type: String(r.stay_type),
    check_in: String(r.check_in),
    check_out: String(r.check_out),
    nights: n(r.nights),
    location: {
      location_id: String(r.location_id),
      location_name: String(r.location_name),
      location_type: String(r.location_type),
      market: String(r.market),
      brand: String(r.brand),
      desk_label: r.desk_label != null ? String(r.desk_label) : undefined,
    },
  }));
}

export async function fetchTourHistoryForGuest(
  runSql: RunSql,
  guestId: string,
): Promise<GuestTourHistoryEntry[]> {
  const safeGuest = esc(guestId);
  const rows = await runSql(`
    SELECT history_id, tour_id, rep_id, tour_date, tour_status, outcome_summary
    FROM workspace.hgv_comp.fact_guest_tour_history
    WHERE guest_id = '${safeGuest}'
    ORDER BY tour_date DESC
  `);
  return rows.map((r) => ({
    history_id: String(r.history_id),
    tour_id: String(r.tour_id),
    tour_date: String(r.tour_date),
    tour_status: String(r.tour_status),
    outcome_summary: r.outcome_summary != null ? String(r.outcome_summary) : undefined,
    rep_id: r.rep_id != null ? String(r.rep_id) : undefined,
  }));
}

export async function enrichMarketingTours(
  runSql: RunSql,
  repId: string,
  periodId: string,
): Promise<Array<Record<string, unknown>>> {
  const safeRep = esc(repId);
  const safePeriod = esc(periodId);
  const rows = await runSql(`
    ${TOUR_ENRICHMENT_SELECT}
    WHERE tp.rep_id = '${safeRep}' AND tp.period_id = '${safePeriod}'
    ORDER BY tp.arrival_date DESC
  `);

  const guestIds = [
    ...new Set(
      rows.map((row) => (row.guest_id != null ? String(row.guest_id) : '')).filter(Boolean),
    ),
  ];
  const ownershipByGuest = await fetchOwnershipByGuestIds(runSql, guestIds);

  const enriched: Array<Record<string, unknown>> = [];
  for (const row of rows) {
    const base = mapTourEnrichmentRow(row);
    const guestId = base.guest_id;
    const propertiesOwned = guestId ? ownershipByGuest.get(guestId) ?? [] : [];
    enriched.push({
      tour_id: String(row.tour_id),
      guest_name: normalizeDisplayText(String(row.guest_name ?? '')),
      guest_type: String(row.guest_type ?? ''),
      arrival_date: row.arrival_date != null ? String(row.arrival_date) : undefined,
      tour_status: String(row.tour_status ?? ''),
      code: formatTourCode(row.code),
      payout: n(row.payout),
      fps_eligible: b(row.fps_eligible),
      fps_potential: n(row.fps_potential),
      notes: row.notes != null ? normalizeDisplayText(String(row.notes)) : row.notes,
      ...base,
      properties_owned: propertiesOwned,
      current_property: base.current_stay_location?.location_name ?? base.current_property,
    });
  }
  return enriched;
}

export async function buildMarketingTourContext(
  runSql: RunSql,
  tourId: string,
  repId?: string,
  periodId?: string,
): Promise<MarketingTourContextPayload | null> {
  const safeTour = esc(tourId);
  const repFilter = repId ? `AND tp.rep_id = '${esc(repId)}'` : '';
  const periodFilter = periodId ? `AND tp.period_id = '${esc(periodId)}'` : '';

  const rows = await runSql(`
    ${TOUR_ENRICHMENT_SELECT}
    WHERE tp.tour_id = '${safeTour}' ${repFilter} ${periodFilter}
    LIMIT 1
  `);
  if (!rows.length) return null;

  const row = rows[0];
  const enrichment = mapTourEnrichmentRow(row);
  const guestId = enrichment.guest_id;
  const safeRep = String(row.rep_id ?? '');
  const safePeriod = String(row.period_id ?? '');

  const [ownership, rentalStays, tourHistory, cbRows] = await Promise.all([
    guestId ? fetchOwnershipForGuest(runSql, guestId) : Promise.resolve([]),
    guestId ? fetchRentalStaysForGuest(runSql, guestId) : Promise.resolve([]),
    guestId ? fetchTourHistoryForGuest(runSql, guestId) : Promise.resolve([]),
    runSql(`
      SELECT chargeback_id, premium_gift, chargeback_amount, notes
      FROM workspace.hgv_comp.fact_marketing_chargeback
      WHERE tour_id = '${safeTour}' AND rep_id = '${esc(safeRep)}'
    `),
  ]);

  return {
    tour_id: String(row.tour_id),
    rep_id: safeRep,
    period_id: safePeriod,
    guest_name: normalizeDisplayText(String(row.guest_name ?? '')),
    guest_type: String(row.guest_type ?? ''),
    arrival_date: row.arrival_date != null ? String(row.arrival_date) : undefined,
    tour_status: String(row.tour_status ?? ''),
    code: formatTourCode(row.code),
    payout: n(row.payout),
    fps_eligible: b(row.fps_eligible),
    fps_potential: n(row.fps_potential),
    notes: row.notes != null ? normalizeDisplayText(String(row.notes)) : undefined,
    ...enrichment,
    properties_owned: ownership.map((o) => o.property_name),
    current_property: enrichment.current_stay_location?.location_name,
    ownership,
    rental_stays: rentalStays,
    tour_history: tourHistory,
    chargebacks: cbRows.map((cb) => ({
      chargeback_id: String(cb.chargeback_id),
      premium_gift: String(cb.premium_gift ?? ''),
      chargeback_amount: n(cb.chargeback_amount),
      notes: cb.notes != null ? String(cb.notes) : undefined,
    })),
  };
}
