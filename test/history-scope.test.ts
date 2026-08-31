import { describe, expect, it } from 'vitest';

import { filterSessionsByScope } from '../src/history/session-scope.js';
import type { SessionSummary } from '../src/agents/types.js';

const sessions: readonly SessionSummary[] = [
  { agent: 'claude', id: 'one', title: '当前项目', cwd: '/work/zmai', updatedAt: '2026-08-31T12:00:00.000Z', sourcePath: '/one' },
  { agent: 'codex', id: 'two', title: '其他项目', cwd: '/work/other', updatedAt: '2026-08-31T11:00:00.000Z', sourcePath: '/two' },
];

describe('会话范围', () => {
  it('仅保留当前项目的会话，并规范化路径', () => {
    expect(filterSessionsByScope(sessions, 'current', '/work/zmai/')).toEqual([sessions[0]]);
  });

  it('全部范围保留全部会话', () => {
    expect(filterSessionsByScope(sessions, 'all', '/work/zmai')).toEqual(sessions);
  });
});
