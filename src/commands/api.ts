import type { Command } from 'commander';

import { registerAddCommand } from './add.js';
import type { CommandContext } from './context.js';
import { registerCurrentCommand } from './current.js';
import { registerDeleteCommand } from './delete.js';
import { registerListCommand } from './list.js';
import { registerSwitchCommand } from './switch.js';

export function registerApiCommand(program: Command, context: CommandContext): void {
  const api = program.command('api').description('🔑 管理 Claude API 配置');
  registerAddCommand(api, context);
  registerListCommand(api, context);
  registerSwitchCommand(api, context);
  registerDeleteCommand(api, context);
  registerCurrentCommand(api, context);
}
