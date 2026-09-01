import { describe, expect, it } from 'vitest';

import { searchSessions } from '../src/history/session-service.js';
import type { SessionSummary } from '../src/agents/types.js';

const sessions: readonly SessionSummary[] = [
  { agent: 'claude', id: 'a', title: '修复登录页', cwd: '/work/site', updatedAt: '2026-08-31T10:00:00.000Z', sourcePath: '/a' },
  { agent: 'codex', id: 'b', title: '优化构建', cwd: '/work/admin', updatedAt: '2026-08-31T12:00:00.000Z', sourcePath: '/b' },
];

describe('历史会话搜索', () => {
  it('按标题、目录、Agent 和会话 ID 忽略大小写搜索', () => {
    expect(searchSessions(sessions, '登录').map((session) => session.id)).toEqual(['a']);
    expect(searchSessions(sessions, 'ADMIN').map((session) => session.id)).toEqual(['b']);
    expect(searchSessions(sessions, 'claude').map((session) => session.id)).toEqual(['a']);
    expect(searchSessions(sessions, 'b').map((session) => session.id)).toEqual(['b']);
  });

  it('空查询保留全部会话', () => {
    expect(searchSessions(sessions, '   ')).toEqual(sessions);
  });
});
