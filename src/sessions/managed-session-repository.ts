import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import type { AgentId } from '../agents/types.js';

export interface ManagedSession {
  readonly id: string;
  readonly agent: AgentId;
  readonly agentSessionId?: string;
  readonly cwd: string;
  readonly command: readonly string[];
  readonly logPath: string;
  readonly tmuxSession: string;
  readonly createdAt: string;
  readonly status: 'running' | 'stopped' | 'completed' | 'unknown';
}

export class ManagedSessionRepository {
  constructor(private readonly filePath: string) {}

  read(): readonly ManagedSession[] {
    if (!fs.existsSync(this.filePath)) return [];
    try {
      const value: unknown = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      return Array.isArray(value) ? value.filter(isManagedSession) : [];
    } catch {
      throw new Error(`无法读取托管会话记录：${this.filePath}`);
    }
  }

  create(input: Omit<ManagedSession, 'id' | 'createdAt' | 'status'>): ManagedSession {
    const record: ManagedSession = {
      ...input,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      status: 'running',
    };
    this.write([...this.read(), record]);
    return record;
  }

  updateStatus(id: string, status: ManagedSession['status']): ManagedSession {
    const records = this.read();
    const record = records.find((item) => item.id === id);
    if (!record) throw new Error(`托管会话 "${id}" 不存在。`);
    const updated = { ...record, status };
    this.write(records.map((item) => item.id === id ? updated : item));
    return updated;
  }

  get(id: string): ManagedSession {
    const record = this.read().find((item) => item.id === id);
    if (!record) throw new Error(`托管会话 "${id}" 不存在。`);
    return record;
  }

  private write(records: readonly ManagedSession[]): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true, mode: 0o700 });
    fs.writeFileSync(this.filePath, `${JSON.stringify(records, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    fs.chmodSync(this.filePath, 0o600);
  }
}

function isManagedSession(value: unknown): value is ManagedSession {
  return typeof value === 'object' && value !== null
    && typeof (value as ManagedSession).id === 'string'
    && typeof (value as ManagedSession).agent === 'string'
    && Array.isArray((value as ManagedSession).command);
}
