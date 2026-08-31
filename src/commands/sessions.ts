import { confirm, isCancel } from '@clack/prompts';
import chalk from 'chalk';
import type { Command } from 'commander';

import { describeManagedSession } from '../sessions/session-monitor.js';
import type { CommandContext } from './context.js';

interface SessionsOptions {
  readonly watch?: string;
  readonly stop?: string;
}

export function registerSessionsCommand(program: Command, context: CommandContext): void {
  program
    .command('sessions')
    .description('📡 查看 zmai 启动的托管会话')
    .option('--watch <id>', '显示托管会话的最新状态和输出')
    .option('--stop <id>', '停止托管会话')
    .action(async (options: SessionsOptions) => {
      if (options.watch) {
        showSession(context, options.watch);
        return;
      }
      if (options.stop) {
        const accepted = await confirm({ message: `停止托管会话 "${options.stop}"？`, initialValue: false });
        if (isCancel(accepted) || !accepted) return;
        context.sessionLauncher.stop(context.managedSessions.get(options.stop));
        console.log(chalk.green('托管会话已停止。'));
        return;
      }
      const sessions = context.managedSessions.read();
      if (!sessions.length) {
        console.log(chalk.yellow('暂无由 zmai 启动的托管会话。'));
        return;
      }
      sessions.forEach((session) => {
        const status = context.sessionLauncher.status(session);
        console.log(`${status === 'running' ? '🟢' : '⚪'} ${session.id} [${session.agent}] ${status}`);
        console.log(`   ${session.cwd} · ${session.createdAt}`);
      });
    });

  program
    .command('watch <id>')
    .description('👀 查看托管会话进度和最新输出')
    .action((id: string) => showSession(context, id));

  program
    .command('stop <id>')
    .description('⏹ 停止托管会话')
    .action(async (id: string) => {
      const accepted = await confirm({ message: `停止托管会话 "${id}"？`, initialValue: false });
      if (isCancel(accepted) || !accepted) return;
      context.sessionLauncher.stop(context.managedSessions.get(id));
      console.log(chalk.green('托管会话已停止。'));
    });
}

function showSession(context: CommandContext, id: string): void {
  const session = context.managedSessions.get(id);
  console.log(describeManagedSession(session, context.sessionLauncher));
}
