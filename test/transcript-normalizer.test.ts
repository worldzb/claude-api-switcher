import { describe, expect, it } from 'vitest';

import { renderPortableTranscript } from '../src/migration/prompt-renderer.js';
import { normalizeContent } from '../src/migration/transcript-normalizer.js';

describe('会话迁移转换', () => {
  it('保留文本、图片和无法读取的附件说明', () => {
    const content = normalizeContent([
      { type: 'text', text: '修复登录问题' },
      { type: 'image', path: '/tmp/screenshot.png', mimeType: 'image/png' },
      { type: 'file', path: '/tmp/missing.pdf', mimeType: 'application/pdf' },
    ]);

    expect(content).toEqual([
      { type: 'text', text: '修复登录问题' },
      { type: 'image', path: '/tmp/screenshot.png', mimeType: 'image/png' },
      { type: 'file', path: '/tmp/missing.pdf', mimeType: 'application/pdf' },
    ]);
  });

  it('将远程图片保留为可审阅的引用', () => {
    expect(normalizeContent([{ type: 'input_image', image_url: 'https://example.com/image.png' }])).toEqual([
      { type: 'text', text: '[远程图片引用：https://example.com/image.png]' },
    ]);
  });

  it('以用户可审阅的上下文文档格式渲染迁移记录', () => {
    const rendered = renderPortableTranscript({
      source: { agent: 'codex', id: 'source', title: '登录修复', cwd: '/project', updatedAt: '2026-08-31T12:00:00.000Z', sourcePath: '/source' },
      messages: [{ role: 'user', content: [{ type: 'text', text: '修复登录问题' }] }],
      warnings: [],
    });

    expect(rendered).toContain('# 从 Codex 迁移的会话');
    expect(rendered).toContain('修复登录问题');
  });
});
