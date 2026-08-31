import type { SessionSummary } from '../../agents/types.js';

export interface SessionRow {
  readonly agent: string;
  readonly id: string;
  readonly title: string;
  readonly cwd: string;
}

export function formatSessionRow(session: SessionSummary, width: number): SessionRow {
  const titleWidth = Math.max(12, Math.floor(width * 0.56));
  const cwdWidth = Math.max(12, width - titleWidth);
  return {
    agent: session.agent.toUpperCase(),
    id: session.id.slice(0, 8),
    title: truncate(session.title.replaceAll(/\s+/g, ' '), titleWidth),
    cwd: truncatePath(session.cwd, cwdWidth),
  };
}

export function relativeTime(value: string, now = new Date()): string {
  const elapsedSeconds = Math.max(0, Math.floor((now.valueOf() - new Date(value).valueOf()) / 1_000));
  if (elapsedSeconds < 60) return '刚刚';
  if (elapsedSeconds < 3_600) return `${Math.floor(elapsedSeconds / 60)} 分钟前`;
  if (elapsedSeconds < 86_400) return `${Math.floor(elapsedSeconds / 3_600)} 小时前`;
  if (elapsedSeconds < 2_592_000) return `${Math.floor(elapsedSeconds / 86_400)} 天前`;
  return new Date(value).toLocaleDateString('zh-CN');
}

export function truncate(value: string, width: number): string {
  if (value.length <= width) return value;
  return `${value.slice(0, Math.max(0, width - 1))}…`;
}

export function truncatePath(value: string, width: number): string {
  if (value.length <= width) return value;
  const segments = value.split('/').filter(Boolean);
  let result = '';
  while (segments.length && result.length < width - 1) {
    result = `/${segments.pop()}${result}`;
  }
  return truncate(`…${result}`, width);
}
