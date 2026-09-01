import { describe, expect, it } from 'vitest';

import { resourceActions } from '../src/integrations/ui/resource-app.js';
import type { IntegrationItem } from '../src/agents/types.js';

describe('资源操作菜单', () => {
  it('为已禁用的 Claude Plugin 提供复制、卸载和启用', () => {
    const item: IntegrationItem = {
      agent: 'claude',
      kind: 'plugin',
      name: 'review@marketplace',
      scope: 'user',
      location: '/home/.claude/plugins',
      removable: true,
      enabled: false,
    };

    expect(resourceActions(item)).toEqual(['copy', 'remove', 'enable']);
  });

  it('只为原生支持的资源显示启用和禁用操作', () => {
    const skill: IntegrationItem = {
      agent: 'codex',
      kind: 'skill',
      name: 'review',
      scope: 'project',
      location: '/project/.codex/skills/review',
      removable: true,
    };
    const mcp: IntegrationItem = {
      agent: 'opencode',
      kind: 'mcp',
      name: 'github',
      scope: 'user',
      location: '/home/.config/opencode/opencode.json',
      removable: false,
    };

    expect(resourceActions(skill)).toEqual(['copy', 'remove']);
    expect(resourceActions(mcp)).toEqual(['copy']);
  });
});
