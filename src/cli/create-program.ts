import { Command } from 'commander';
import chalk from 'chalk';

import { registerAddCommand } from '../commands/add.js';

import { registerAgentsCommand } from '../commands/agents.js';
import { registerApiCommand } from '../commands/api.js';
import type { CommandContext } from '../commands/context.js';
import { registerHistoryCommand } from '../commands/history.js';
import { registerResourceCommands } from '../commands/resources.js';
import { registerMigrateCommand } from '../commands/migrate.js';
import { registerSessionsCommand } from '../commands/sessions.js';

export function createProgram(context: CommandContext): Command {
  const program = new Command();
  program
    .name('zmai')
    .description('🤖 多 Agent 会话与 Claude API 配置管理工具')
    .version('1.3.0')
    .addHelpText('beforeAll', chalk.cyan.bold('\n╔══════════════════════════════════════╗\n║        ZMAI Agent Workspace          ║\n╚══════════════════════════════════════╝\n'))
    .addHelpText('after', chalk.gray('\n💡 历史会话：zmai history\n💡 Agent 扫描：zmai agents\n💡 集成管理：zmai mcps / zmai skills / zmai plugins\n💡 API 配置：zmai api --help\n'));

  registerAgentsCommand(program, context);
  registerHistoryCommand(program, context);
  registerSessionsCommand(program, context);
  registerMigrateCommand(program, context);
  registerResourceCommands(program, context);
  registerApiCommand(program, context);

  return program;
}
