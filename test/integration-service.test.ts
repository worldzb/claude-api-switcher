import { describe, expect, it } from 'vitest';

import { filterIntegrations, integrationKey, normalizeIntegration } from '../src/integrations/integration-service.js';
import type { IntegrationItem } from '../src/agents/types.js';

const items: readonly IntegrationItem[] = [
  { agent: 'claude', kind: 'mcp', name: 'github', scope: 'user', location: '/home/.claude.json', removable: true },
  { agent: 'codex', kind: 'skill', name: 'review', scope: 'project', location: '/project/.codex/skills/review', removable: true },
  { agent: 'opencode', kind: 'plugin', name: 'lint', scope: 'user', location: '/home/.config/opencode/plugins/lint', removable: true },
];

describe('集成资源服务', () => {
  it('生成稳定的跨 Agent 资源键', () => {
    expect(integrationKey(items[0]!)).toBe('claude:mcp:user:github');
  });

  it('按 Agent、类型和范围筛选资源', () => {
    expect(filterIntegrations(items, { agent: 'codex', kind: 'skill' })).toEqual([items[1]]);
    expect(filterIntegrations(items, { scope: 'user' })).toEqual([items[0], items[2]]);
  });

  it('规范化资源名称和位置', () => {
    expect(normalizeIntegration({ ...items[0]!, name: ' github ', location: ' /tmp/config ' })).toEqual({ ...items[0]!, name: 'github', location: '/tmp/config' });
  });
});
