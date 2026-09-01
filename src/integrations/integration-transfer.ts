import type { AgentId, IntegrationItem } from '../agents/types.js';

export interface IntegrationManifestItem {
  readonly kind: IntegrationItem['kind'];
  readonly name: string;
  readonly scope: IntegrationItem['scope'];
}

export interface IntegrationManifest {
  readonly version: 1;
  readonly sourceAgent: AgentId;
  readonly targetAgent: AgentId;
  readonly integrations: readonly IntegrationManifestItem[];
}

export function createIntegrationManifest(
  items: readonly IntegrationItem[],
  sourceAgent: AgentId,
  targetAgent: AgentId,
): IntegrationManifest {
  return {
    version: 1,
    sourceAgent,
    targetAgent,
    integrations: items
      .filter((item) => item.agent === sourceAgent)
      .map((item) => ({ kind: item.kind, name: item.name.trim(), scope: item.scope })),
  };
}
