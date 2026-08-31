import { cancel, confirm, intro, isCancel, outro, select } from '@clack/prompts';
import chalk from 'chalk';
import type { Command } from 'commander';

import { deleteConfig } from '../config/config-data.js';
import { maskApiKey, printSuccess } from '../ui/output.js';
import type { CommandContext } from './context.js';

interface DeleteOptions {
  readonly interactive?: boolean;
  readonly name?: string;
}

export function registerDeleteCommand(program: Command, context: CommandContext): void {
  program
    .command('delete')
    .alias('rm')
    .description('🗑️ 删除配置')
    .option('-i, --interactive', '交互式删除')
    .option('-n, --name <name>', '配置名称')
    .action(async (options: DeleteOptions) => {
      if (options.interactive || !options.name) {
        await interactiveDelete(context);
        return;
      }
      removeConfig(context, options.name);
    });
}

async function interactiveDelete(context: CommandContext): Promise<void> {
  console.clear();
  intro(chalk.cyan.bold('🗑️ Claude API Switcher - 删除配置'));
  const data = context.repository.read();
  if (data.configs.length === 0) {
    return void outro(chalk.yellow('暂无配置。'));
  }

  const selected = await select({
    message: '选择要删除的配置',
    options: data.configs.map((config) => ({
      value: config.name,
      label: `${config.name}${data.current === config.name ? ' (当前默认)' : ''}`,
      hint: maskApiKey(config.apiKey),
    })),
  });
  if (isCancel(selected)) return void cancel('操作已取消');
  const selectedName = String(selected);

  const accepted = await confirm({ message: `确认删除配置 "${selectedName}"？`, initialValue: false });
  if (isCancel(accepted) || !accepted) return void cancel('已取消删除');

  removeConfig(context, selectedName);
  outro(chalk.green('✅ 配置已删除！'));
}

function removeConfig(context: CommandContext, name: string): void {
  context.repository.write(deleteConfig(context.repository.read(), name));
  printSuccess(`配置 "${name}" 已删除！`);
}
