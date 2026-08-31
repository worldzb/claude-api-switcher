import fs from 'node:fs';
import path from 'node:path';

import { findExecutable, runCommand } from '../agents/process-runner.js';
import type { LaunchSpec } from '../agents/types.js';
import type { ManagedSession, ManagedSessionRepository } from './managed-session-repository.js';

export class SessionLauncher {
  constructor(
    private readonly repository: ManagedSessionRepository,
    private readonly stateDirectory: string,
  ) {}

  launch(agent: ManagedSession['agent'], sessionId: string | undefined, spec: LaunchSpec): ManagedSession {
    const tmux = findExecutable('tmux');
    if (!tmux) {
      throw new Error('未找到 tmux；无法创建可监控的后台会话。请安装 tmux 后重试。');
    }
    fs.mkdirSync(path.join(this.stateDirectory, 'logs'), { recursive: true, mode: 0o700 });
    const managedId = cryptoSafeId();
    const tmuxSession = `zmai-${managedId.slice(0, 8)}`;
    const logPath = path.join(this.stateDirectory, 'logs', `${managedId}.log`);
    const command = [...spec.command];
    runCommand(tmux, ['new-session', '-d', '-s', tmuxSession, '-c', spec.cwd, command.map(shellQuote).join(' ')]);
    runCommand(tmux, ['pipe-pane', '-o', '-t', tmuxSession, `cat >> ${shellQuote(logPath)}`]);
    return this.repository.create({
      agent,
      ...(sessionId ? { agentSessionId: sessionId } : {}),
      cwd: spec.cwd,
      command,
      logPath,
      tmuxSession,
    });
  }

  status(record: ManagedSession): ManagedSession['status'] {
    const tmux = findExecutable('tmux');
    if (!tmux) return 'unknown';
    try {
      runCommand(tmux, ['has-session', '-t', record.tmuxSession]);
      return 'running';
    } catch {
      return record.status === 'stopped' ? 'stopped' : 'completed';
    }
  }

  stop(record: ManagedSession): void {
    const tmux = findExecutable('tmux');
    if (!tmux) throw new Error('未找到 tmux，无法停止托管会话。');
    runCommand(tmux, ['kill-session', '-t', record.tmuxSession]);
    this.repository.updateStatus(record.id, 'stopped');
  }

  attach(record: ManagedSession): void {
    const tmux = findExecutable('tmux');
    if (!tmux) throw new Error('未找到 tmux，无法附着托管会话。');
    runCommand(tmux, ['attach-session', '-t', record.tmuxSession]);
  }
}

function cryptoSafeId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}
