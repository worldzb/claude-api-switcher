import path from 'node:path';

import type { SessionSummary } from '../agents/types.js';

export type SessionScope = 'current' | 'all';

export function filterSessionsByScope(
  sessions: readonly SessionSummary[],
  scope: SessionScope,
  currentDirectory: string,
): readonly SessionSummary[] {
  if (scope === 'all') return sessions;
  const normalizedCurrentDirectory = normalizePath(currentDirectory);
  return sessions.filter((session) => normalizePath(session.cwd) === normalizedCurrentDirectory);
}

function normalizePath(value: string): string {
  return path.resolve(value);
}
