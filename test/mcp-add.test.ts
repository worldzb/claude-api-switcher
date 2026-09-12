import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { IntegrationItem } from '../src/agents/types.js';
import { mcpNameError } from '../src/agents/mcp-name.js';
import {
  MCP_ADD_TARGETS,
  mcpAddSteps,
  mcpAddTargetScope,
  mcpAgentsForTarget,
  mcpConfigurationHint,
  mcpNameHint,
  nextMcpAddStep,
  previousMcpAddStep,
  resolveMcpProjectPath,
  resolveProjectPath,
  validateMcpName,
  validateProjectPath,
} from '../src/integrations/ui/mcp-add.js';

const context = { cwd: '/work/app', homeDirectory: '/home/dev' };

const existing: readonly IntegrationItem[] = [
  { agent: 'claude', kind: 'mcp', name: 'github', scope: 'user', location: '/home/dev/.claude.json', removable: true },
  { agent: 'codex', kind: 'mcp', name: 'github', scope: 'user', location: 'codex mcp', removable: true },
];

describe('添加 MCP 步骤', () => {
  it('只有指定项目目录时才插入目录输入步骤', () => {
    expect(mcpAddSteps('user')).toEqual(['target', 'agent', 'name', 'configuration', 'confirm']);
    expect(mcpAddSteps('current')).toEqual(['target', 'agent', 'name', 'configuration', 'confirm']);
    expect(mcpAddSteps('other')).toEqual(['target', 'projectPath', 'agent', 'name', 'configuration', 'confirm']);
  });

  it('按范围前后移动步骤', () => {
    expect(nextMcpAddStep('user', 'target')).toBe('agent');
    expect(nextMcpAddStep('other', 'target')).toBe('projectPath');
    expect(nextMcpAddStep('other', 'projectPath')).toBe('agent');
    expect(previousMcpAddStep('other', 'agent')).toBe('projectPath');
    expect(previousMcpAddStep('user', 'agent')).toBe('target');
    expect(previousMcpAddStep('user', 'configuration')).toBe('name');
    expect(nextMcpAddStep('user', 'name')).toBe('configuration');
    expect(nextMcpAddStep('user', 'configuration')).toBe('confirm');
  });

  it('在第一步之前没有上一步', () => {
    expect(previousMcpAddStep('user', 'target')).toBeUndefined();
    expect(nextMcpAddStep('user', 'confirm')).toBeUndefined();
  });
});

describe('添加 MCP 范围', () => {
  it('全局范围列出全部 Agent，项目范围只列出支持项目配置的 Agent', () => {
    expect(mcpAgentsForTarget('user')).toEqual(['claude', 'codex', 'opencode']);
    expect(mcpAgentsForTarget('current', ['claude', 'opencode'])).toEqual(['claude', 'opencode']);
    expect(mcpAgentsForTarget('other', ['claude'])).toEqual(['claude']);
    expect(mcpAgentsForTarget('other', [])).toEqual([]);
  });

  it('把写入范围映射到资源范围', () => {
    expect(mcpAddTargetScope('user')).toBe('user');
    expect(mcpAddTargetScope('current')).toBe('project');
    expect(mcpAddTargetScope('other')).toBe('project');
  });

  it('提供全局、当前项目和指定项目三个选项', () => {
    expect(MCP_ADD_TARGETS.map((choice) => choice.value)).toEqual(['user', 'current', 'other']);
  });
});

describe('项目目录解析与校验', () => {
  let directory: string;
  let file: string;

  beforeAll(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'zmai-mcp-add-'));
    file = path.join(directory, 'opencode.json');
    fs.writeFileSync(file, '{}\n');
  });

  afterAll(() => { fs.rmSync(directory, { recursive: true, force: true }); });

  it('把相对路径解析到当前工作目录', () => {
    expect(resolveProjectPath('packages/web', context)).toBe(path.resolve('/work/app', 'packages/web'));
    expect(resolveProjectPath('./nested/', context)).toBe(path.resolve('/work/app', 'nested'));
  });

  it('展开 ~ 并把去除引号的路径解析为绝对路径', () => {
    expect(resolveProjectPath('~', context)).toBe(path.resolve('/home/dev'));
    expect(resolveProjectPath('~/projects/app', context)).toBe(path.resolve('/home/dev', 'projects/app'));
    expect(resolveProjectPath('"/work/app"', context)).toBe(path.resolve('/work/app'));
  });

  it('空输入回退到当前项目目录', () => {
    expect(resolveProjectPath('   ', context)).toBe('');
    expect(resolveMcpProjectPath('   ', context)).toBe(context.cwd);
    expect(resolveMcpProjectPath('~/projects/app', context)).toBe(path.resolve('/home/dev', 'projects/app'));
    expect(validateProjectPath('', context)).toBeUndefined();
  });

  it('拒绝缺失路径和非目录路径', () => {
    expect(validateProjectPath(path.join(directory, 'missing'), context)).toContain('项目目录不存在');
    expect(validateProjectPath(file, context)).toContain('不是目录');
    expect(validateProjectPath(directory, context)).toBeUndefined();
  });
});

describe('MCP 名称校验', () => {
  it('要求非空且字符合法', () => {
    expect(validateMcpName('', existing, 'claude')).toBe('MCP 名称不能为空。');
    expect(validateMcpName('   ', existing, 'claude')).toBe('MCP 名称不能为空。');
    expect(validateMcpName('my server', existing, 'claude')).toContain('只能包含');
    expect(validateMcpName('github', [], 'claude')).toBeUndefined();
    expect(validateMcpName('@scope/server-1.0_x', [], 'claude')).toBeUndefined();
    expect(validateMcpName(' github ', [], 'claude')).toBeUndefined();
  });

  it('Claude 与 OpenCode 接受中文等文字名称', () => {
    expect(validateMcpName('本地工具', [], 'claude')).toBeUndefined();
    expect(validateMcpName('我的工具-v2', [], 'opencode')).toBeUndefined();
    expect(validateMcpName('データベース', [], 'claude')).toBeUndefined();
    expect(validateMcpName('사내도구', [], 'opencode')).toBeUndefined();
    expect(validateMcpName('工具 名', [], 'claude')).toContain('只能包含');
    expect(validateMcpName('工具"名', [], 'claude')).toContain('只能包含');
    expect(validateMcpName('工具&名', [], 'claude')).toContain('只能包含');
  });

  it('Codex CLI 只接受 ASCII 名称', () => {
    expect(validateMcpName('github', [], 'codex')).toBeUndefined();
    expect(validateMcpName('@scope/server-1.0_x', [], 'codex')).toBeUndefined();
    expect(validateMcpName('a:b@c/d.e-f_g', [], 'codex')).toBeUndefined();
    expect(validateMcpName('钉钉文档', [], 'codex')).toContain('不支持中文');
    expect(validateMcpName('本地工具', [], 'codex')).toContain('不支持中文');
    expect(validateMcpName('工具 名', [], 'codex')).toContain('不支持中文');
  });

  it('复制到其他 Agent 前用同一套规则拦截非法名称', () => {
    expect(mcpNameError('codex', '钉钉文档')).toContain('不支持中文');
    expect(mcpNameError('claude', '钉钉文档')).toBeUndefined();
    expect(mcpNameError('opencode', '本地工具')).toBeUndefined();
  });

  it('名称提示按 Agent 能力区分', () => {
    expect(mcpNameHint('codex')).toContain('Codex 只接受');
    expect(mcpNameHint('claude')).toContain('支持中文');
    expect(mcpNameHint('opencode')).toContain('支持中文');
  });

  it('拒绝同一范围内重名', () => {
    expect(validateMcpName('github', existing, 'claude')).toContain('已存在同名 MCP：github');
    expect(validateMcpName(' context7 ', existing, 'claude')).toBeUndefined();
  });
});

describe('MCP 配置提示', () => {
  it('按目标 Agent 给出对应的配置格式', () => {
    expect(mcpConfigurationHint('opencode')).toContain('"type":"remote"');
    expect(mcpConfigurationHint('opencode')).toContain('"type":"local"');
    expect(mcpConfigurationHint('claude')).toContain('url 或 command');
    expect(mcpConfigurationHint('codex')).toContain('url 或 command');
  });
});
