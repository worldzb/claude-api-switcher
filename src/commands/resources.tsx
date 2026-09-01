import { confirm, isCancel } from '@clack/prompts';
import chalk from 'chalk';
import type { Command } from 'commander';

import { render } from 'ink';
import React from 'react';
import { Worker } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';

import type { AgentId, IntegrationItem } from '../agents/types.js';
import { ResourceApp } from '../integrations/ui/resource-app.js';
import type { CommandContext } from './context.js';

type ResourceKind = IntegrationItem['kind'];
type ResourceOptions = {
  readonly agent?: AgentId;
  readonly project?: string;
  readonly install?: string;
  readonly remove?: string;
  readonly scope?: 'user' | 'project';
  readonly config?: string;
  readonly plain?: boolean;
  readonly loadItems: (onProgress: (message: string) => void) => Promise<readonly IntegrationItem[]>;
};

export function registerResourceCommands(program: Command, context: CommandContext): void {
  registerResourceCommand(program, context, 'mcps', 'mcp', 'MCP');
  registerResourceCommand(program, context, 'skills', 'skill', 'Skill');
  registerResourceCommand(program, context, 'plugins', 'plugin', 'Plugin');
}

function registerResourceCommand(program: Command, context: CommandContext, commandName: string, kind: ResourceKind, label: string): void {
  const command = program.command(commandName).description(`🧩 查看和管理 ${label}`)
    .option('-a, --agent <agent>', '筛选 Agent：claude、codex、opencode')
    .option('--project <path>', '包含项目级配置')
    .option('--install <value>', kind === 'mcp' ? '添加 MCP 名称' : kind === 'skill' ? '从本地目录安装 Skill' : '安装插件')
    .option('--remove <agent:name>', `移除 ${label}`)
    .option('--scope <scope>', '范围：user、project', 'user')
    .option('--plain', '以文本格式输出');
  if (kind === 'mcp') command.option('--config <json>', 'MCP JSON 配置');
  command.action(async (options: ResourceOptions) => handleResource(context, kind, label, options));
}

async function handleResource(context: CommandContext, kind: ResourceKind, label: string, options: ResourceOptions): Promise<void> {
  validateAgent(options.agent);
  validateScope(options.scope);
  const adapters = options.agent ? [context.agents.get(options.agent)] : context.agents.all();
  if (options.install) {
    const agent = requireAgent(options.agent, `${label} 安装`);
    const accepted = await confirm({ message: `为 ${agent} ${options.scope === 'project' ? '项目' : '用户'}范围${label}：${options.install}？`, initialValue: false });
    if (isCancel(accepted) || !accepted) return;
    if (kind === 'plugin') context.agents.get(agent).installPlugin(options.install, options.scope || 'user');
    else if (kind === 'skill') context.agents.get(agent).installSkill(options.install, options.scope || 'user', options.project);
    else {
      if (!options.config) throw new Error('--install 添加 MCP 时必须提供 --config <json>。');
      context.agents.get(agent).addMcp(options.install, options.config, options.scope || 'user', options.project);
    }
    console.log(chalk.green(`${label} 操作完成。`));
    return;
  }
  if (options.remove) {
    const item = findResource(context, kind, options.remove, options.project);
    const accepted = await confirm({ message: `移除 ${item.agent} ${label} “${item.name}”？`, initialValue: false });
    if (isCancel(accepted) || !accepted) return;
    context.agents.get(item.agent).removeIntegration(item);
    console.log(chalk.green(`${label} 已移除。`));
    return;
  }
  const items = adapters.flatMap((adapter) => adapter.listIntegrations(options.project).filter((item) => item.kind === kind));
  if (!options.plain && process.stdin.isTTY && process.stdout.isTTY) {
    let clearScreen = (): void => {};
    const app = render(<ResourceApp
      kind={kind}
      label={label}
      items={items}
      projectDirectory={options.project || process.cwd()}
      onRefresh={async () => loadResourceItems(context, kind, options.agent, options.project, () => {})}
      onCopy={async (item, target, targetScope) => copyResource(context, item, target, options.project, targetScope)}
      onRemove={async (item) => {
        context.agents.get(item.agent).removeIntegration(item);
        return `${label} 已移除：${item.name}`;
      }}
      onSetEnabled={async (item, enabled) => {
        context.agents.get(item.agent).setIntegrationEnabled(item, enabled);
        return `${label} 已${enabled ? '启用' : '禁用'}：${item.name}`;
      }}
      onClearScreen={() => clearScreen()}
    />);
    clearScreen = app.clear;
    await app.waitUntilExit();
    return;
  }
  listResources(adapters, kind, label, options.project);
}

function copyResource(context: CommandContext, item: IntegrationItem, target: AgentId, project: string | undefined, scope: 'user' | 'project'): string {
  const adapter = context.agents.get(target);
  if (item.kind === 'skill') adapter.installSkill(item.location, scope, project);
  else if (item.kind === 'plugin') adapter.installPlugin(item.name, scope);
  else adapter.addMcp(item.name, context.agents.get(item.agent).readMcpConfiguration(item), scope, project);
  return `${item.kind === 'skill' ? 'Skill' : item.kind === 'plugin' ? 'Plugin' : 'MCP'} 已复制到 ${target}（${scope === 'project' ? '当前目录' : '全局'}）：${item.name}`;
}

function loadResourceItems(context: CommandContext, kind: ResourceKind, agent: AgentId | undefined, project: string | undefined, onProgress: (message: string) => void): Promise<readonly IntegrationItem[]> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(fileURLToPath(new URL('../integrations/resource-loader-worker.js', import.meta.url)), { workerData: { homeDirectory: process.env.HOME || process.env.USERPROFILE || '', kind, ...(agent ? { agent } : {}), ...(project ? { project } : {}) } });
    worker.on('message', (message: unknown) => {
      if (!isWorkerMessage(message)) return;
      if (message.type === 'progress') return onProgress(message.message);
      if (message.type === 'complete') return resolve(message.items);
      reject(new Error(message.message));
    });
    worker.on('error', reject);
    worker.on('exit', (code) => { if (code !== 0) reject(new Error(`资源扫描进程异常退出：${code}`)); });
  });
}

function isWorkerMessage(value: unknown): value is { type: 'progress'; message: string } | { type: 'complete'; items: readonly IntegrationItem[] } | { type: 'error'; message: string } {
  return typeof value === 'object' && value !== null && typeof (value as { type?: unknown }).type === 'string';
}

function listResources(adapters: readonly { readonly name: string; listIntegrations(project?: string): readonly IntegrationItem[] }[], kind: ResourceKind, label: string, project: string | undefined): void {
  adapters.forEach((adapter) => {
    const resources = adapter.listIntegrations(project).filter((item) => item.kind === kind);
    console.log(chalk.bold(`\n${adapter.name} · ${label}`));
    if (!resources.length) console.log(chalk.gray(`  未发现 ${label}。`));
    resources.forEach((item) => console.log(`  ${item.name} · ${item.scope} · ${item.location}`));
  });
}

function findResource(context: CommandContext, kind: ResourceKind, value: string, project?: string): IntegrationItem {
  const [agentName, ...nameParts] = value.split(':');
  validateAgent(agentName);
  const name = nameParts.join(':');
  if (!name) throw new Error('--remove 格式为 <agent>:<name>。');
  const item = context.agents.get(agentName).listIntegrations(project).find((candidate) => candidate.kind === kind && candidate.name === name);
  if (!item) throw new Error(`未找到 ${kind}：${value}`);
  if (!item.removable) throw new Error(`当前 ${kind} 不支持移除：${value}`);
  return item;
}

function requireAgent(agent: AgentId | undefined, action: string): AgentId {
  if (!agent) throw new Error(`${action}时必须通过 --agent 指定目标 Agent。`);
  return agent;
}

function validateAgent(agent: string | undefined): asserts agent is AgentId | undefined {
  if (agent && !['claude', 'codex', 'opencode'].includes(agent)) throw new Error('Agent 必须为 claude、codex 或 opencode。');
}

function validateScope(scope: string | undefined): asserts scope is 'user' | 'project' | undefined {
  if (scope && scope !== 'user' && scope !== 'project') throw new Error('scope 必须为 user 或 project。');
}
