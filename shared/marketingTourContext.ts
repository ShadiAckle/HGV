/** Governed guest context for marketing tour registry & Intervene drawer (comp-relevant only). */

export interface GuestLocationSummary {
  location_id: string;
  location_name: string;
  location_type: string;
  market: string;
  brand: string;
  desk_label?: string;
}

export interface GuestDemographics {
  household_id: string;
  hh_size_band: string;
  income_band: string;
  home_msa?: string;
}

export interface GuestOwnershipRecord {
  ownership_id: string;
  property_name: string;
  contract_status: string;
  points_balance?: number;
  brand?: string;
  location?: GuestLocationSummary;
}

export interface GuestRentalStay {
  stay_id: string;
  stay_type: string;
  check_in: string;
  check_out: string;
  nights: number;
  location: GuestLocationSummary;
}

export interface GuestTourHistoryEntry {
  history_id: string;
  tour_id: string;
  tour_date: string;
  tour_status: string;
  outcome_summary?: string;
  rep_id?: string;
}

export interface TourQualityOutcome {
  lead_source: string;
  abc_score: string;
  package_type: string;
  showed_flag: boolean;
  closed_flag: boolean;
  contract_status: string;
  rescission_flag: boolean;
  net_sales_volume: number;
  vpg: number;
}

/** Summary fields embedded in workspace tour rows. */
export interface MarketingTourEnrichment {
  guest_id?: string;
  household_id?: string;
  guest_email?: string;
  phone_token?: string;
  qualification_code?: string;
  owner_flag?: boolean;
  owner_status?: string;
  tour_booked_date?: string;
  lead_source?: string;
  abc_score?: string;
  package_type?: string;
  planned_tour_location?: GuestLocationSummary;
  current_stay_location?: GuestLocationSummary;
  stay_duration_nights?: number;
  demographics?: GuestDemographics;
  properties_owned?: string[];
  quality?: TourQualityOutcome;
  prior_tour_count?: number;
  rental_stay_count?: number;
}

/** Full guest 360 for Intervene drawer — loaded per tour. */
export interface MarketingTourContextPayload extends MarketingTourEnrichment {
  tour_id: string;
  rep_id: string;
  period_id: string;
  guest_name: string;
  guest_type: string;
  arrival_date?: string;
  tour_status: string;
  code: string;
  payout: number;
  fps_eligible: boolean;
  fps_potential: number;
  notes?: string;
  current_property?: string;
  ownership: GuestOwnershipRecord[];
  rental_stays: GuestRentalStay[];
  tour_history: GuestTourHistoryEntry[];
  chargebacks: Array<{
    chargeback_id: string;
    premium_gift: string;
    chargeback_amount: number;
    notes?: string;
  }>;
}
