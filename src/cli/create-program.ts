import { Command } from 'commander';
import chalk from 'chalk';

import { registerAddCommand } from '../commands/add.js';
import { registerAgentsCommand } from '../commands/agents.js';
import type { CommandContext } from '../commands/context.js';
import { registerCurrentCommand } from '../commands/current.js';
import { registerDeleteCommand } from '../commands/delete.js';
import { registerHistoryCommand } from '../commands/history.js';
import { registerIntegrationsCommand } from '../commands/integrations.js';
import { registerListCommand } from '../commands/list.js';
import { registerMigrateCommand } from '../commands/migrate.js';
import { registerSessionsCommand } from '../commands/sessions.js';
import { registerSwitchCommand } from '../commands/switch.js';

export function createProgram(context: CommandContext): Command {
  const program = new Command();
  program
    .name('zmai')
    .description('🤖 多 Agent 会话与 Claude API 配置管理工具')
    .version('1.3.0')
    .addHelpText('beforeAll', chalk.cyan.bold('\n╔══════════════════════════════════════╗\n║        ZMAI Agent Workspace          ║\n╚══════════════════════════════════════╝\n'))
    .addHelpText('after', chalk.gray('\n💡 历史会话：zmai history\n💡 Agent 扫描：zmai agents\n💡 集成管理：zmai integrations\n'));

  registerAgentsCommand(program, context);
  registerHistoryCommand(program, context);
  registerSessionsCommand(program, context);
  registerMigrateCommand(program, context);
  registerIntegrationsCommand(program, context);
  registerAddCommand(program, context);
  registerListCommand(program, context);
  registerSwitchCommand(program, context);
  registerDeleteCommand(program, context);
  registerCurrentCommand(program, context);

  return program;
}
