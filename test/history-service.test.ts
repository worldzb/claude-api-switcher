import { describe, expect, it } from 'vitest';

import { createSessionId, pageSessions } from '../src/history/session-service.js';
import type { SessionSummary } from '../src/agents/types.js';

const sessions: readonly SessionSummary[] = [
  { agent: 'claude', id: 'a', title: 'Claude', cwd: '/work/a', updatedAt: '2026-08-31T10:00:00.000Z', sourcePath: '/a' },
  { agent: 'codex', id: 'b', title: 'Codex', cwd: '/work/b', updatedAt: '2026-08-31T12:00:00.000Z', sourcePath: '/b' },
  { agent: 'opencode', id: 'c', title: 'OpenCode', cwd: '/work/c', updatedAt: '2026-08-31T11:00:00.000Z', sourcePath: '/c' },
];

describe('统一会话分页', () => {
  it('按更新时间倒序并生成稳定分页', () => {
    const page = pageSessions(sessions, { page: 1, pageSize: 2 });

    expect(page.items.map((session) => session.id)).toEqual(['b', 'c']);
    expect(page.total).toBe(3);
    expect(page.totalPages).toBe(2);
  });

  it('可以按 agent 过滤', () => {
    const page = pageSessions(sessions, { page: 1, pageSize: 20, agent: 'claude' });

    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.id).toBe('a');
  });

  it('使用 Agent 和原始 ID 构建统一 ID', () => {
    expect(createSessionId({ ...sessions[0]!, id: 'abc:def' })).toBe('claude:abc%3Adef');
  });
});
