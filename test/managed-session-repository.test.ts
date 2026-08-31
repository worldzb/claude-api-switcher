import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { ManagedSessionRepository } from '../src/sessions/managed-session-repository.js';

const directories: string[] = [];

afterEach(() => directories.splice(0).forEach((directory) => fs.rmSync(directory, { recursive: true, force: true })));

describe('托管会话存储', () => {
  it('新增记录不会修改已有记录', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'zmai-'));
    directories.push(directory);
    const repository = new ManagedSessionRepository(path.join(directory, 'sessions.json'));
    const initial = repository.read();

    const record = repository.create({
      agent: 'claude',
      agentSessionId: 'source',
      cwd: '/project',
      command: ['claude', '--resume', 'source'],
      logPath: '/tmp/log',
      tmuxSession: 'zmai-source',
    });

    expect(initial).toEqual([]);
    expect(repository.read()).toEqual([record]);
  });
});
