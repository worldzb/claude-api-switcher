import { confirm, isCancel } from '@clack/prompts';
import chalk from 'chalk';
import type { Command } from 'commander';

import type { AgentId, IntegrationItem } from '../agents/types.js';
import type { CommandContext } from './context.js';

interface IntegrationOptions {
  readonly agent?: AgentId;
  readonly project?: string;
  readonly installPlugin?: string;
  readonly installSkill?: string;
  readonly addMcp?: string;
  readonly mcpConfig?: string;
  readonly remove?: string;
  readonly scope?: 'user' | 'project';
}

export function registerIntegrationsCommand(program: Command, context: CommandContext): void {
  program
    .command('integrations')
    .alias('manage')
    .description('🧩 查看和管理 Agent 的插件、Skills 与 MCP')
    .option('-a, --agent <agent>', '筛选 Agent：claude、codex、opencode')
    .option('--project <path>', '包含项目级配置')
    .option('--install-plugin <plugin>', '安装插件')
    .option('--install-skill <path>', '从本地目录安装 Skill')
    .option('--add-mcp <name>', '添加 MCP 服务')
    .option('--mcp-config <json>', 'MCP JSON 配置')
    .option('--remove <agent:kind:name>', '移除资源')
    .option('--scope <scope>', '安装范围：user、project', 'user')
    .action(async (options: IntegrationOptions) => {
      validateAgent(options.agent);
      validateScope(options.scope);
      if (options.installPlugin) {
        const agent = requireAgent(options.agent);
        const accepted = await confirm({
          message: `为 ${agent} ${options.scope === 'project' ? '项目范围' : '用户范围'}安装插件 "${options.installPlugin}"？`,
          initialValue: false,
        });
        if (isCancel(accepted) || !accepted) return;
        context.agents.get(agent).installPlugin(options.installPlugin, options.scope || 'user');
        console.log(chalk.green('插件安装命令已完成。'));
        return;
      }
      if (options.installSkill) {
        const agent = requireAgent(options.agent);
        const accepted = await confirm({ message: `为 ${agent} 安装本地 Skill "${options.installSkill}"？`, initialValue: false });
        if (isCancel(accepted) || !accepted) return;
        context.agents.get(agent).installSkill(options.installSkill, options.scope || 'user', options.project);
        console.log(chalk.green('Skill 安装完成。'));
        return;
      }
      if (options.addMcp) {
        const agent = requireAgent(options.agent);
        if (!options.mcpConfig) throw new Error('--add-mcp 必须同时提供 --mcp-config。');
        const accepted = await confirm({ message: `为 ${agent} 添加 MCP "${options.addMcp}"？`, initialValue: false });
        if (isCancel(accepted) || !accepted) return;
        context.agents.get(agent).addMcp(options.addMcp, options.mcpConfig, options.scope || 'user', options.project);
        console.log(chalk.green('MCP 添加完成。'));
        return;
      }
      if (options.remove) {
        const item = findIntegration(context, options.remove, options.project);
        const accepted = await confirm({ message: `移除 ${item.agent} ${item.kind} "${item.name}"？`, initialValue: false });
        if (isCancel(accepted) || !accepted) return;
        context.agents.get(item.agent).removeIntegration(item);
        console.log(chalk.green('资源已移除。'));
        return;
      }
      listIntegrations(context, options.agent, options.project);
    });
}

function listIntegrations(context: CommandContext, filter: AgentId | undefined, project: string | undefined): void {
  const adapters = filter ? [context.agents.get(filter)] : context.agents.all();
  adapters.forEach((adapter) => {
    const items = adapter.listIntegrations(project);
    console.log(chalk.bold(`\n${adapter.name}`));
    if (!items.length) {
      console.log(chalk.gray('  未发现 plugins、skills 或 MCP。'));
      return;
    }
    items.forEach((item) => console.log(`  [${item.kind}] ${item.name} · ${item.scope} · ${item.location}`));
  });
}

function findIntegration(context: CommandContext, value: string, project: string | undefined): IntegrationItem {
  const [agent, kind, ...nameParts] = value.split(':');
  const name = nameParts.join(':');
  if (!agent || !kind || !name) throw new Error('--remove 应为 <agent>:<kind>:<name>。');
  validateAgent(agent);
  const item = context.agents.get(agent).listIntegrations(project).find((candidate) => candidate.kind === kind && candidate.name === name);
  if (!item) throw new Error(`未找到资源：${value}`);
  if (!item.removable) throw new Error(`当前版本不支持移除：${value}`);
  return item;
}

function requireAgent(agent: AgentId | undefined): AgentId {
  if (!agent) throw new Error('安装插件时必须通过 --agent 指定目标 Agent。');
  return agent;
}

function validateAgent(agent: string | undefined): asserts agent is AgentId | undefined {
  if (agent && !['claude', 'codex', 'opencode'].includes(agent)) throw new Error('Agent 必须为 claude、codex 或 opencode。');
}

function validateScope(scope: string | undefined): asserts scope is 'user' | 'project' | undefined {
  if (scope && scope !== 'user' && scope !== 'project') throw new Error('scope 必须为 user 或 project。');
}
