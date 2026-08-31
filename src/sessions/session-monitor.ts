import fs from 'node:fs';

import type { ManagedSession } from './managed-session-repository.js';
import type { SessionLauncher } from './session-launcher.js';

export function describeManagedSession(session: ManagedSession, launcher: SessionLauncher): string {
  const status = launcher.status(session);
  const lastOutput = fs.existsSync(session.logPath)
    ? fs.readFileSync(session.logPath, 'utf8').trim().split('\n').slice(-3).join('\n')
    : '暂无输出';
  return [
    `ID: ${session.id}`,
    `Agent: ${session.agent}`,
    `状态: ${status}`,
    `工作目录: ${session.cwd}`,
    `开始时间: ${session.createdAt}`,
    '最新输出:',
    lastOutput || '暂无输出',
  ].join('\n');
}
