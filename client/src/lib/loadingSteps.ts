export type LoadingStepStatus = 'pending' | 'active' | 'done' | 'error';

export interface LoadingStep {
  id: string;
  label: string;
  status: LoadingStepStatus;
}

export function initLoadingSteps(defs: { id: string; label: string }[]): LoadingStep[] {
  return defs.map((d) => ({ ...d, status: 'pending' as const }));
}

export function patchLoadingStep(
  steps: LoadingStep[],
  id: string,
  status: LoadingStepStatus,
): LoadingStep[] {
  return steps.map((s) => (s.id === id ? { ...s, status } : s));
}

/** Map parallel/sequential fetch flags to step statuses for display. */
export function deriveLoadingSteps(
  defs: { id: string; label: string; loading: boolean; done: boolean; error?: boolean }[],
): LoadingStep[] {
  return defs.map((d) => ({
    id: d.id,
    label: d.label,
    status: d.error ? 'error' : d.loading ? 'active' : d.done ? 'done' : 'pending',
  }));
}

export function anyLoading(steps: LoadingStep[]): boolean {
  return steps.some((s) => s.status === 'active' || s.status === 'pending');
}

export async function runLoadingStep<T>(
  steps: LoadingStep[],
  id: string,
  setSteps: (steps: LoadingStep[]) => void,
  fn: () => Promise<T>,
): Promise<T> {
  setSteps(patchLoadingStep(steps, id, 'active'));
  try {
    const result = await fn();
    setSteps(patchLoadingStep(steps, id, 'done'));
    return result;
  } catch (err) {
    setSteps(patchLoadingStep(steps, id, 'error'));
    throw err;
  }
}
