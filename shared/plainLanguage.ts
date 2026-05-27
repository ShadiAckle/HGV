/**
 * Plain English / Field Mode — simple surface language for frontline reps.
 * Backend data and logic stay the same; labels and AI phrasing simplify.
 */

export const PLAIN_ENGLISH_STORAGE_KEY = 'hgv_plain_english_mode';

/** LLM instruction block appended to every insight/copilot prompt when field mode is on. */
export const PLAIN_ENGLISH_LLM_BLOCK = `
PLAIN ENGLISH FIELD MODE (CRITICAL — overrides default tone):
- Write for a timeshare salesperson who may not have a finance or college background.
- Use short sentences. Aim for about 8th-grade reading level.
- Say "you" and "your" when talking to a rep. Say "the team" for managers.
- Replace jargon on first use: NSV = money from sales, VPG = sales per guest, quota = sales goal, attainment = progress toward goal, SPIFF = bonus, chargeback = money taken back, proration = partial pay for partial time, accrual = money set aside, FFS = vacation club product, FPS = vacation package, TCC = total pay, penetration = how many guests bought, rescission = buyer cancelled.
- Prefer: "your paycheck", "sales goal", "bonus", "money held back", "deal", "guest", "tour".
- Keep EVERY number, date, dollar amount, ID, and percentage EXACTLY as in context.
- Do not remove facts — explain them simply.
- For charts/visuals: describe in plain words (e.g. "the green bar means you're ahead of goal").
- No bullet walls — 2–4 short bullets or 2–3 short paragraphs max.
`.trim();

/** Exact label replacements (case-sensitive keys). */
const EXACT_LABELS: Record<string, string> = {
  'Quota Attainment': 'Progress Toward Your Sales Goal',
  'Quota attainment': 'Progress toward your sales goal',
  'QTD Earnings': 'Money Earned This Quarter',
  'Total Incentive Cost': 'Total Bonus & Commission Spend',
  'Total Earnings': 'Total Pay',
  'Var Comp % of NSV': 'Bonus Pay as % of Sales',
  'Open Reserve Liability': 'Money Held Back',
  'Accrual to Book': 'Pay to Record in Books',
  'Cost Analysis': 'Pay Cost Breakdown',
  'SPIFF / ROI': 'Bonus Payback',
  'Accruals': 'Pay Set Aside',
  'Base Pay': 'Base Salary',
  'Commission': 'Sales Commission',
  'Bonus': 'Bonus Pay',
  'Volume Bonus': 'Extra Pay for Hitting Goal',
  'Next Rate Booster': 'Next Pay Bump Level',
  'Next Tier': 'Next Pay Level',
  'Net Payable': 'Take-Home Pay',
  'Team NSV': 'Team Sales Dollars',
  'Team Attainment': 'Team Goal Progress',
  'FFS Mix': 'Vacation Club Sales Share',
  'FFS Sales Rate': 'Vacation Club Sales %',
  'At-Risk Reps': 'Reps Behind on Goal',
  'Top Performers': 'Reps Beating Goal',
  'Variable Comp': 'Bonus & Commission Pay',
  'Cost of Sales': 'Pay as % of Sales',
  'VPG': 'Sales Per Guest',
  'SPIFF ROI': 'Bonus Payback',
  'Lead Funnel Yield': 'Guest Quality Results',
  'Tour Quality': 'Tour Results',
  'Pay Mix': 'Base vs Bonus Split',
  'TCC Gap': 'Pay vs Market',
  'Proration': 'Partial-Period Pay',
  'Chargeback': 'Money Clawed Back',
  'Reserve Liability': 'Money Held Back',
  'Payroll Lock': 'Paycheck Final Date',
  'Plan Eligibility': 'Who Qualifies for the Plan',
  'Attainment Distribution': 'How the Team Is Spread on Goal',
  'Qualified Tours': 'Good Tours That Count',
  'Show Rate': 'Guests Who Showed Up %',
  'Penetration': 'Guests Who Bought %',
  'AI Insights': 'Simple Summary',
  'Attribution': 'Where Credit Came From',
};

/** Phrase replacements applied inside longer strings (order matters — longer first). */
const PHRASE_REPLACEMENTS: Array<[RegExp, string]> = [
  [/Net Sales Volume/gi, 'sales dollars'],
  [/quota attainment/gi, 'progress toward your sales goal'],
  [/attainment pct/gi, 'goal progress'],
  [/attainment/gi, 'goal progress'],
  [/chargebacks?/gi, 'money clawed back'],
  [/rescission/gi, 'buyer cancelled'],
  [/proration/gi, 'partial-period pay'],
  [/accrual/gi, 'money set aside'],
  [/Variable comp/gi, 'bonus and commission pay'],
  [/Unity Catalog/gi, 'company data warehouse'],
  [/semantic layer/gi, 'official data definitions'],
];

export function isPlainEnglishEnabled(value: unknown): boolean {
  if (value === true || value === 'true' || value === 1 || value === '1') return true;
  return false;
}

/** Map a UI label or short phrase to plain English when field mode is on. */
export function toPlainLabel(text: string, enabled: boolean): string {
  if (!enabled || !text?.trim()) return text;
  if (EXACT_LABELS[text]) return EXACT_LABELS[text];
  let out = text;
  for (const [pattern, replacement] of PHRASE_REPLACEMENTS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

/** Panel / section titles in plain English. */
export function plainPanelCopy(
  enabled: boolean,
  standard: { title: string; subtitle: string },
  plain: { title: string; subtitle: string },
): { title: string; subtitle: string } {
  return enabled ? plain : standard;
}

export function finalizeLlmPrompt(
  prompt: string,
  opts?: { refreshKey?: string; plainEnglish?: boolean },
): string {
  const pass = opts?.refreshKey?.trim() || cryptoRandomId();
  const parts = [prompt];
  if (opts?.plainEnglish) {
    parts.push('', PLAIN_ENGLISH_LLM_BLOCK);
  }
  parts.push(
    '',
    `Generation pass ${pass}: keep every number and fact identical to context, but write fresh headlines, badges, and sentence openers — do not reuse phrasing from typical template copy.`,
  );
  return parts.join('\n');
}

function cryptoRandomId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `pass-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Simpler chart palette when field mode is on. */
export function chartColors(enabled: boolean): { primary: string; muted: string; grid: string } {
  if (enabled) {
    return { primary: '#22C55E', muted: '#94A3B8', grid: 'rgba(148,163,184,0.12)' };
  }
  return { primary: '#0EA5E9', muted: '#64748B', grid: 'rgba(100,116,139,0.2)' };
}

export function chartLabelFontSize(enabled: boolean): number {
  return enabled ? 12 : 10;
}
