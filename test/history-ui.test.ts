import { describe, expect, it } from 'vitest';

import { formatSessionRow, relativeTime } from '../src/history/ui/formatters.js';
import { latestPreviewMessages } from '../src/history/ui/session-preview.js';

describe('历史记录界面格式化', () => {
  it('在窄终端中截断标题和工作目录', () => {
    expect(formatSessionRow({
      agent: 'claude',
      id: '1234567890',
      title: '这是一个非常长的会话标题，需要截断',
      cwd: '/very/long/project/path/that/needs/truncation',
      updatedAt: '2026-08-31T11:55:00.000Z',
      sourcePath: '/source',
    }, 20)).toEqual({
      agent: 'CLAUDE',
      id: '12345678',
      title: '这是一个非常长的会话标…',
      cwd: '…/truncation',
    });
  });

  it('将更新时间显示为相对时间', () => {
    expect(relativeTime('2026-08-31T11:58:30.000Z', new Date('2026-08-31T12:00:00.000Z'))).toBe('1 分钟前');
    expect(relativeTime('2026-08-31T10:00:00.000Z', new Date('2026-08-31T12:00:00.000Z'))).toBe('2 小时前');
    expect(relativeTime('2026-08-30T12:00:00.000Z', new Date('2026-08-31T12:00:00.000Z'))).toBe('1 天前');
  });

  it('会话预览按最新消息优先显示', () => {
    const preview = latestPreviewMessages([
      { role: 'user', content: [{ type: 'text', text: '第一条用户消息' }] },
      { role: 'assistant', content: [{ type: 'text', text: '中间回复' }] },
      { role: 'user', content: [{ type: 'text', text: '最新的用户消息' }] },
    ]);

    expect(preview).toEqual([
      { role: 'user', text: '最新的用户消息' },
      { role: 'assistant', text: '中间回复' },
      { role: 'user', text: '第一条用户消息' },
    ]);
  });
});
