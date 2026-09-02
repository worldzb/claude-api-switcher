import { describe, expect, it } from 'vitest';

import type { SessionSummary } from '../src/agents/types.js';
import { selectSessions, sessionSelectionKey, toggleSessionSelection } from '../src/history/session-selection.js';

const claudeSession: SessionSummary = {
  agent: 'claude',
  id: 'same-id',
  title: 'Claude session',
  cwd: '/project',
  updatedAt: '2026-09-02T00:00:00.000Z',
  sourcePath: '/history/claude.jsonl',
};

const codexSession: SessionSummary = {
  ...claudeSession,
  agent: 'codex',
  title: 'Codex session',
  sourcePath: '/history/codex.jsonl',
};

describe('history session selection', () => {
  it('keeps selections distinct by agent and source path', () => {
    const selected = selectSessions([claudeSession, codexSession, claudeSession]);

    expect(selected).toEqual(new Set([
      sessionSelectionKey(claudeSession),
      sessionSelectionKey(codexSession),
    ]));
  });

  it('toggles a session without mutating the prior selection', () => {
    const initial = selectSessions([claudeSession]);
    const cleared = toggleSessionSelection(initial, claudeSession);
    const restored = toggleSessionSelection(cleared, claudeSession);

    expect(initial).toEqual(new Set([sessionSelectionKey(claudeSession)]));
    expect(cleared).toEqual(new Set());
    expect(restored).toEqual(initial);
  });
});
