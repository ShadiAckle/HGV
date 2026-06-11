/** @deprecated Use warehouse-backed guest registry via marketingTourContext. Fallback when joins fail. */
export interface MarketingGuestProfile {
  guest_name: string;
  guest_email: string;
  owner_status: 'Owner' | 'Non-Owner' | 'New Buyer' | 'Courtesy';
  properties_owned: string[];
  current_property: string;
  stay_duration_nights: number;
  tour_booked_date: string;
}

export const MARKETING_GUEST_PROFILES: Record<string, MarketingGuestProfile> = {
  'T-55122': {
    guest_name: 'Bruce Wayne',
    guest_email: 'bruce.wayne@example.com',
    owner_status: 'New Buyer',
    properties_owned: [],
    current_property: 'Hilton Grand Vacations Club — Las Vegas Strip',
    stay_duration_nights: 4,
    tour_booked_date: '2026-05-08',
  },
  'T-55204': {
    guest_name: 'Peter Parker',
    guest_email: 'peter.parker@example.com',
    owner_status: 'Non-Owner',
    properties_owned: [],
    current_property: 'Elara by Hilton Grand Vacations',
    stay_duration_nights: 3,
    tour_booked_date: '2026-05-13',
  },
  'T-55180': {
    guest_name: 'Clark Kent',
    guest_email: 'clark.kent@example.com',
    owner_status: 'Owner',
    properties_owned: ['Orlando Collection — West 57th'],
    current_property: 'Las Vegas Strip South Desk',
    stay_duration_nights: 5,
    tour_booked_date: '2026-05-10',
  },
};

export function guestProfileForTour(tourId: string, guestName: string, guestType: string): MarketingGuestProfile {
  const keyed = MARKETING_GUEST_PROFILES[tourId];
  if (keyed) return keyed;
  const isOwner = guestType === 'Owner';
  return {
    guest_name: guestName,
    guest_email: '',
    owner_status: isOwner ? 'Owner' : guestType === 'New Buyer' ? 'New Buyer' : guestType === 'Non-Owner' ? 'Non-Owner' : 'Courtesy',
    properties_owned: isOwner ? ['HGV club portfolio (on file)'] : [],
    current_property: 'On property — desk assignment',
    stay_duration_nights: 3,
    tour_booked_date: '—',
  };
}
