import { cancel, confirm, intro, isCancel, note, outro, text } from '@clack/prompts';
import chalk from 'chalk';
import type { Command } from 'commander';

import { addConfig, createApiConfig } from '../config/config-data.js';
import { maskApiKey, printSuccess } from '../ui/output.js';
import type { CommandContext } from './context.js';

interface AddOptions {
  readonly interactive?: boolean;
  readonly name?: string;
  readonly key?: string;
  readonly url?: string;
}

export function registerAddCommand(program: Command, context: CommandContext, commandName = 'add'): void {
  program
    .command(commandName)
    .description('➕ 添加新的 Claude API 配置')
    .option('-i, --interactive', '交互式添加（推荐）')
    .option('-n, --name <name>', '配置名称')
    .option('-k, --key <key>', 'API Key')
    .option('-u, --url <url>', 'Base URL')
    .action(async (options: AddOptions) => {
      if (options.interactive || !options.name || !options.key) {
        await interactiveAdd(context);
        return;
      }
      saveConfig(context, createApiConfig({
        name: options.name,
        apiKey: options.key,
        baseUrl: options.url,
        createdAt: new Date().toISOString(),
      }));
    });
}

async function interactiveAdd(context: CommandContext): Promise<void> {
  console.clear();
  intro(chalk.cyan.bold('🤖 Claude API Switcher - 添加新配置'));
  const existingNames = context.repository.read().configs.map((config) => config.name);

  const name = await text({
    message: '📝 配置名称',
    placeholder: '例如: 官方 API、代理 API',
    validate: (value) => !value ? '请输入配置名称' : existingNames.includes(value) ? `配置 "${value}" 已存在` : undefined,
  });
  if (isCancel(name)) return void cancel('操作已取消');

  const apiKey = await text({
    message: '🔑 API Key',
    placeholder: 'sk-ant-api03-xxx',
    validate: (value) => !value ? '请输入 API Key' : value.length < 10 ? 'API Key 格式不正确' : undefined,
  });
  if (isCancel(apiKey)) return void cancel('操作已取消');

  const baseUrl = await text({
    message: '🌐 Base URL',
    initialValue: 'https://api.anthropic.com',
    validate: (value) => {
      try {
        new URL(value);
      } catch {
        return 'URL 格式不正确';
      }
      return undefined;
    },
  });
  if (isCancel(baseUrl)) return void cancel('操作已取消');

  const config = createApiConfig({ name, apiKey, baseUrl, createdAt: new Date().toISOString() });
  note(`名称: ${config.name}\nAPI Key: ${maskApiKey(config.apiKey)}\nBase URL: ${config.baseUrl}`, '配置预览');
  const accepted = await confirm({ message: '确认添加此配置？', initialValue: true });
  if (isCancel(accepted) || !accepted) return void cancel('已取消添加');

  saveConfig(context, config);
  outro(chalk.green('✅ 配置添加成功！'));
}

function saveConfig(context: CommandContext, config: ReturnType<typeof createApiConfig>): void {
  context.repository.write(addConfig(context.repository.read(), config));
  printSuccess(`配置 "${config.name}" 已添加！`);
}
