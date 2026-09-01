import { describe, expect, it } from 'vitest';

import { filterIntegrations } from '../src/integrations/integration-service.js';
import type { IntegrationItem } from '../src/agents/types.js';

const items: readonly IntegrationItem[] = [
  { agent: 'claude', kind: 'skill', name: 'global-skill', scope: 'user', location: '/home/.claude/skills/global-skill', removable: true },
  { agent: 'claude', kind: 'skill', name: 'project-skill', scope: 'project', location: '/work/project/.claude/skills/project-skill', removable: true },
  { agent: 'codex', kind: 'mcp', name: 'project-mcp', scope: 'project', location: '/work/project/.mcp.json', removable: true },
];

describe('资源范围', () => {
  it('可以独立筛选全局和当前项目资源', () => {
    expect(filterIntegrations(items, { kind: 'skill', scope: 'project' })).toEqual([items[1]]);
    expect(filterIntegrations(items, { kind: 'skill', scope: 'user' })).toEqual([items[0]]);
  });
});
