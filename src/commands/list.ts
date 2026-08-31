import chalk from 'chalk';
import type { Command } from 'commander';

import { findActiveConfig, readClaudeSettings } from '../claude/settings.js';
import { maskApiKey } from '../ui/output.js';
import type { CommandContext } from './context.js';

export function registerListCommand(program: Command, context: CommandContext): void {
  program
    .command('list')
    .alias('ls')
    .description('📋 列出所有 Claude 配置')
    .action(() => listConfigs(context));
}

function listConfigs(context: CommandContext): void {
  const data = context.repository.read();
  if (data.configs.length === 0) {
    console.log(chalk.yellow('暂无配置，请先添加配置。'));
    return;
  }

  const activeConfig = findActiveConfig(data.configs, readClaudeSettings(context.claudeSettingsFile));
  console.log(chalk.bold('\n📋 可用配置：\n'));
  data.configs.forEach((config) => {
    const isActive = activeConfig?.name === config.name;
    const isDefault = data.current === config.name;
    const icon = isActive ? '🟢' : isDefault ? '🔵' : '⚪';
    const status = isActive
      ? (isDefault ? chalk.green(' (当前默认)') : chalk.yellow(' (使用中)'))
      : (isDefault ? chalk.gray(' (已设为默认)') : '');

    console.log(`${icon}  ${chalk.hex('#7C3AED')('[Claude]')} ${chalk.bold(config.name)}${status}`);
    console.log(`   🔑 API Key: ${chalk.gray(maskApiKey(config.apiKey))}`);
    console.log(`   🌐 Base URL: ${chalk.blue(config.baseUrl)}`);
    console.log('');
  });
}
