import chalk from 'chalk';
import type { Command } from 'commander';

import { findActiveConfig, readClaudeSettings } from '../claude/settings.js';
import { maskApiKey } from '../ui/output.js';
import type { CommandContext } from './context.js';

export function registerCurrentCommand(program: Command, context: CommandContext, commandName = 'current'): void {
  program
    .command(commandName)
    .description('👀 查看当前 Claude 配置')
    .action(() => showCurrentConfig(context));
}

function showCurrentConfig(context: CommandContext): void {
  const data = context.repository.read();
  const settings = readClaudeSettings(context.claudeSettingsFile);
  const activeConfig = findActiveConfig(data.configs, settings);
  const authToken = settings.env?.ANTHROPIC_AUTH_TOKEN;
  const baseUrl = settings.env?.ANTHROPIC_BASE_URL;

  console.log(chalk.hex('#7C3AED').bold('\n🟣 Claude Code 当前配置'));
  console.log(chalk.gray('━━━━━━━━━━━━━━━━━━━━━━━━━━'));
  if (activeConfig) {
    console.log(`名称: ${activeConfig.name}`);
    console.log(`API Key: ${maskApiKey(activeConfig.apiKey)}`);
    console.log(`Base URL: ${activeConfig.baseUrl}`);
  } else if (typeof authToken === 'string') {
    console.log(`API Key: ${maskApiKey(authToken)}`);
    console.log(`Base URL: ${typeof baseUrl === 'string' ? baseUrl : '(默认)'}`);
    console.log(chalk.gray('（未匹配到已保存的配置）'));
  } else {
    console.log(chalk.yellow('未配置'));
  }
  console.log('');
}
