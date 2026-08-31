import { cancel, confirm, isCancel, select } from '@clack/prompts';
import chalk from 'chalk';
import type { Command } from 'commander';

import type { AgentId } from '../agents/types.js';
import { parseSessionId } from '../history/session-service.js';
import { migrateAndLaunch } from './history.js';
import type { CommandContext } from './context.js';

interface MigrateOptions {
  readonly to?: AgentId;
}

export function registerMigrateCommand(program: Command, context: CommandContext): void {
  program
    .command('migrate <session>')
    .description('🔀 将历史会话转换为新 Agent 会话')
    .option('--to <agent>', '目标 Agent：claude、codex、opencode')
    .action(async (sessionId: string, options: MigrateOptions) => {
      const parsed = parseSessionId(sessionId);
      const source = context.agents.get(parsed.agent).listSessions().find((session) => session.id === parsed.id);
      if (!source) throw new Error(`未找到会话：${sessionId}`);
      const target = options.to || await select({
        message: '选择目标 Agent',
        initialValue: parsed.agent,
        options: context.agents.all().filter((adapter) => adapter.discover().installed).map((adapter) => ({ value: adapter.id, label: adapter.name })),
      });
      if (isCancel(target)) return void cancel('已取消迁移');
      validateAgent(target);
      const result = await migrateAndLaunch(context, source, target);
      if (!result.launch) {
        console.log(chalk.gray(result.message));
        return;
      }
      const [command, ...args] = result.launch.command;
      if (!command) throw new Error('启动命令为空。');
      console.log(chalk.gray('原会话未被修改。'));
      const { spawnSync } = await import('node:child_process');
      const launched = spawnSync(command, args, { cwd: result.launch.cwd, stdio: 'inherit' });
      if (launched.error) throw new Error(`无法启动 ${command}：${launched.error.message}`);
    });
}

function validateAgent(agent: string): asserts agent is AgentId {
  if (!['claude', 'codex', 'opencode'].includes(agent)) {
    throw new Error('目标 Agent 必须为 claude、codex 或 opencode。');
  }
}
