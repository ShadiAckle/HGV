export function formatCurrency(value: number | string | undefined | null): string {
  const n = Number(value ?? 0);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatPercent(value: number | string | undefined | null): string {
  const n = Number(value ?? 0);
  return `${n.toFixed(n % 1 === 0 ? 0 : 1)}%`;
}

export function formatCompactCurrency(value: number | string | undefined | null): string {
  const n = Number(value ?? 0);
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return formatCurrency(n);
}

/** Turn raw AppKit/SQL errors into something actionable for users. */
export function formatQueryError(message: string | null | undefined): string {
  if (!message) return 'Unable to load data. Please try again.';
  const lower = message.toLowerCase();
  if (lower.includes('aborted') || lower.includes('timed out') || lower.includes('timeout')) {
    return 'The SQL warehouse is still starting or the query timed out. Wait a few seconds and refresh this page.';
  }
  if (lower.includes('insufficient') || lower.includes('permission')) {
    return 'You do not have access to the comp data in Unity Catalog. Contact your workspace admin.';
  }
  if (lower.includes('model-serving') || lower.includes('oauth')) {
    return 'The AI agent needs additional permissions. Close the app, reopen it, and approve the requested scopes.';
  }
  return message;
}
