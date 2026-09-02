import type { SessionSummary } from '../agents/types.js';

export function sessionSelectionKey(session: Pick<SessionSummary, 'agent' | 'sourcePath'>): string {
  return `${session.agent}\u0000${session.sourcePath}`;
}

export function toggleSessionSelection(
  selectedKeys: ReadonlySet<string>,
  session: Pick<SessionSummary, 'agent' | 'sourcePath'>,
): ReadonlySet<string> {
  const key = sessionSelectionKey(session);
  const next = new Set(selectedKeys);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}

export function selectSessions(sessions: readonly Pick<SessionSummary, 'agent' | 'sourcePath'>[]): ReadonlySet<string> {
  return new Set(sessions.map(sessionSelectionKey));
}
