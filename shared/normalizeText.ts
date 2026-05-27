/** Normalize mojibake and fancy Unicode dashes for display (UTF-8 read as Latin-1). */
export function normalizeDisplayText(text: string): string {
  if (!text) return text;

  // UTF-8 punctuation misread as Latin-1/CP1252 (e.g. en-dash E2 80 93 -> â + \u0080 + \u201C or â + € + ")
  const mojibakeDash = /\u00E2(?:\u0080|\u20AC)[\u0080-\u00BF\u201C\u201D\u0022\u0094]?/g;

  return text
    .replace(
      /([A-Za-z0-9%$~])\u00E2(?:\u0080|\u20AC)[\u0080-\u00BF\u201C\u201D\u0022\u0094]?([A-Za-z0-9%$~(])/g,
      '$1-$2',
    )
    .replace(mojibakeDash, '-')
    .replace(/â€™/g, "'")
    .replace(/â€œ/g, '"')
    .replace(/â€[\u009D\u201D]/g, '"')
    .replace(/[\u2013\u2014\u2212\uFE58\uFE63\uFF0D]/g, '-')
    // orphan quotes after a hyphen in numeric / currency ranges (partial mojibake residue)
    .replace(/([-–—])[\u201C\u201D\u0022\u201E\u201F]+(?=[\d$~%(])/g, '$1')
    .replace(/\uFFFD/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Tour qualification code — normalizes mojibake; blank/dash placeholders render as em dash. */
export function formatTourCode(raw: unknown): string {
  const text = normalizeDisplayText(String(raw ?? ''));
  if (!text || /^[-–—\u2013\u2014]+$/.test(text)) return '—';
  return text;
}
