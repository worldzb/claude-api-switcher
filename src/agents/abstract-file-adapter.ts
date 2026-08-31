import fs from 'node:fs';
import path from 'node:path';

import type { AgentAdapter, IntegrationItem, SessionSummary } from './types.js';
import { findExecutable, getVersion, runCommand } from './process-runner.js';

export abstract class AbstractFileAdapter implements AgentAdapter {
  abstract readonly id: AgentAdapter['id'];
  abstract readonly name: string;
  abstract readonly command: string;
  abstract readonly historyRoot: string;

  discover() {
    const executable = findExecutable(this.command);
    return {
      id: this.id,
      name: this.name,
      installed: executable !== undefined,
      ...(executable ? { executable, version: getVersion(executable) } : {}),
      historyRoot: this.historyRoot,
      capabilities: ['历史记录', '续接会话', '删除会话', '插件', 'Skills', 'MCP'],
    };
  }

  abstract listSessions(): readonly SessionSummary[];
  abstract readTranscript(session: SessionSummary): ReturnType<AgentAdapter['readTranscript']>;
  abstract createResumeLaunch(session: SessionSummary): ReturnType<AgentAdapter['createResumeLaunch']>;
  abstract createNewLaunch(input: Parameters<AgentAdapter['createNewLaunch']>[0]): ReturnType<AgentAdapter['createNewLaunch']>;
  abstract deleteSession(session: SessionSummary): void;

  listIntegrations(project?: string): readonly IntegrationItem[] {
    const roots = this.integrationRoots(project);
    return roots.flatMap(({ directory, scope }) => scanIntegrationRoot(this.id, directory, scope));
  }

  abstract integrationRoots(project?: string): readonly { directory: string; scope: 'user' | 'project' }[];
  abstract installPlugin(plugin: string, scope: 'user' | 'project'): void;
  abstract removeIntegration(item: IntegrationItem): void;

  protected execute(args: readonly string[], cwd?: string): string {
    const executable = findExecutable(this.command);
    if (!executable) throw new Error(`${this.name} 未安装或不在 PATH 中。`);
    return runCommand(executable, args, cwd);
  }

  protected removeLocalPath(location: string): void {
    if (!fs.existsSync(location)) throw new Error(`资源不存在：${location}`);
    fs.rmSync(location, { recursive: true, force: false });
  }
}

function scanIntegrationRoot(
  agent: AgentAdapter['id'],
  directory: string,
  scope: 'user' | 'project',
): readonly IntegrationItem[] {
  if (!fs.existsSync(directory)) return [];
  const candidates: readonly { readonly name: string; readonly kind: IntegrationItem['kind'] }[] = [
    { name: 'skills', kind: 'skill' },
  ];

  return candidates.flatMap(({ name, kind }) => {
    const root = path.join(directory, name);
    if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) return [];
    return fs.readdirSync(root, { withFileTypes: true })
      .filter((entry) => !entry.name.startsWith('.') && (entry.isDirectory() || entry.isFile()))
      .map((entry) => ({
        agent,
        kind,
        name: entry.name,
        scope,
        location: path.join(root, entry.name),
        removable: true,
      }));
  });
}
