import { getWorkspaceClient } from '@databricks/appkit';
import {
  FALLBACK_SERVING_ENDPOINT,
  PRIMARY_SERVING_ENDPOINT,
} from './llmInvoke.js';

export interface ModelServingInfo {
  configured_endpoint: string;
  foundation_model: string | null;
  display_name: string | null;
  ready: boolean | null;
  fallback_endpoint: string;
  allow_fallback: boolean;
  is_sonnet_family: boolean;
  is_fallback_model: boolean;
}

let wsClient: ReturnType<typeof getWorkspaceClient> | null = null;

function getClient() {
  if (!wsClient) wsClient = getWorkspaceClient({});
  return wsClient;
}

export function isSonnetEndpoint(name: string): boolean {
  return /claude-sonnet/i.test(name);
}

export function allowLlmFallback(): boolean {
  return process.env.LLM_ALLOW_FALLBACK !== 'false';
}

/** Resolve configured serving endpoint + foundation model metadata from the workspace. */
export async function getModelServingInfo(): Promise<ModelServingInfo> {
  const configured = PRIMARY_SERVING_ENDPOINT;
  try {
    const ep = await getClient().servingEndpoints.get({ name: configured });
    const entity = (ep as { config?: { served_entities?: Array<Record<string, unknown>> } }).config
      ?.served_entities?.[0];
    const foundation = entity?.foundation_model as
      | { name?: string; display_name?: string }
      | undefined;
    const entityName = entity?.entity_name != null ? String(entity.entity_name) : null;
    const foundationModel = foundation?.name ?? entityName;
    const displayName = foundation?.display_name ?? null;
    const readyRaw = (ep as { state?: { ready?: string } }).state?.ready;
    return {
      configured_endpoint: configured,
      foundation_model: foundationModel,
      display_name: displayName,
      ready: readyRaw === 'READY',
      fallback_endpoint: FALLBACK_SERVING_ENDPOINT,
      allow_fallback: allowLlmFallback(),
      is_sonnet_family: isSonnetEndpoint(configured) || isSonnetEndpoint(foundationModel ?? ''),
      is_fallback_model: false,
    };
  } catch {
    return {
      configured_endpoint: configured,
      foundation_model: null,
      display_name: null,
      ready: null,
      fallback_endpoint: FALLBACK_SERVING_ENDPOINT,
      allow_fallback: allowLlmFallback(),
      is_sonnet_family: isSonnetEndpoint(configured),
      is_fallback_model: false,
    };
  }
}

export function modelInfoFromEndpoint(endpoint: string): Pick<
  ModelServingInfo,
  'configured_endpoint' | 'is_sonnet_family' | 'is_fallback_model'
> {
  const isFallback = endpoint === FALLBACK_SERVING_ENDPOINT;
  return {
    configured_endpoint: endpoint,
    is_sonnet_family: isSonnetEndpoint(endpoint),
    is_fallback_model: isFallback,
  };
}
