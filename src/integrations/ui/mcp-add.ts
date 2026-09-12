import fs from 'node:fs';
import path from 'node:path';

import { AGENT_IDS, type AgentId, type IntegrationItem } from '../../agents/types.js';
import { mcpNameError } from '../../agents/mcp-name.js';

/** 添加 MCP 时的写入范围：全局、当前项目目录，或手动指定的项目目录。 */
export type McpAddTarget = 'user' | 'current' | 'other';
export type McpAddStep = 'target' | 'projectPath' | 'agent' | 'name' | 'configuration' | 'confirm';

export interface McpAddTargetChoice {
  readonly value: McpAddTarget;
  readonly label: string;
  readonly description: string;
}

export const MCP_ADD_TARGETS: readonly McpAddTargetChoice[] = [
  { value: 'user', label: '全局', description: '写入用户级配置，对所有项目生效' },
  { value: 'current', label: '当前项目', description: '写入当前工作目录的项目级配置' },
  { value: 'other', label: '指定项目目录', description: '手动输入项目目录，留空则使用当前目录' },
];

const STEP_ORDER: readonly McpAddStep[] = ['target', 'projectPath', 'agent', 'name', 'configuration', 'confirm'];

export function mcpAddSteps(target: McpAddTarget): readonly McpAddStep[] {
  return target === 'other' ? STEP_ORDER : STEP_ORDER.filter((step) => step !== 'projectPath');
}

export function nextMcpAddStep(target: McpAddTarget, step: McpAddStep): McpAddStep | undefined {
  const steps = mcpAddSteps(target);
  const index = steps.indexOf(step);
  return index < 0 ? undefined : steps[index + 1];
}

export function previousMcpAddStep(target: McpAddTarget, step: McpAddStep): McpAddStep | undefined {
  const steps = mcpAddSteps(target);
  const index = steps.indexOf(step);
  return index <= 0 ? undefined : steps[index - 1];
}

/** 目标范围可选的 Agent：项目级 MCP 只列出支持写入项目配置的 Agent。 */
export function mcpAgentsForTarget(target: McpAddTarget, projectAgents: readonly AgentId[] = AGENT_IDS): readonly AgentId[] {
  return target === 'user' ? AGENT_IDS : AGENT_IDS.filter((agent) => projectAgents.includes(agent));
}

export function mcpAddTargetScope(target: McpAddTarget): IntegrationItem['scope'] {
  return target === 'user' ? 'user' : 'project';
}

export interface McpPathContext {
  readonly cwd: string;
  readonly homeDirectory: string;
}

/** 展开 `~` 并把相对路径解析到当前工作目录。 */
export function resolveProjectPath(value: string, context: McpPathContext): string {
  const trimmed = value.trim().replace(/^["']|["']$/g, '').trim();
  if (!trimmed) return '';
  if (trimmed === '~') return path.resolve(context.homeDirectory);
  if (trimmed.startsWith('~/') || trimmed.startsWith('~\\')) return path.resolve(context.homeDirectory, trimmed.slice(2));
  return path.resolve(context.cwd, trimmed);
}

/** 输入为空时回退到当前项目目录。 */
export function resolveMcpProjectPath(value: string, context: McpPathContext): string {
  return resolveProjectPath(value, context) || context.cwd;
}

export function validateProjectPath(value: string, context: McpPathContext): string | undefined {
  const resolved = resolveProjectPath(value, context);
  if (!resolved) return undefined;
  if (!fs.existsSync(resolved)) return `项目目录不存在：${resolved}`;
  if (!fs.statSync(resolved).isDirectory()) return `项目路径不是目录：${resolved}`;
  return undefined;
}

export function validateMcpName(value: string, existing: readonly IntegrationItem[], agent: AgentId): string | undefined {
  const name = value.trim();
  const charsetError = mcpNameError(agent, name);
  if (charsetError) return charsetError;
  return existing.some((item) => item.kind === 'mcp' && item.name === name)
    ? `该 Agent 在此范围已存在同名 MCP：${name}`
    : undefined;
}

/** 名称输入框的提示，按目标 Agent 的能力给出。 */
export function mcpNameHint(agent: AgentId): string {
  return agent === 'codex'
    ? '例如 github、context7；Codex 只接受字母、数字与 - _ : @ / . 组成的名称'
    : '例如 github、context7、本地工具；支持中文，名称需与该 Agent 同一范围内的 MCP 不重名';
}

/** 配置输入框的提示，按目标 Agent 支持的格式给出。 */
export function mcpConfigurationHint(agent: AgentId): string {
  return agent === 'opencode'
    ? 'OpenCode 用 {"type":"remote","url":"https://example.com/mcp"} 或 {"type":"local","command":["npx","-y","server"]}，会自动补上 enabled'
    : 'url 或 command 二选一，例如 {"command":"npx","args":["-y","server"]} 或 {"url":"https://example.com/mcp"}';
}
