import { normalizeDisplayText } from '@shared/normalizeText';

/** Normalize tier labels from warehouse (fixes mojibake em/en dashes). */
export const normalizeTierText = normalizeDisplayText;

export function formatNextTierDisplay(rawLabel: string): { headline: string; detail: string } {
  const label = normalizeTierText(rawLabel);
  const match = label.match(/^Tier\s+(\d+)\s*-\s*(.+)$/i);
  if (match) {
    return {
      headline: `Tier ${match[1]}`,
      detail: match[2],
    };
  }
  return { headline: label, detail: '' };
}
