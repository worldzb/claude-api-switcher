import { describe, expect, it } from 'vitest';

import type { SessionSummary } from '../src/agents/types.js';
import { deleteSessions } from '../src/commands/history.js';
import type { CommandContext } from '../src/commands/context.js';

const sessions: readonly SessionSummary[] = [
  { agent: 'claude', id: 'one', title: 'One', cwd: '/project', updatedAt: '2026-09-02T00:00:00.000Z', sourcePath: '/one.jsonl' },
  { agent: 'codex', id: 'two', title: 'Two', cwd: '/project', updatedAt: '2026-09-02T00:00:00.000Z', sourcePath: '/two.jsonl' },
  { agent: 'opencode', id: 'three', title: 'Three', cwd: '/project', updatedAt: '2026-09-02T00:00:00.000Z', sourcePath: 'three' },
];

function contextWithDelete(deleteSession: (session: SessionSummary) => void): Pick<CommandContext, 'agents'> {
  return {
    agents: {
      get: () => ({ deleteSession }),
    },
  } as unknown as Pick<CommandContext, 'agents'>;
}

describe('history batch deletion', () => {
  it('deletes every selected session', async () => {
    const deleted: string[] = [];

    await expect(deleteSessions(contextWithDelete((session) => deleted.push(session.id)), sessions))
      .resolves.toEqual({ message: '已删除 3 个会话。' });
    expect(deleted).toEqual(['one', 'two', 'three']);
  });

  it('continues after a failed deletion and reports the partial result', async () => {
    const deleted: string[] = [];

    await expect(deleteSessions(contextWithDelete((session) => {
      if (session.id === 'two') throw new Error('permission denied');
      deleted.push(session.id);
    }), sessions)).rejects.toThrow('已删除 2/3 个会话；codex:two（permission denied）');
    expect(deleted).toEqual(['one', 'three']);
  });
});
