import { spawnSync } from 'node:child_process';
import { Worker } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';

import { cancel, confirm, isCancel } from '@clack/prompts';
import { render } from 'ink';
import React from 'react';
import chalk from 'chalk';
import type { Command } from 'commander';

import { launchCommand } from '../agents/process-runner.js';
import type { AgentId, LaunchSpec, SessionSummary } from '../agents/types.js';
import { pageSessions } from '../history/session-service.js';
import { HistoryApp } from '../history/ui/history-app.js';
import type { CommandContext } from './context.js';

interface HistoryOptions {
  readonly agent?: AgentId;
  readonly page?: string;
  readonly pageSize?: string;
  readonly plain?: boolean;
}

export function registerHistoryCommand(program: Command, context: CommandContext): void {
  program
    .command('history')
    .description('🕘 查看所有 Agent 的历史会话')
    .option('-a, --agent <agent>', '筛选 Agent：claude、codex、opencode')
    .option('-p, --page <page>', '页码', '1')
    .option('--page-size <size>', '每页数量', '20')
    .option('--plain', '以非交互文本格式输出')
    .action(async (options: HistoryOptions) => {
      validateAgent(options.agent);
      const page = parsePositiveInteger(options.page, 1, 'page');
      const pageSize = parsePositiveInteger(options.pageSize, 20, 'page-size');
      if (options.plain || !process.stdin.isTTY || !process.stdout.isTTY) {
        printHistoryPage(loadSessions(context), options.agent, page, pageSize);
        return;
      }
      await runInkHistory(context, options.agent, pageSize);
    });
}

async function runInkHistory(context: CommandContext, agent: AgentId | undefined, pageSize: number): Promise<void> {
  let foregroundLaunch: LaunchSpec | undefined;
  let clearScreen = (): void => {};
  const app = render(<HistoryApp
    agent={agent}
    pageSize={pageSize}
    currentDirectory={process.cwd()}
    agents={context.agents.all().map((adapter) => ({
      id: adapter.id,
      name: adapter.name,
      installed: adapter.discover().installed,
    }))}
    loadSessions={(onProgress) => loadSessionsInWorker(onProgress)}
    onResume={async (session) => resumeSession(context, session)}
    onMigrate={async (session, target) => migrateAndLaunch(context, session, target, true)}
    onDelete={async (session) => deleteSession(context, session)}
    onDeleteMany={async (sessions) => deleteSessions(context, sessions)}
    onForegroundLaunch={(spec) => { foregroundLaunch = spec; }}
    onClearScreen={() => clearScreen()}
  />);
  clearScreen = app.clear;
  try {
    await app.waitUntilExit();
  } finally {
    app.unmount();
  }
  if (foregroundLaunch) launchInCurrentTerminal(foregroundLaunch);
}

function loadSessionsInWorker(onProgress: (message: string) => void): Promise<readonly SessionSummary[]> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(fileURLToPath(new URL('../history/session-loader-worker.js', import.meta.url)));
    worker.on('message', (message: unknown) => {
      if (!isWorkerMessage(message)) return;
      if (message.type === 'progress') {
        onProgress(message.message);
        return;
      }
      if (message.type === 'complete') {
        resolve(message.sessions);
        return;
      }
      reject(new Error(message.message));
    });
    worker.on('error', reject);
    worker.on('exit', (code) => {
      if (code !== 0) reject(new Error(`历史扫描进程异常退出：${code}`));
    });
  });
}

function isWorkerMessage(value: unknown): value is { type: 'progress'; message: string } | { type: 'complete'; sessions: readonly SessionSummary[] } | { type: 'error'; message: string } {
  return typeof value === 'object' && value !== null && typeof (value as { type?: unknown }).type === 'string';
}

function loadSessionsDeferred(context: CommandContext): Promise<readonly SessionSummary[]> {
  return new Promise((resolve) => setTimeout(() => resolve(loadSessions(context)), 0));
}

function loadSessions(context: CommandContext): readonly SessionSummary[] {
  return context.agents.all().flatMap((adapter) => adapter.listSessions());
}

function printHistoryPage(contextSessions: readonly SessionSummary[], agent: AgentId | undefined, pageNumber: number, pageSize: number): void {
  const page = pageSessions(contextSessions, { page: pageNumber, pageSize, ...(agent ? { agent } : {}) });
  console.log(chalk.bold(`\n🕘 历史会话：第 ${page.page}/${page.totalPages} 页，共 ${page.total} 条\n`));
  if (!page.items.length) {
    console.log(chalk.yellow('没有找到会话。'));
    return;
  }
  page.items.forEach((session) => {
    console.log(`${chalk.cyan(`[${session.agent}]`)} ${chalk.bold(session.title)}`);
    console.log(chalk.gray(`  ${session.cwd} · ${session.updatedAt} · ${session.id}`));
  });
}

async function resumeSession(context: CommandContext, session: SessionSummary): Promise<{ readonly message: string; readonly launch: LaunchSpec }> {
  return {
    message: `正在当前终端启动 ${session.agent} 会话。`,
    launch: context.agents.get(session.agent).createResumeLaunch(session),
  };
}

async function deleteSession(context: CommandContext, session: SessionSummary): Promise<{ readonly message: string }> {
  context.agents.get(session.agent).deleteSession(session);
  return { message: `已删除 ${session.agent} 会话：${session.title}` };
}

export async function deleteSessions(context: Pick<CommandContext, 'agents'>, sessions: readonly SessionSummary[]): Promise<{ readonly message: string }> {
  const failures: string[] = [];
  let deleted = 0;
  for (const session of sessions) {
    try {
      context.agents.get(session.agent).deleteSession(session);
      deleted += 1;
    } catch (caught) {
      const reason = caught instanceof Error ? caught.message : '未知错误';
      failures.push(`${session.agent}:${session.id}（${reason}）`);
    }
  }
  if (failures.length) {
    const preview = failures.slice(0, 3).join('；');
    const remaining = failures.length - Math.min(failures.length, 3);
    throw new Error(`已删除 ${deleted}/${sessions.length} 个会话；${preview}${remaining ? `；另有 ${remaining} 个删除失败` : ''}`);
  }
  return { message: `已删除 ${deleted} 个会话。` };
}

export async function migrateAndLaunch(
  context: CommandContext,
  session: SessionSummary,
  target: AgentId,
  confirmed = false,
): Promise<{ readonly message: string; readonly launch?: LaunchSpec }> {
  const prepared = context.migrationService.prepare(context.agents.get(session.agent), session, target);
  if (!confirmed) {
    const accepted = await confirm({
      message: `将 ${session.agent} 会话迁移到 ${target}，创建新会话并保留原会话？附件：${prepared.attachmentCount} 个。`,
      initialValue: true,
    });
    if (isCancel(accepted) || !accepted) {
      cancel('已取消迁移');
      return { message: '已取消迁移。' };
    }
  }
  copyHistoryToClipboard(prepared.prompt);
  const spec = context.agents.get(target).createNewLaunch({
    cwd: session.cwd,
    prompt: prepared.prompt,
    assetDirectory: prepared.assetDirectory,
  });
  const warnings = prepared.warnings.length ? `\n迁移提示：${prepared.warnings.join('；')}` : '';
  return {
    message: `历史记录已自动导入 ${target} 新会话，并复制到剪贴板；迁移文件保留在 ${prepared.directory}。${warnings}`,
    launch: spec,
  };
}

function copyHistoryToClipboard(history: string): void {
  const clipboard = process.platform === 'darwin' ? 'pbcopy' : process.platform === 'win32' ? 'clip' : 'xclip';
  const args = process.platform === 'linux' ? ['-selection', 'clipboard'] : [];
  const result = spawnSync(clipboard, args, { input: history, encoding: 'utf8' });
  if (result.error || result.status !== 0) {
    throw new Error('无法复制历史记录到剪贴板。');
  }
}

function launchInCurrentTerminal(spec: LaunchSpec): void {
  const [command, ...args] = spec.command;
  if (!command) throw new Error('启动命令为空。');
  const status = launchCommand(command, args, spec.cwd);
  if (status && status !== 0) process.exitCode = status;
}

function parsePositiveInteger(value: string | undefined, fallback: number, option: string): number {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`--${option} 必须为大于 0 的整数。`);
  }
  return parsed;
}

function validateAgent(agent: string | undefined): asserts agent is AgentId | undefined {
  if (agent && !['claude', 'codex', 'opencode'].includes(agent)) {
    throw new Error('Agent 必须为 claude、codex 或 opencode。');
  }
}
