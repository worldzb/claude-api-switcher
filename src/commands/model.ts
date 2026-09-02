import fs from 'node:fs';
import path from 'node:path';
import { cancel, intro, isCancel, note, outro, select } from '@clack/prompts';
import chalk from 'chalk';
import type { Command } from 'commander';

import { findExecutable, runCommand } from '../agents/process-runner.js';
import { applyModelPickerSetting, clearModelPickerSetting, clearModelSetting, isBuiltinModel } from '../claude/models.js';
import { readClaudeSettings, writeClaudeSettings } from '../claude/settings.js';
import {
  applyCodexModelCatalog,
  buildCodexModelCatalog,
  clearCodexModel,
  clearCodexModelCatalog,
  readCodexConfig,
  resolveCodexCatalogFile,
  writeCodexConfig,
} from '../codex/config.js';
import {
  OPENCODE_PROVIDER_ID,
  readOpenCodeConfig,
  registerProviderModels,
  unregisterProviderModels,
  writeOpenCodeConfig,
} from '../opencode/config.js';
import { printSuccess } from '../ui/output.js';
import type { CommandContext } from './context.js';

interface ModelOptions {
  readonly agent?: string;
  readonly reset?: boolean;
}

const SYNC_AGENTS = ['opencode', 'claude', 'codex', 'all'] as const;
type SyncAgent = (typeof SYNC_AGENTS)[number];

const ACTION_SYNC = 'sync';
const ACTION_RESET = 'reset';

const AGENT_OPTIONS = [
  { value: 'opencode', label: 'OpenCode', hint: '模型注册到 opencode.jsonc 的 wxhand provider' },
  { value: 'claude', label: 'Claude Code', hint: '模型批量写入 /model 选择器（modelPicker）' },
  { value: 'codex', label: 'Codex', hint: '模型批量写入 /model 选择器（model_catalog_json）' },
  { value: 'all', label: '全部 Agent', hint: '依次处理 OpenCode、Claude Code 与 Codex' },
] as const;

export function registerModelCommand(program: Command, context: CommandContext): void {
  program
    .command('model')
    .description('🔀 模型同步（把配置中的自定义模型批量设置到各 Agent，或恢复系统默认）')
    .option('-a, --agent <agent>', '直接指定 Agent：opencode / claude / codex / all，省略则交互式选择')
    .option('--reset', '恢复系统默认：撤回已同步到 Agent 的模型配置（配合 -a 或交互选择）')
    .action((options: ModelOptions) => runModel(context, options));
}

async function runModel(context: CommandContext, options: ModelOptions): Promise<void> {
  const interactive = options.agent === undefined;
  let agent: SyncAgent;
  let reset = options.reset === true;

  if (!interactive) {
    agent = parseSyncAgent(options.agent ?? '');
  } else {
    console.clear();
    intro(chalk.cyan.bold('🔀 模型同步'));
    const selected = await select({ message: '选择 Agent', options: [...AGENT_OPTIONS] });
    if (isCancel(selected)) return void cancel('操作已取消');
    agent = selected as SyncAgent;

    if (!reset) {
      const action = await select({
        message: '选择操作',
        options: [
          { value: ACTION_SYNC, label: '🔄 同步', hint: `把配置中的自定义模型设置到 ${labelOf(agent)}` },
          { value: ACTION_RESET, label: '↩️ 恢复默认', hint: `撤回已同步到 ${labelOf(agent)} 的模型配置` },
        ],
      });
      if (isCancel(action)) return void cancel('操作已取消');
      reset = action === ACTION_RESET;
    }
  }

  if (reset) {
    if (agent !== 'claude' && agent !== 'codex') resetOpenCodeModels(context);
    if (agent !== 'opencode' && agent !== 'codex') resetClaudeModels(context);
    if (agent !== 'opencode' && agent !== 'claude') resetCodexModels(context);
  } else {
    if (agent !== 'claude' && agent !== 'codex') syncOpenCodeModels(context);
    if (agent !== 'opencode' && agent !== 'codex') syncClaudeModels(context);
    if (agent !== 'opencode' && agent !== 'claude') syncCodexModels(context);
  }

  if (interactive) {
    outro('');
  }
}

function labelOf(agent: SyncAgent): string {
  return AGENT_OPTIONS.find((option) => option.value === agent)?.label ?? agent;
}

function parseSyncAgent(value: string): SyncAgent {
  const agent = value.trim().toLowerCase();
  if (!(SYNC_AGENTS as readonly string[]).includes(agent)) {
    throw new Error(`未知的 Agent "${value}"，可选：${SYNC_AGENTS.join(' / ')}。`);
  }
  return agent as SyncAgent;
}

function syncOpenCodeModels(context: CommandContext): void {
  const models = context.repository.read().customModels.opencode;
  if (models.length === 0) {
    console.log(chalk.yellow('配置中没有 OpenCode 自定义模型，请在 ~/.claude-switch-config/claude-configs.json 的 customModels.opencode 中添加后再同步。'));
    return;
  }

  const config = readOpenCodeConfig(context.opencodeConfigFile);
  const result = registerProviderModels(config, models, OPENCODE_PROVIDER_ID);
  if (result.added.length === 0) {
    printSuccess(`OpenCode 模型已是最新，${result.existing.length} 个模型均已注册，无需同步。`);
    return;
  }

  writeOpenCodeConfig(context.opencodeConfigFile, result.config);
  for (const name of result.added) {
    printSuccess(`OpenCode 已注册模型 "${name}"`);
  }
  if (result.existing.length > 0) {
    console.log(chalk.gray(`已注册跳过 ${result.existing.length} 个：${result.existing.join(', ')}`));
  }
  console.log(chalk.gray(`已更新：${context.opencodeConfigFile}`));
  console.log(chalk.gray('需要重启 OpenCode 才能生效。'));
}

function syncClaudeModels(context: CommandContext): void {
  const models = context.repository.read().customModels.claude.filter((model) => !isBuiltinModel(model));
  if (models.length === 0) {
    console.log(chalk.yellow('配置中没有 Claude 自定义模型，请在 ~/.claude-switch-config/claude-configs.json 的 customModels.claude 中添加后再同步。'));
    return;
  }

  const settings = readClaudeSettings(context.claudeSettingsFile);
  writeClaudeSettings(context.claudeSettingsFile, applyModelPickerSetting(settings, models));
  printSuccess(`Claude Code /model 选择器已同步 ${models.length} 个自定义模型`);
  console.log(chalk.gray(models.join(', ')));
  console.log(chalk.gray(`已更新：${context.claudeSettingsFile} 的 modelPicker`));
  note('在 Claude Code 中用 /model 选择要使用的模型：\nEnter 保存为默认（新会话生效），s 仅当前会话生效。', '模型已同步');
}

function syncCodexModels(context: CommandContext): void {
  const models = context.repository.read().customModels.codex;
  if (models.length === 0) {
    console.log(chalk.yellow('配置中没有 Codex 自定义模型，请在 ~/.claude-switch-config/claude-configs.json 的 customModels.codex 中添加后再同步。'));
    return;
  }

  const bundled = dumpBundledCodexCatalog();
  if (bundled === undefined) {
    console.log(chalk.yellow('未找到可用的 codex 命令（或版本过旧），无法合并内置模型：/model 列表将只包含自定义模型。'));
  }
  const result = buildCodexModelCatalog(models, bundled);

  const catalogFile = resolveCodexCatalogFile(context.codexConfigFile);
  fs.mkdirSync(path.dirname(catalogFile), { recursive: true });
  fs.writeFileSync(catalogFile, `${JSON.stringify(result.catalog, null, 2)}\n`, 'utf8');

  const source = readCodexConfig(context.codexConfigFile);
  writeCodexConfig(context.codexConfigFile, applyCodexModelCatalog(source, catalogFile));

  printSuccess(`Codex /model 选择器已同步 ${result.added.length} 个自定义模型`);
  console.log(chalk.gray(result.added.join(', ')));
  if (result.skipped.length > 0) {
    console.log(chalk.gray(`与内置重复跳过 ${result.skipped.length} 个：${result.skipped.join(', ')}`));
  }
  if (result.bundledCount > 0) {
    console.log(chalk.gray(`内置模型保留 ${result.bundledCount} 个（与自定义模型并列显示）`));
  }
  console.log(chalk.gray(`已更新：${catalogFile}`));
  console.log(chalk.gray(`已更新：${context.codexConfigFile} 的 model_catalog_json`));
  note('在 Codex 中用 /model 选择要使用的模型（需重启 Codex 生效）。', '模型已同步');
}

/** 导出 codex 内置模型目录（含官方提示词模板），供自定义模型克隆与合并；失败返回 undefined。 */
function dumpBundledCodexCatalog(): unknown {
  const executable = findExecutable('codex');
  if (!executable) {
    return undefined;
  }
  try {
    return JSON.parse(runCommand(executable, ['debug', 'models', '--bundled']));
  } catch {
    return undefined;
  }
}

function resetOpenCodeModels(context: CommandContext): void {
  const models = context.repository.read().customModels.opencode;
  const result = unregisterProviderModels(readOpenCodeConfig(context.opencodeConfigFile), models, OPENCODE_PROVIDER_ID);
  if (result.removed.length === 0) {
    printSuccess('OpenCode 没有需要撤回的已同步模型。');
    return;
  }

  writeOpenCodeConfig(context.opencodeConfigFile, result.config);
  for (const name of result.removed) {
    printSuccess(`OpenCode 已移除模型 "${name}"`);
  }
  if (result.modelCleared) {
    printSuccess('已清除 model 设置，恢复 OpenCode 默认');
  }
  console.log(chalk.gray(`已更新：${context.opencodeConfigFile}`));
}

function resetClaudeModels(context: CommandContext): void {
  const settings = readClaudeSettings(context.claudeSettingsFile);
  if (settings.model === undefined && settings.modelPicker === undefined) {
    printSuccess('Claude Code 已是官方默认。');
    return;
  }

  writeClaudeSettings(context.claudeSettingsFile, clearModelPickerSetting(clearModelSetting(settings)));
  printSuccess('已清除 model 与 modelPicker，恢复 Claude Code 官方默认');
  console.log(chalk.gray(`已更新：${context.claudeSettingsFile}`));
  console.log(chalk.gray('需要重启 Claude Code 才能生效。'));
}

function resetCodexModels(context: CommandContext): void {
  const source = readCodexConfig(context.codexConfigFile);
  const catalog = clearCodexModelCatalog(source);
  const cleared = clearCodexModel(catalog.content);

  const catalogFile = resolveCodexCatalogFile(context.codexConfigFile);
  const catalogFileExisted = fs.existsSync(catalogFile);
  if (catalogFileExisted) {
    fs.rmSync(catalogFile);
  }

  if (!catalog.removed && cleared === source && !catalogFileExisted) {
    printSuccess('Codex 已是默认模型。');
    return;
  }

  writeCodexConfig(context.codexConfigFile, cleared);
  if (catalog.removed) {
    printSuccess('已移除 model_catalog_json，内置模型回归 /model 选择器');
  }
  if (catalogFileExisted) {
    printSuccess(`已删除 ${catalogFile}`);
  }
  if (cleared !== source) {
    printSuccess('已移除 model 行，恢复 Codex 默认');
  }
  console.log(chalk.gray(`已更新：${context.codexConfigFile}`));
  console.log(chalk.gray('需要重启 Codex 才能生效。'));
}
