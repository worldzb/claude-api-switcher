import { describe, expect, it } from 'vitest';

import { OpenCodeAdapter } from '../src/agents/opencode-adapter.js';

describe('OpenCodeAdapter', () => {
  it('读取 CLI 返回的顶层 updated 毫秒时间戳', () => {
    const adapter = new OpenCodeAdapter('/home/test');
    Object.defineProperty(adapter, 'execute', {
      value: () => JSON.stringify([{
        id: 'ses_example',
        title: '示例会话',
        directory: '/work/example',
        updated: 1_788_855_243_511,
      }]),
    });

    expect(adapter.listSessions()).toEqual([{
      agent: 'opencode',
      id: 'ses_example',
      title: '示例会话',
      cwd: '/work/example',
      updatedAt: '2026-09-08T08:14:03.511Z',
      sourcePath: 'ses_example',
    }]);
  });
});
