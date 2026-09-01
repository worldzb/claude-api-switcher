import { describe, expect, it } from 'vitest';

import { createIntegrationManifest } from '../src/integrations/integration-transfer.js';
import type { IntegrationItem } from '../src/agents/types.js';

describe('集成迁移清单', () => {
  it('只保存可迁移的描述，不泄漏 MCP 密钥', () => {
    const item: IntegrationItem = { agent: 'claude', kind: 'mcp', name: 'github', scope: 'user', location: '/home/.claude.json', removable: true };
    const manifest = createIntegrationManifest([item], 'claude', 'codex');

    expect(manifest).toEqual({
      version: 1,
      sourceAgent: 'claude',
      targetAgent: 'codex',
      integrations: [{ kind: 'mcp', name: 'github', scope: 'user' }],
    });
    expect(JSON.stringify(manifest)).not.toContain('/home/.claude.json');
  });
});
