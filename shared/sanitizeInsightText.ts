/** Strip prompt scaffolding labels (e.g. "**Pay mix headline**:") from LLM insight output. */
const HEADLINE_LABEL =
  /^\s*(?:[-•*]\s+)?(?:\*\*)?(?:[\w\s]*\bheadline\b|\bHeadline\b)(?:\*\*)?\s*:\s*/i;

export function sanitizeInsightText(text: string): string {
  return text
    .split('\n')
    .map((line) => line.replace(HEADLINE_LABEL, '').trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
