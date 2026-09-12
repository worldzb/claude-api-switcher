import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import React from 'react';
import { render } from 'ink';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import type { AgentId, IntegrationItem } from '../src/agents/types.js';
import { ResourceApp, type McpAddInput } from '../src/integrations/ui/resource-app.js';

const ESCAPE = String.fromCharCode(27);
const ENTER = '\r';
const UP = `${ESCAPE}[A`;
const DOWN = `${ESCAPE}[B`;
const BACKSPACE = String.fromCharCode(127);

/** ink-testing-library 的最小替代：用假的 TTY stdin/stdout 驱动 Ink 交互界面。 */
class FakeStdin extends EventEmitter {
  readonly isTTY = true;
  private queue: string[] = [];
  setRawMode(): void {}
  setEncoding(): void {}
  ref(): void {}
  unref(): void {}
  resume(): void {}
  pause(): void {}
  read(): string | null { return this.queue.shift() ?? null; }
  write(data: string): void { this.queue.push(data); this.emit('readable'); }
}

class FakeStdout extends EventEmitter {
  readonly isTTY = true;
  readonly columns = 120;
  readonly rows = 40;
  frames = 0;
  private frame = '';
  write(chunk: string): boolean { this.frame += chunk; this.frames += 1; return true; }
  get output(): string { return this.frame; }
}

const CONFIG = '{"type":"streamable-http","url":"https://mcp-gw.example.com/server/c0da2d834d9e8e1e7f5d3f74962881e5e986b739059d513311289fdb6498c75?key=3027afd8ec635de26d063d9418d290ce"}';

function delay(ms = 15): Promise<void> { return new Promise((resolve) => setTimeout(resolve, ms)); }

/** 等待 Ink 写完一帧，避免纯固定延时猜渲染时机。 */
async function settle(stdout: FakeStdout, previousFrames: number, timeoutMs = 1500): Promise<void> {
  const started = Date.now();
  while (stdout.frames <= previousFrames && Date.now() - started < timeoutMs) await delay(5);
  await delay(10);
}

describe('添加 MCP 交互界面', { timeout: 30_000 }, () => {
  let projectDirectory: string;
  let activeStdout: FakeStdout;
  const mounted: { unmount(): void }[] = [];

  beforeAll(() => { projectDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'zmai-add-ui-')); });
  afterEach(() => { mounted.splice(0).forEach((app) => app.unmount()); });

  function mount(options: {
    readonly added: McpAddInput[];
    readonly items?: readonly IntegrationItem[];
    readonly projectAgents?: readonly AgentId[];
  }): { readonly stdin: FakeStdin; readonly stdout: FakeStdout } {
    const stdin = new FakeStdin();
    const stdout = new FakeStdout();
    activeStdout = stdout;
    const app = render(<ResourceApp
      kind="mcp"
      label="MCP"
      items={options.items ?? []}
      projectDirectory={projectDirectory}
      homeDirectory={projectDirectory}
      mcpProjectAgents={options.projectAgents ?? ['claude', 'opencode']}
      onRefresh={async () => options.items ?? []}
      onCopy={async () => 'copied'}
      onRemove={async () => 'removed'}
      onSetEnabled={async () => 'enabled'}
      onAdd={async (input) => { options.added.push(input); return `MCP 已添加：${input.name}`; }}
      onClearScreen={() => {}}
    />, { stdin: stdin as unknown as NodeJS.ReadStream, stdout: stdout as unknown as NodeJS.WriteStream, exitOnCtrlC: false, patchConsole: false });
    mounted.push(app as unknown as { unmount(): void });
    return { stdin, stdout };
  }

  async function press(stdin: FakeStdin, keys: readonly string[]): Promise<void> {
    for (const key of keys) {
      const previousFrames = activeStdout.frames;
      stdin.write(key);
      await settle(activeStdout, previousFrames);
    }
  }

  function characters(text: string): readonly string[] { return [...text]; }

  it('列表提示添加入口，并可以添加到当前项目', async () => {
    const added: McpAddInput[] = [];
    const { stdin, stdout } = mount({ added });
    await delay(60);
    expect(stdout.output).toContain('a 添加 MCP');

    await press(stdin, ['a', ENTER, ENTER, ...characters('smoke-mcp'), ENTER, ...characters('{"command":"npx"}')]);
    await press(stdin, [ENTER]);
    await delay(60);
    expect(stdout.output).toContain('添加 MCP · 确认');
    expect(added).toEqual([]);

    await press(stdin, ['y']);
    await delay(60);
    expect(added).toEqual([{ agent: 'claude', name: 'smoke-mcp', configuration: '{"command":"npx"}', scope: 'project', project: projectDirectory }]);
    expect(stdout.output).toContain('MCP 已添加：smoke-mcp');
  });

  it('可以选择全局范围', async () => {
    const added: McpAddInput[] = [];
    const { stdin } = mount({ added });
    await delay(60);

    await press(stdin, ['a', UP, ENTER, ENTER, ...characters('global-mcp'), ENTER, ...characters('{"url":"https://example.com/mcp"}'), ENTER, 'y']);
    await delay(60);
    expect(added).toEqual([{ agent: 'claude', name: 'global-mcp', configuration: '{"url":"https://example.com/mcp"}', scope: 'user' }]);
  });

  it('同一批次内快速输入并立即回车时不会丢失字符', async () => {
    const added: McpAddInput[] = [];
    const { stdin, stdout } = mount({ added });
    await delay(60);

    // 模拟终端合并送达的按键（粘贴或快速输入）：全部在同一个事件批次内写入。
    stdin.write('a');
    stdin.write(ENTER);
    stdin.write(ENTER);
    for (const character of 'demo') stdin.write(character);
    stdin.write(ENTER);
    for (const character of '{"command":"npx","args":["-y","server"]}') stdin.write(character);
    stdin.write(ENTER);
    await delay(80);
    expect(stdout.output).not.toContain('必须是有效的 JSON');
    expect(stdout.output).toContain('添加 MCP · 确认');

    stdin.write('y');
    await delay(80);
    expect(added).toEqual([{ agent: 'claude', name: 'demo', configuration: '{"command":"npx","args":["-y","server"]}', scope: 'project', project: projectDirectory }]);
  });

  it('长 URL 配置无论整块还是分块粘贴都完整保留', async () => {
    const added: McpAddInput[] = [];
    const { stdin, stdout } = mount({ added });
    await delay(60);

    await press(stdin, ['a', ENTER, ENTER, ...characters('dingtalk'), ENTER]);
    // 终端可能把长粘贴拆成多块依次送达。
    for (const chunk of CONFIG.match(/[\s\S]{1,64}/g) ?? []) { stdin.write(chunk); await delay(20); }
    await press(stdin, [ENTER]);
    await delay(60);
    expect(stdout.output).not.toContain('必须是有效的 JSON');
    await press(stdin, ['y']);
    await delay(60);

    expect(added[0]?.configuration).toBe(CONFIG);
  });

  it('输入法把引号变成中文引号时自动修正', async () => {
    const added: McpAddInput[] = [];
    const { stdin, stdout } = mount({ added });
    await delay(60);

    await press(stdin, ['a', ENTER, ENTER, ...characters('ime-mcp'), ENTER]);
    stdin.write('{“type”：“streamable-http”，“url”：“https://example.com/mcp”}');
    await delay(60);
    await press(stdin, [ENTER]);
    await delay(60);
    expect(stdout.output).not.toContain('必须是有效的 JSON');
    await press(stdin, ['y']);
    await delay(60);

    expect(added[0]?.configuration).toBe('{"type":"streamable-http","url":"https://example.com/mcp"}');
  });

  it('粘贴多行 JSON 时按空白丢弃换行并通过校验', async () => {
    const added: McpAddInput[] = [];
    const { stdin, stdout } = mount({ added });
    await delay(60);

    await press(stdin, ['a', ENTER, ENTER, ...characters('multiline'), ENTER]);
    stdin.write('{\n  "command": "npx",\n  "args": ["-y", "server"]\n}');
    await delay(60);
    await press(stdin, [ENTER]);
    await delay(60);
    expect(stdout.output).not.toContain('必须是有效的 JSON');
    await press(stdin, ['y']);
    await delay(60);

    expect(added).toHaveLength(1);
    expect(JSON.parse(added[0]!.configuration)).toEqual({ command: 'npx', args: ['-y', 'server'] });
  });

  it('选择 Codex 时拒绝中文名称并提示原因', async () => {
    const added: McpAddInput[] = [];
    const { stdin, stdout } = mount({ added, projectAgents: ['claude', 'codex', 'opencode'] });
    await delay(60);

    // 全局范围第 2 个 Agent 是 Codex
    await press(stdin, ['a', UP, ENTER, DOWN, ENTER, ...characters('钉钉文档'), ENTER]);
    expect(stdout.output).toContain('不支持中文');
    expect(added).toEqual([]);

    await press(stdin, [...Array.from({ length: '钉钉文档'.length }, () => BACKSPACE), ...characters('dingtalk'), ENTER, ...characters('{"url":"https://example.com/mcp"}'), ENTER, 'y']);
    await delay(60);
    expect(added).toEqual([{ agent: 'codex', name: 'dingtalk', configuration: '{"url":"https://example.com/mcp"}', scope: 'user' }]);
  });

  it('可以输入中文名称', async () => {
    const added: McpAddInput[] = [];
    const { stdin, stdout } = mount({ added });
    await delay(60);

    await press(stdin, ['a', ENTER, ENTER, ...characters('本地工具'), ENTER, ...characters('{"command":"npx"}'), ENTER, 'y']);
    await delay(60);
    expect(added).toEqual([{ agent: 'claude', name: '本地工具', configuration: '{"command":"npx"}', scope: 'project', project: projectDirectory }]);
    expect(stdout.output).toContain('本地工具');
  });

  it('可以添加到指定项目目录', async () => {
    const added: McpAddInput[] = [];
    const target = fs.mkdtempSync(path.join(os.tmpdir(), 'zmai-add-target-'));
    const { stdin, stdout } = mount({ added });
    await delay(60);

    await press(stdin, ['a', DOWN, DOWN, ENTER]);
    expect(stdout.output).toContain('指定项目目录');
    await press(stdin, [...characters(target), ENTER, ENTER, ...characters('other-mcp'), ENTER, ...characters('{"url":"https://example.com/mcp"}'), ENTER, 'y']);
    await delay(60);
    expect(added).toEqual([{ agent: 'claude', name: 'other-mcp', configuration: '{"url":"https://example.com/mcp"}', scope: 'project', project: target }]);
    fs.rmSync(target, { recursive: true, force: true });
  });

  it('项目范围只列出支持项目配置的 Agent', async () => {
    const added: McpAddInput[] = [];
    const { stdin, stdout } = mount({ added, projectAgents: ['opencode'] });
    await delay(60);

    await press(stdin, ['a', ENTER, ENTER, ...characters('opencode-mcp'), ENTER, ...characters('{"url":"https://example.com/mcp"}'), ENTER]);
    await delay(60);
    // 写入前按 OpenCode 的格式转换，确认页展示的就是转换后的内容
    expect(stdout.output).toContain('{"type":"remote","url":"https://example.com/mcp","enabled":true}');
    await press(stdin, ['y']);
    await delay(60);
    expect(added).toEqual([{ agent: 'opencode', name: 'opencode-mcp', configuration: '{"type":"remote","url":"https://example.com/mcp","enabled":true}', scope: 'project', project: projectDirectory }]);
    expect(stdout.output).toContain('OPENCODE');
  });

  it('选择 OpenCode 时把 Claude 风格的配置转成 remote', async () => {
    const added: McpAddInput[] = [];
    const { stdin, stdout } = mount({ added, projectAgents: ['opencode'] });
    await delay(60);

    stdin.write('a'); await delay(20); stdin.write(ENTER); await delay(20); stdin.write(ENTER); await delay(20);
    for (const character of 'dingtalk') { stdin.write(character); await delay(15); }
    await press(stdin, [ENTER]);
    stdin.write('{"type":"streamable-http","url":"https://mcp-gw.example.com/server/abc?key=123"}');
    await delay(60);
    await press(stdin, [ENTER]);
    await delay(60);
    await press(stdin, ['y']);
    await delay(60);

    expect(added[0]?.configuration).toBe('{"type":"remote","url":"https://mcp-gw.example.com/server/abc?key=123","enabled":true}');
    expect(stdout.output).not.toContain('必须是有效的 JSON');
  });

  it('拒绝不存在的项目目录', async () => {
    const added: McpAddInput[] = [];
    const { stdin, stdout } = mount({ added });
    await delay(60);

    await press(stdin, ['a', DOWN, DOWN, ENTER, ...characters(path.join(projectDirectory, 'missing')), ENTER]);
    expect(stdout.output).toContain('项目目录不存在');
    expect(added).toEqual([]);
  });

  it('拒绝重名和缺少 url/command 的配置', async () => {
    const added: McpAddInput[] = [];
    const { stdin, stdout } = mount({ added, items: [{ agent: 'claude', kind: 'mcp', name: 'taken', scope: 'project', location: path.join(projectDirectory, '.mcp.json'), removable: true }] });
    await delay(60);

    await press(stdin, ['a', ENTER, ENTER, ...characters('taken'), ENTER]);
    expect(stdout.output).toContain('已存在同名 MCP');

    await press(stdin, [...Array.from({ length: 'taken'.length }, () => BACKSPACE), ...characters('fresh'), ENTER, ...characters('{"args":["-y"]}'), ENTER]);
    expect(stdout.output).toContain('需要 url，或 command');
    expect(added).toEqual([]);
  });

  it('Esc 逐级返回并最终退出向导', async () => {
    const added: McpAddInput[] = [];
    const { stdin, stdout } = mount({ added });
    await delay(60);

    await press(stdin, ['a', ENTER, ENTER, ...characters('back-mcp'), ENTER, ESCAPE]);
    expect(stdout.output).toContain('MCP 名称');
    expect(stdout.output).toContain('back-mcp');

    await press(stdin, [ESCAPE, ESCAPE, ESCAPE]);
    expect(stdout.output).toContain('添加 MCP · 1/5');
    expect(added).toEqual([]);
  });
});
