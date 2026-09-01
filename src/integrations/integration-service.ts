import type { AgentId, IntegrationItem } from '../agents/types.js';

export interface IntegrationFilter {
  readonly agent?: AgentId;
  readonly kind?: IntegrationItem['kind'];
  readonly scope?: IntegrationItem['scope'];
}

export function normalizeIntegration(item: IntegrationItem): IntegrationItem {
  return { ...item, name: item.name.trim(), location: item.location.trim() };
}

export function integrationKey(item: IntegrationItem): string {
  const normalized = normalizeIntegration(item);
  return `${normalized.agent}:${normalized.kind}:${normalized.scope}:${normalized.name}`;
}

export function filterIntegrations(
  items: readonly IntegrationItem[],
  filter: IntegrationFilter,
): readonly IntegrationItem[] {
  return items.filter((item) =>
    (!filter.agent || item.agent === filter.agent)
    && (!filter.kind || item.kind === filter.kind)
    && (!filter.scope || item.scope === filter.scope));
}
