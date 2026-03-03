#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { Command } from 'commander';
import chalk from 'chalk';
import {
  intro,
  outro,
  text,
  select,
  confirm,
  cancel,
  isCancel,
  note,
} from '@clack/prompts';

// 配置目录和文件路径
const CONFIG_DIR = path.join(process.env.HOME, '.claude-switch-config');
const CONFIG_FILE = path.join(CONFIG_DIR, 'claude-configs.json');
const ENV_FILE = path.join(CONFIG_DIR, '.claude-env');
const CLAUDE_SETTINGS_FILE = path.join(process.env.HOME, '.claude', 'settings.json');

// 确保配置目录存在
function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

// 读取配置文件
function readConfigs() {
  ensureConfigDir();
  if (!fs.existsSync(CONFIG_FILE)) {
    return { configs: [], current: null };
  }
  try {
    const data = fs.readFileSync(CONFIG_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return { configs: [], current: null };
  }
}

// 写入配置文件
function writeConfigs(configs) {
  ensureConfigDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(configs, null, 2), 'utf8');
}

// 隐藏 API Key 显示
function maskApiKey(key) {
  if (key.length <= 8) return '****';
  return key.substring(0, 8) + '...' + key.substring(key.length - 4);
}

// 添加新配置
async function addConfig(name, apiKey, baseUrl) {
  const configs = readConfigs();

  if (configs.configs.find((c) => c.name === name)) {
    console.log(chalk.red(`配置 "${name}" 已存在！`));
    return;
  }

  configs.configs.push({
    name,
    apiKey,
    baseUrl: baseUrl || 'https://api.anthropic.com',
    createdAt: new Date().toISOString(),
  });

  writeConfigs(configs);
  console.log(chalk.green(`✓ 配置 "${name}" 已添加！`));
}

// 列出所有配置
function listConfigs() {
  const configs = readConfigs();

  if (configs.configs.length === 0) {
    console.log(chalk.yellow('暂无配置，请先添加配置。'));
    return;
  }

  // 读取 Claude 设置以获取当前实际使用的配置
  const claudeSettings = readClaudeSettings();
  const currentApiKey = claudeSettings.env?.ANTHROPIC_AUTH_TOKEN;
  const currentBaseUrl = claudeSettings.env?.ANTHROPIC_BASE_URL;

  console.log(chalk.bold('\n📋 可用配置：\n'));
  configs.configs.forEach((config) => {
    const isCurrentDefault = configs.current === config.name;
    const isActualCurrent = currentApiKey === config.apiKey && currentBaseUrl === config.baseUrl;

    let icon = '⚪';
    let status = '';

    if (isActualCurrent) {
      icon = '🟢';
      status = isCurrentDefault ? chalk.green(' (当前默认)') : chalk.yellow(' (使用中)');
    } else if (isCurrentDefault) {
      icon = '🔵';
      status = chalk.gray(' (已设为默认)');
    }

    const maskedKey = maskApiKey(config.apiKey);

    console.log(`${icon}  ${chalk.bold(config.name)}${status}`);
    console.log(`   🔑 API Key: ${chalk.gray(maskedKey)}`);
    console.log(`   🌐 Base URL: ${chalk.blue(config.baseUrl)}`);
    console.log('');
  });
}

// 读取 Claude 设置文件
function readClaudeSettings() {
  if (!fs.existsSync(CLAUDE_SETTINGS_FILE)) {
    return { env: {} };
  }
  try {
    const data = fs.readFileSync(CLAUDE_SETTINGS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return { env: {} };
  }
}

// 写入 Claude 设置文件
function writeClaudeSettings(settings) {
  const settingsDir = path.dirname(CLAUDE_SETTINGS_FILE);
  if (!fs.existsSync(settingsDir)) {
    fs.mkdirSync(settingsDir, { recursive: true });
  }
  fs.writeFileSync(CLAUDE_SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8');
}

// 临时使用配置（只作用于当前终端）
function useConfigTemp(name, evalMode = false) {
  const configs = readConfigs();
  const config = configs.configs.find((c) => c.name === name);

  if (!config) {
    if (!evalMode) {
      console.log(chalk.red(`配置 "${name}" 不存在！`));
    }
    return;
  }

  if (evalMode) {
    // eval 模式：只输出纯命令，无任何格式
    console.log(`export ANTHROPIC_API_KEY="${config.apiKey}"`);
    console.log(`export ANTHROPIC_BASE_URL="${config.baseUrl}"`);
  } else {
    // 普通模式：显示友好的提示信息
    console.log(chalk.green(`✓ 临时使用配置 "${name}"`));
    console.log(chalk.gray(`─`.repeat(50)));
    console.log(chalk.cyan(`\n📝 在当前终端运行以下命令：\n`));
    console.log(chalk.white(`export ANTHROPIC_API_KEY="${config.apiKey}"`));
    console.log(chalk.white(`export ANTHROPIC_BASE_URL="${config.baseUrl}"`));
    console.log(chalk.gray(`\n💡 提示：此配置仅在当前终端会话中有效\n`));
    console.log(chalk.yellow(`\n🚀 或者直接运行：\n`));
    console.log(chalk.cyan(`   eval $(zcs switch -n "${name}" -t --eval)\n`));
  }
}

// 设置为默认配置（修改 .claude/settings.json）
function setDefaultConfig(name) {
  const configs = readConfigs();
  const config = configs.configs.find((c) => c.name === name);

  if (!config) {
    console.log(chalk.red(`配置 "${name}" 不存在！`));
    return;
  }

  // 更新当前配置
  configs.current = name;
  writeConfigs(configs);

  // 更新 .claude/settings.json
  const settings = readClaudeSettings();
  settings.env = settings.env || {};
  settings.env.ANTHROPIC_AUTH_TOKEN = config.apiKey;
  settings.env.ANTHROPIC_BASE_URL = config.baseUrl;
  writeClaudeSettings(settings);

  // 同时更新环境变量文件
  const envContent = `export ANTHROPIC_API_KEY="${config.apiKey}"\nexport ANTHROPIC_BASE_URL="${config.baseUrl}"\n`;
  ensureConfigDir();
  fs.writeFileSync(ENV_FILE, envContent);

  console.log(chalk.green(`✓ 已将 "${name}" 设置为默认配置`));
  console.log(chalk.gray(`─`.repeat(50)));
  console.log(chalk.cyan(`\n📝 已更新文件：`));
  console.log(chalk.gray(`   • ~/.claude/settings.json`));
  console.log(chalk.gray(`   • ~/.claude-switch-config/.claude-env`));
  console.log(chalk.yellow(`\n⚠️  需要重启 Claude Code 才能生效\n`));
}

// 切换配置（兼容旧版本，默认设置为默认配置）
function switchConfig(name) {
  setDefaultConfig(name);
}

// 删除配置
function deleteConfig(name) {
  const configs = readConfigs();
  const index = configs.configs.findIndex((c) => c.name === name);

  if (index === -1) {
    console.log(chalk.red(`配置 "${name}" 不存在！`));
    return;
  }

  if (configs.current === name) {
    configs.current = null;
  }

  configs.configs.splice(index, 1);
  writeConfigs(configs);

  console.log(chalk.green(`✓ 配置 "${name}" 已删除！`));
}

// 交互式添加配置（使用 @clack/prompts）
async function interactiveAdd() {
  console.clear();
  intro(chalk.cyan.bold('🤖 Claude API Switcher - 添加新配置'));

  const configs = readConfigs();
  const existingNames = configs.configs.map((c) => c.name);

  const name = await text({
    message: '📝 配置名称',
    placeholder: '例如: 官方API、代理API1',
    validate: (value) => {
      if (!value) return '请输入配置名称';
      if (existingNames.includes(value)) return `配置 "${value}" 已存在`;
    },
  });

  if (isCancel(name)) {
    cancel('操作已取消');
    process.exit(0);
  }

  const apiKey = await text({
    message: '🔑 API Key',
    placeholder: 'sk-ant-api03-xxx',
    validate: (value) => {
      if (!value) return '请输入 API Key';
      if (value.length < 10) return 'API Key 格式不正确';
    },
  });

  if (isCancel(apiKey)) {
    cancel('操作已取消');
    process.exit(0);
  }

  const useCustomUrl = await confirm({
    message: '是否使用自定义 Base URL？',
    initialValue: false,
  });

  if (isCancel(useCustomUrl)) {
    cancel('操作已取消');
    process.exit(0);
  }

  let baseUrl = 'https://api.anthropic.com';
  if (useCustomUrl) {
    const customUrl = await text({
      message: '🌐 Base URL',
      placeholder: 'https://your-proxy.com',
      initialValue: 'https://api.anthropic.com',
      validate: (value) => {
        if (!value) return '请输入 Base URL';
        try {
          new URL(value);
          return;
        } catch {
          return 'URL 格式不正确';
        }
      },
    });

    if (isCancel(customUrl)) {
      cancel('操作已取消');
      process.exit(0);
    }

    baseUrl = customUrl;
  }

  // 显示配置摘要
  const summary = `
📋 配置摘要:
━━━━━━━━━━━━━━━━━━━━━━━━━━
名称: ${name}
API Key: ${maskApiKey(apiKey)}
Base URL: ${baseUrl}
━━━━━━━━━━━━━━━━━━━━━━━━━━
  `.trim();

  note(summary, '配置预览');

  const confirmAdd = await confirm({
    message: '确认添加此配置？',
    initialValue: true,
  });

  if (isCancel(confirmAdd) || !confirmAdd) {
    cancel('已取消添加');
    process.exit(0);
  }

  await addConfig(name, apiKey, baseUrl);

  outro(chalk.green('✅ 配置添加成功！'));
}

// 交互式切换配置
async function interactiveSwitch(isTemp = false, isDefault = false, isEval = false) {
  // eval 模式不支持交互式
  if (isEval) {
    console.log(chalk.red('错误: --eval 选项不能与 -i (交互式) 一起使用'));
    console.log(chalk.gray('\n正确用法:'));
    console.log(chalk.cyan('  zcs switch -n <配置名> -t --eval'));
    console.log(chalk.cyan('  eval $(zcs switch -n <配置名> -t --eval)\n'));
    process.exit(1);
  }

  console.clear();
  intro(chalk.cyan.bold('🔄 Claude API Switcher - 切换配置'));

  const configs = readConfigs();

  if (configs.configs.length === 0) {
    outro(chalk.yellow('暂无配置，请先添加配置。'));
    process.exit(0);
  }

  const options = configs.configs.map((config) => ({
    value: config.name,
    label: `${config.name} ${configs.current === config.name ? '(当前默认)' : ''}`,
    hint: maskApiKey(config.apiKey),
  }));

  const selected = await select({
    message: '选择要切换的配置',
    options,
  });

  if (isCancel(selected)) {
    cancel('操作已取消');
    process.exit(0);
  }

  // 如果没有指定模式，让用户选择
  let mode = 'default';
  if (!isTemp && !isDefault) {
    mode = await select({
      message: '选择切换模式',
      options: [
        { value: 'temp', label: '🔹 临时使用（仅当前终端）', hint: '不影响默认配置，重启后恢复' },
        { value: 'default', label: '🟢 设为默认（全局配置）', hint: '修改 .claude/settings.json，需要重启 Claude' },
      ],
    });

    if (isCancel(mode)) {
      cancel('操作已取消');
      process.exit(0);
    }
  } else if (isTemp) {
    mode = 'temp';
  }

  const config = configs.configs.find((c) => c.name === selected);

  if (mode === 'temp') {
    useConfigTemp(selected, false);
    const info = `
✅ 临时使用配置
━━━━━━━━━━━━━━━━━━━━━━━━━━
配置: ${selected}
API Key: ${maskApiKey(config.apiKey)}
Base URL: ${config.baseUrl}

🚀 快速生效命令:
   eval $(zcs switch -n "${selected}" -t --eval)
    `.trim();

    note(info);
    outro('');
  } else {
    setDefaultConfig(selected);
    const info = `
✅ 已设为默认配置
━━━━━━━━━━━━━━━━━━━━━━━━━━
配置: ${selected}
API Key: ${maskApiKey(config.apiKey)}
Base URL: ${config.baseUrl}

💡 已更新文件:
   ~/.claude/settings.json
   ~/.claude-switch-config/.claude-env

⚠️  需要重启 Claude Code 才能生效
    `.trim();

    note(info);
    outro('');
  }
}

// 交互式删除配置
async function interactiveDelete() {
  console.clear();
  intro(chalk.cyan.bold('🗑️  Claude API Switcher - 删除配置'));

  const configs = readConfigs();

  if (configs.configs.length === 0) {
    outro(chalk.yellow('暂无配置。'));
    process.exit(0);
  }

  const options = configs.configs.map((config) => ({
    value: config.name,
    label: `${config.name} ${configs.current === config.name ? '(当前)' : ''}`,
    hint: maskApiKey(config.apiKey),
  }));

  const selected = await select({
    message: '选择要删除的配置',
    options,
  });

  if (isCancel(selected)) {
    cancel('操作已取消');
    process.exit(0);
  }

  const confirmDelete = await confirm({
    message: `确认删除配置 "${selected}"？`,
    initialValue: false,
  });

  if (isCancel(confirmDelete) || !confirmDelete) {
    cancel('已取消删除');
    process.exit(0);
  }

  deleteConfig(selected);
  outro(chalk.green('✅ 配置已删除！'));
}

// 查看当前配置详情
function showCurrentConfig() {
  const configs = readConfigs();

  if (!configs.current) {
    console.log(chalk.yellow('⚠️  当前没有选中的配置\n'));
    console.log(chalk.gray('使用以下命令添加配置:'));
    console.log(chalk.cyan('  claude-switch add -i\n'));
    return;
  }

  const config = configs.configs.find((c) => c.name === configs.current);
  if (!config) {
    console.log(chalk.yellow('⚠️  当前配置不存在\n'));
    return;
  }

  const info = `
🟢 当前配置
━━━━━━━━━━━━━━━━━━━━━━━━━━
名称: ${config.name}
API Key: ${maskApiKey(config.apiKey)}
Base URL: ${config.baseUrl}
创建时间: ${new Date(config.createdAt).toLocaleString('zh-CN')}
━━━━━━━━━━━━━━━━━━━━━━━━━━
  `.trim();

  console.log(chalk.cyan.bold(info));
  console.log(chalk.gray('\n💡 环境变量文件位置: ~/.claude-switch-config/.claude-env'));
}

// 主程序
const program = new Command();

program
  .name('zcs')
  .description('🤖 Claude API 配置切换工具')
  .version('1.0.0')
  .addHelpText(
    'beforeAll',
    chalk.cyan.bold(`
╔═══════════════════════════════════════╗
║   Claude API Configuration Switcher   ║
╚═══════════════════════════════════════╝
`)
  )
  .addHelpText(
    'after',
    chalk.gray(`
📂 配置目录: ~/.claude-switch-config/
💡 提示: 首次使用请运行 'zcs add -i' 添加配置
`)
  );

program
  .command('add')
  .description('➕ 添加新的 API 配置')
  .option('-i, --interactive', '交互式添加（推荐）')
  .option('-n, --name <name>', '配置名称')
  .option('-k, --key <key>', 'API Key')
  .option('-u, --url <url>', 'Base URL')
  .action(async (options) => {
    if (options.interactive || !options.name || !options.key) {
      await interactiveAdd();
    } else {
      await addConfig(options.name, options.key, options.url);
    }
  });

program
  .command('list')
  .alias('ls')
  .description('📋 列出所有配置')
  .action(listConfigs);

program
  .command('switch')
  .alias('use')
  .description('🔄 切换配置')
  .option('-i, --interactive', '交互式选择')
  .option('-n, --name <name>', '配置名称')
  .option('-t, --temp', '临时使用（仅当前终端）')
  .option('-d, --default', '设为默认（修改 .claude/settings.json）')
  .option('-e, --eval', '输出 eval 可执行的命令（配合 -t 使用）')
  .action(async (options) => {
    if (options.interactive || !options.name) {
      await interactiveSwitch(options.temp, options.default, options.eval);
    } else if (options.temp) {
      useConfigTemp(options.name, options.eval);
    } else {
      // 默认行为：设置为默认配置
      setDefaultConfig(options.name);
    }
  });

program
  .command('delete')
  .alias('rm')
  .description('🗑️  删除配置')
  .option('-i, --interactive', '交互式删除')
  .option('-n, --name <name>', '配置名称')
  .action(async (options) => {
    if (options.interactive || !options.name) {
      await interactiveDelete();
    } else {
      if (!options.name) {
        console.log(chalk.red('请指定要删除的配置名称'));
        return;
      }
      deleteConfig(options.name);
    }
  });

program
  .command('current')
  .description('👀 查看当前配置')
  .action(showCurrentConfig);

program.parse();
