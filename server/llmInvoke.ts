import { randomUUID } from 'node:crypto';
import { getWorkspaceClient } from '@databricks/appkit';
import { finalizeLlmPrompt, isPlainEnglishEnabled } from '../shared/plainLanguage.js';

export const PRIMARY_SERVING_ENDPOINT =
  process.env.DATABRICKS_SERVING_ENDPOINT_NAME ?? 'databricks-claude-sonnet-4-6';
export const FALLBACK_SERVING_ENDPOINT = 'databricks-meta-llama-3-3-70b-instruct';

export function allowLlmFallback(): boolean {
  return process.env.LLM_ALLOW_FALLBACK !== 'false';
}

export interface AiGenerationMeta {
  generated_at: string;
  serving_endpoint: string;
  generation_pass: string;
}

type AppKitServing = {
  serving: () => { invoke: (body: Record<string, unknown>) => Promise<unknown> };
};

let wsClient: ReturnType<typeof getWorkspaceClient> | null = null;

function isMissingEndpointError(message: string): boolean {
  return message.includes('does not exist') || message.includes('not found');
}

async function queryFallbackEndpoint(body: Record<string, unknown>): Promise<unknown> {
  if (!wsClient) wsClient = getWorkspaceClient({});
  return wsClient.servingEndpoints.query({
    name: FALLBACK_SERVING_ENDPOINT,
    ...body,
  } as never);
}

export { isPlainEnglishEnabled };

/** Append a unique pass id so repeated refreshes with identical data still vary phrasing. */
export function appendGenerationVariation(
  prompt: string,
  refreshKey?: string,
  plainEnglish?: boolean,
): string {
  return finalizeLlmPrompt(prompt, {
    refreshKey: refreshKey?.trim() || randomUUID(),
    plainEnglish: plainEnglish === true,
  });
}

export function buildGenerationMeta(endpoint: string, refreshKey?: string): AiGenerationMeta {
  return {
    generated_at: new Date().toISOString(),
    serving_endpoint: endpoint,
    generation_pass: refreshKey?.trim() || randomUUID(),
  };
}

export async function invokeServingModelDetailed(
  appkit: AppKitServing,
  body: Record<string, unknown>,
): Promise<{ payload: unknown; endpoint: string }> {
  try {
    const result = await appkit.serving().invoke(body);
    if (result && typeof result === 'object' && 'ok' in result) {
      const exec = result as { ok: boolean; data?: unknown; message?: string; status?: number };
      if (!exec.ok) {
        const errMsg = String(exec.message ?? '');
        if (allowLlmFallback() && (isMissingEndpointError(errMsg) || exec.status === 404)) {
          console.warn(
            `[LLM] Primary endpoint "${PRIMARY_SERVING_ENDPOINT}" unavailable — falling back to ${FALLBACK_SERVING_ENDPOINT}`,
          );
          const payload = await queryFallbackEndpoint(body);
          return { payload, endpoint: FALLBACK_SERVING_ENDPOINT };
        }
        throw new Error(errMsg || 'Model invocation failed');
      }
      return { payload: exec.data, endpoint: PRIMARY_SERVING_ENDPOINT };
    }
    return { payload: result, endpoint: PRIMARY_SERVING_ENDPOINT };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    if (allowLlmFallback() && isMissingEndpointError(errMsg)) {
      console.warn(
        `[LLM] Primary endpoint "${PRIMARY_SERVING_ENDPOINT}" unavailable — falling back to ${FALLBACK_SERVING_ENDPOINT}`,
      );
      const payload = await queryFallbackEndpoint(body);
      return { payload, endpoint: FALLBACK_SERVING_ENDPOINT };
    }
    throw err;
  }
}
