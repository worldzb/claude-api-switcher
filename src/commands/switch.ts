import fs from 'node:fs';
import path from 'node:path';
import { cancel, intro, isCancel, note, outro, select } from '@clack/prompts';
import chalk from 'chalk';
import type { Command } from 'commander';

import {
  applyDefaultConfig,
  createTemporaryExports,
  readClaudeSettings,
  writeClaudeSettings,
} from '../claude/settings.js';
import { getConfig, setCurrentConfig } from '../config/config-data.js';
import type { ApiConfig } from '../config/types.js';
import { maskApiKey, printSuccess } from '../ui/output.js';
import type { CommandContext } from './context.js';

interface SwitchOptions {
  readonly interactive?: boolean;
  readonly name?: string;
  readonly temp?: boolean;
  readonly default?: boolean;
  readonly eval?: boolean;
}

export function registerSwitchCommand(program: Command, context: CommandContext, commandName = 'switch'): void {
  program
    .command(commandName)
    .alias('use')
    .description('🔄 切换 Claude API 配置')
    .option('-i, --interactive', '交互式选择')
    .option('-n, --name <name>', '配置名称')
    .option('-t, --temp', '临时使用（仅当前终端）')
    .option('-d, --default', '设为默认（修改 .claude/settings.json）')
    .option('-e, --eval', '输出 eval 可执行的命令（配合 -t 使用）')
    .action(async (options: SwitchOptions) => {
      if (options.eval && !options.temp) {
        throw new Error('--eval 只能与 --temp 一起使用。');
      }
      if (options.interactive || !options.name) {
        await interactiveSwitch(context, options);
        return;
      }
      switchNamedConfig(context, options.name, options.temp === true, options.eval === true);
    });
}

async function interactiveSwitch(context: CommandContext, options: SwitchOptions): Promise<void> {
  if (options.eval) {
    throw new Error('--eval 不能与交互式模式一起使用。');
  }

  console.clear();
  intro(chalk.cyan.bold('🔄 Claude API Switcher - 切换配置'));
  const data = context.repository.read();
  if (data.configs.length === 0) {
    return void outro(chalk.yellow('暂无配置，请先添加配置。'));
  }

  const selected = await select({
    message: '选择要切换的配置',
    options: data.configs.map((config) => ({
      value: config.name,
      label: `${config.name}${data.current === config.name ? ' (当前默认)' : ''}`,
      hint: maskApiKey(config.apiKey),
    })),
  });
  if (isCancel(selected)) return void cancel('操作已取消');
  const selectedName = String(selected);

  const mode = options.temp || options.default
    ? (options.temp ? 'temp' : 'default')
    : await select({
      message: '选择切换模式',
      options: [
        { value: 'temp', label: '🔹 临时使用（仅当前终端）', hint: '不影响默认配置' },
        { value: 'default', label: '🟢 设为默认（全局配置）', hint: '修改 Claude 设置，需要重启' },
      ],
    });
  if (isCancel(mode)) return void cancel('操作已取消');

  switchNamedConfig(context, selectedName, mode === 'temp', false);
  outro('');
}

function switchNamedConfig(context: CommandContext, name: string, temporary: boolean, evalMode: boolean): void {
  const data = context.repository.read();
  const config = getConfig(data, name);
  if (temporary) {
    switchTemporary(config, evalMode);
    return;
  }

  const updatedSettings = applyDefaultConfig(readClaudeSettings(context.claudeSettingsFile), config);
  writeClaudeSettings(context.claudeSettingsFile, updatedSettings);
  writeEnvironmentFile(context.environmentFile, config);
  context.repository.write(setCurrentConfig(data, name));
  printSuccess(`已将 "${name}" 设置为默认配置`);
  note(
    `配置: ${name}\nAPI Key: ${maskApiKey(config.apiKey)}\nBase URL: ${config.baseUrl}\n\n已更新：\n~/.claude/settings.json\n~/.claude-switch-config/.claude-env\n\n需要重启 Claude Code 才能生效。`,
    '默认配置已更新',
  );
}

function switchTemporary(config: ApiConfig, evalMode: boolean): void {
  const exports = createTemporaryExports(config);
  if (evalMode) {
    console.log(exports);
    return;
  }

  printSuccess(`临时使用配置 "${config.name}"`);
  console.log(chalk.cyan('\n在当前终端运行以下命令：\n'));
  console.log(exports);
  console.log(chalk.yellow(`\n或直接运行：\n   eval $(zmai switch -n ${JSON.stringify(config.name)} -t --eval)`));
}

function writeEnvironmentFile(filePath: string, config: ApiConfig): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
  fs.writeFileSync(filePath, `${createTemporaryExports(config)}\n`, { encoding: 'utf8', mode: 0o600 });
  fs.chmodSync(filePath, 0o600);
}
