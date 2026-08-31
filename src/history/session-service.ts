import type { AgentId, HistoryPage, SessionSummary } from '../agents/types.js';

export interface PageOptions {
  readonly page: number;
  readonly pageSize: number;
  readonly agent?: AgentId;
}

export function pageSessions(
  sessions: readonly SessionSummary[],
  options: PageOptions,
): HistoryPage {
  const pageSize = Math.max(1, Math.min(options.pageSize, 100));
  const filtered = options.agent ? sessions.filter((session) => session.agent === options.agent) : sessions;
  const ordered = [...filtered].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  const totalPages = Math.max(1, Math.ceil(ordered.length / pageSize));
  const page = Math.max(1, Math.min(options.page, totalPages));
  const start = (page - 1) * pageSize;

  return {
    items: ordered.slice(start, start + pageSize),
    page,
    pageSize,
    total: ordered.length,
    totalPages,
  };
}

export function createSessionId(session: SessionSummary): string {
  return `${session.agent}:${encodeURIComponent(session.id)}`;
}

export function parseSessionId(value: string): { agent: AgentId; id: string } {
  const separator = value.indexOf(':');
  if (separator < 1) {
    throw new Error('会话 ID 应为 <agent>:<session-id>。');
  }
  const agent = value.slice(0, separator) as AgentId;
  if (!['claude', 'codex', 'opencode'].includes(agent)) {
    throw new Error(`不支持的 Agent：${agent}`);
  }
  return { agent, id: decodeURIComponent(value.slice(separator + 1)) };
}
