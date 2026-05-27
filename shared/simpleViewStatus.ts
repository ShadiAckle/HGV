/** Traffic-light status for Simple View goal progress. */
export type TrafficStatus = 'good' | 'watch' | 'alert';

export function attainmentStatus(pct: number): TrafficStatus {
  if (pct >= 100) return 'good';
  if (pct >= 75) return 'watch';
  return 'alert';
}

export function penetrationStatus(actual: number, target: number): TrafficStatus {
  if (target <= 0) return attainmentStatus(actual);
  const ratio = (actual / target) * 100;
  return attainmentStatus(ratio);
}

export const TRAFFIC_LABELS: Record<TrafficStatus, string> = {
  good: 'On track',
  watch: 'Getting close',
  alert: 'Needs attention',
};

export const TRAFFIC_COLORS: Record<TrafficStatus, { bg: string; text: string; bar: string }> = {
  good: { bg: 'rgba(34,197,94,0.15)', text: '#16A34A', bar: '#22C55E' },
  watch: { bg: 'rgba(245,158,11,0.15)', text: '#D97706', bar: '#F59E0B' },
  alert: { bg: 'rgba(239,68,68,0.12)', text: '#DC2626', bar: '#EF4444' },
};
