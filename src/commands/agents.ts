import chalk from 'chalk';
import type { Command } from 'commander';

import type { CommandContext } from './context.js';

export function registerAgentsCommand(program: Command, context: CommandContext): void {
  program
    .command('agents')
    .description('🔎 扫描已安装的 Agent 工具')
    .action(() => {
      context.agents.all().map((agent) => agent.discover()).forEach((agent) => {
        const status = agent.installed ? chalk.green('已安装') : chalk.gray('未安装');
        console.log(`${agent.installed ? '🟢' : '⚪'} ${chalk.bold(agent.name)} ${status}`);
        console.log(`   命令: ${agent.executable || '未在 PATH 中找到'}`);
        console.log(`   版本: ${agent.version || '未知'}`);
        console.log(`   历史目录: ${agent.historyRoot}`);
        console.log(`   能力: ${agent.capabilities.join('、')}`);
      });
    });
}
