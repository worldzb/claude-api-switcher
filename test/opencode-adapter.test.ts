import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { OpenCodeAdapter } from '../src/agents/opencode-adapter.js';

describe('OpenCodeAdapter', () => {
  const directories: string[] = [];

  afterEach(() => { directories.splice(0).forEach((directory) => fs.rmSync(directory, { recursive: true, force: true })); });

  function createDirectory(prefix: string): string {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    directories.push(directory);
    return directory;
  }

  function createAdapter(): OpenCodeAdapter {
    const adapter = new OpenCodeAdapter(createDirectory('zmai-opencode-home-'));
    // 避免依赖本机是否安装 opencode CLI。
    Object.defineProperty(adapter, 'execute', { value: () => { throw new Error('opencode 未安装'); } });
    return adapter;
  }

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

  it('列出项目级 opencode.json 中的 MCP 与插件', () => {
    const project = createDirectory('zmai-opencode-project-');
    const file = path.join(project, 'opencode.json');
    fs.writeFileSync(file, JSON.stringify({ plugin: ['demo-plugin'], mcp: { '本地工具': { url: 'https://example.com/mcp' } } }));
    const adapter = createAdapter();

    expect(adapter.listIntegrations(project)).toEqual([
      { agent: 'opencode', kind: 'plugin', name: 'demo-plugin', scope: 'project', location: file, removable: true },
      { agent: 'opencode', kind: 'mcp', name: '本地工具', scope: 'project', location: file, removable: true },
    ]);
  });

  it('添加项目级 MCP 后可以列出并导出中文名称的配置', () => {
    const project = createDirectory('zmai-opencode-project-');
    const adapter = createAdapter();

    adapter.addMcp('本地工具', '{"url":"https://example.com/mcp"}', 'project', project);

    const items = adapter.listIntegrations(project).filter((item) => item.kind === 'mcp');
    expect(items.map((item) => item.name)).toEqual(['本地工具']);
    // 写入时会转换成 OpenCode 的 remote 格式并补上 enabled
    expect(adapter.readMcpConfiguration(items[0]!)).toBe('{"type":"remote","url":"https://example.com/mcp","enabled":true}');
  });

  it('把 Claude 风格的 streamable-http 配置转成 OpenCode 的 remote 格式', () => {
    const project = createDirectory('zmai-opencode-project-');
    const adapter = createAdapter();

    adapter.addMcp('dingtalk', '{"type":"streamable-http","url":"https://mcp-gw.example.com/server/abc?key=123"}', 'project', project);

    expect(JSON.parse(fs.readFileSync(path.join(project, 'opencode.json'), 'utf8'))).toEqual({
      mcp: {
        dingtalk: { type: 'remote', url: 'https://mcp-gw.example.com/server/abc?key=123', enabled: true },
      },
    });
  });

  it('可以移除配置文件里的 MCP 并保留其他内容', () => {
    const project = createDirectory('zmai-opencode-project-');
    const file = path.join(project, 'opencode.json');
    fs.writeFileSync(file, JSON.stringify({ theme: 'dark', mcp: { keep: { type: 'remote', url: 'https://example.com/mcp', enabled: true }, drop: { type: 'remote', url: 'https://example.com/old', enabled: true } } }));
    const adapter = createAdapter();

    const item = adapter.listIntegrations(project).find((candidate) => candidate.kind === 'mcp' && candidate.name === 'drop');
    expect(item?.removable).toBe(true);
    adapter.removeIntegration(item!);

    expect(JSON.parse(fs.readFileSync(file, 'utf8'))).toEqual({
      theme: 'dark',
      mcp: { keep: { type: 'remote', url: 'https://example.com/mcp', enabled: true } },
    });
  });

  it('无法转换成 OpenCode 格式时拒绝写入', () => {
    const project = createDirectory('zmai-opencode-project-');
    const adapter = createAdapter();

    expect(() => adapter.addMcp('bad', '{"type":"websocket","url":"wss://example.com"}', 'project', project)).toThrow('不认识 type "websocket"');
    expect(fs.existsSync(path.join(project, 'opencode.json'))).toBe(false);
  });
});
