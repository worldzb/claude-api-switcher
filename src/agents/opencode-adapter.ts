import fs from 'node:fs';
import path from 'node:path';

import { AbstractFileAdapter } from './abstract-file-adapter.js';
import { asString, isRecord } from './jsonl.js';
import { prepareMcpConfiguration } from './mcp-config.js';
import { findExecutable, runCommand } from './process-runner.js';
import type { IntegrationItem, LaunchSpec, PortableTranscript, SessionSummary, TranscriptMessage } from './types.js';
import { normalizeMessage } from '../migration/transcript-normalizer.js';

export class OpenCodeAdapter extends AbstractFileAdapter {
  readonly id = 'opencode' as const;
  readonly name = 'OpenCode';
  readonly command = 'opencode';
  readonly historyRoot: string;

  constructor(private readonly homeDirectory: string) {
    super();
    this.historyRoot = path.join(homeDirectory, '.local', 'share', 'opencode');
  }

  listSessions(): readonly SessionSummary[] {
    try {
      const value: unknown = JSON.parse(this.execute(['session', 'list', '--format', 'json']));
      const sessions = toSessions(value, this.id);
      return sessions.length ? sessions : this.listSessionsFromDatabase();
    } catch {
      return this.listSessionsFromDatabase();
    }
  }

  private listSessionsFromDatabase(): readonly SessionSummary[] {
    const sqlite = findExecutable('sqlite3');
    const database = path.join(this.historyRoot, 'opencode.db');
    if (!sqlite || !fs.existsSync(database)) return [];
    try {
      const output = runCommand(sqlite, [
        '-json',
        '-readonly',
        database,
        'SELECT id, title, directory, time_updated FROM session ORDER BY time_updated DESC;',
      ]);
      return toSessions(JSON.parse(output), this.id);
    } catch {
      return [];
    }
  }

  readTranscript(session: SessionSummary): PortableTranscript {
    try {
      const value: unknown = JSON.parse(this.execute(['export', session.id]));
      const messages = collectMessages(value);
      return {
        source: session,
        messages,
        warnings: messages.length ? [] : ['OpenCode 未返回可迁移的消息内容。'],
      };
    } catch (error) {
      return {
        source: session,
        messages: [],
        warnings: [error instanceof Error ? error.message : '无法导出 OpenCode 会话。'],
      };
    }
  }

  createResumeLaunch(session: SessionSummary): LaunchSpec {
    return { command: [this.command, '--session', session.id], cwd: session.cwd || process.cwd() };
  }

  createNewLaunch(input: { readonly cwd: string; readonly prompt?: string; readonly assetDirectory?: string }): LaunchSpec {
    const prompt = input.prompt
      ? `${input.prompt}${input.assetDirectory ? `\n\n迁移附件目录：${input.assetDirectory}` : ''}`
      : undefined;
    return { command: [this.command, ...(prompt ? ['--prompt', prompt] : [])], cwd: input.cwd || process.cwd() };
  }

  deleteSession(session: SessionSummary): void {
    this.execute(['session', 'delete', session.id], session.cwd);
  }

  integrationRoots(project?: string) {
    return [
      { directory: path.join(this.homeDirectory, '.config', 'opencode'), scope: 'user' as const },
      ...(project ? [{ directory: path.join(project, '.opencode'), scope: 'project' as const }] : []),
    ];
  }

  listIntegrations(project?: string): readonly IntegrationItem[] {
    return [...super.listIntegrations(project), ...this.listLocalPlugins(project), ...this.listConfiguredItems(project), ...this.listMcp()];
  }

  installPlugin(plugin: string, scope: 'user' | 'project'): void {
    this.execute(['plugin', plugin, ...(scope === 'user' ? ['--global'] : [])]);
  }

  installSkill(sourcePath: string, scope: 'user' | 'project', project?: string): void {
    copySkill(sourcePath, path.join(scope === 'user' ? this.homeDirectory : project || process.cwd(), '.opencode', 'skills'));
  }

  addMcp(name: string, configuration: string, scope: 'user' | 'project', project?: string): void {
    // OpenCode 只接受 remote / local 两种格式，统一在这里转换，任何入口都不会写出非法配置。
    const prepared = prepareMcpConfiguration(this.id, configuration);
    if (!prepared.ok) throw new Error(prepared.error);
    const filePath = scope === 'project'
      ? path.join(project || process.cwd(), 'opencode.json')
      : path.join(this.homeDirectory, '.config', 'opencode', 'opencode.json');
    updateOpenCodeMcpConfig(filePath, name, JSON.parse(prepared.configuration) as Record<string, unknown>);
  }

  removeIntegration(item: IntegrationItem): void {
    // 配置文件里的 MCP 是 zmai 自己写进去的，可以安全地删掉对应的键。
    if (item.kind === 'mcp' && item.location.endsWith('.json') && isRecord(readJsonFile(item.location)?.mcp)) {
      removeOpenCodeMcpConfig(item.location, item.name);
      return;
    }
    if (item.kind === 'mcp' || (item.kind === 'plugin' && item.location.endsWith('.json'))) {
      throw new Error('当前 OpenCode 版本未提供该资源的安全移除命令；请在配置文件中手动移除。');
    }
    this.removeLocalPath(item.location);
  }

  readMcpConfiguration(item: IntegrationItem): string {
    if (item.kind !== 'mcp' || !item.location.endsWith('.json')) {
      throw new Error('OpenCode 当前只能复制配置文件中定义的 MCP。');
    }
    const parsed: unknown = JSON.parse(fs.readFileSync(item.location, 'utf8'));
    const servers = isRecord(parsed) && isRecord(parsed.mcp) ? parsed.mcp : undefined;
    const configuration = servers?.[item.name];
    if (!configuration) throw new Error(`无法读取 MCP 配置：${item.name}`);
    return JSON.stringify(configuration);
  }

  private listLocalPlugins(project?: string): readonly IntegrationItem[] {
    const roots = [
      { directory: path.join(this.homeDirectory, '.config', 'opencode', 'plugins'), scope: 'user' as const },
      ...(project ? [{ directory: path.join(project, '.opencode', 'plugins'), scope: 'project' as const }] : []),
    ];
    return roots.flatMap(({ directory, scope }) => {
      if (!fs.existsSync(directory)) return [];
      return fs.readdirSync(directory, { withFileTypes: true })
        .filter((entry) => !entry.name.startsWith('.') && (entry.isDirectory() || entry.isFile()))
        .map((entry) => ({
          agent: this.id,
          kind: 'plugin' as const,
          name: entry.name,
          scope,
          location: path.join(directory, entry.name),
          removable: true,
        }));
    });
  }

  private listConfiguredItems(project?: string): readonly IntegrationItem[] {
    return [
      { file: path.join(this.homeDirectory, '.config', 'opencode', 'opencode.json'), scope: 'user' as const },
      ...(project ? [{ file: path.join(project, 'opencode.json'), scope: 'project' as const }] : []),
    ].flatMap(({ file, scope }) => readConfiguredItems(this.id, file, scope));
  }

  private listMcp(): readonly IntegrationItem[] {
    try {
      const output = this.execute(['mcp', 'list']);
      return output.split('\n')
        .map((line) => line.trim().split(/\s+/)[0])
        .filter((name): name is string => Boolean(name) && !name.toLowerCase().startsWith('name'))
        .map((name) => ({ agent: this.id, kind: 'mcp' as const, name, scope: 'user' as const, location: 'opencode mcp', removable: false }));
    } catch {
      return [];
    }
  }
}

function copySkill(sourcePath: string, root: string): void {
  if (!fs.existsSync(sourcePath) || !fs.statSync(sourcePath).isDirectory()) throw new Error(`Skill 目录不存在：${sourcePath}`);
  fs.mkdirSync(root, { recursive: true });
  const destination = path.join(root, path.basename(sourcePath));
  if (fs.existsSync(destination)) throw new Error(`Skill 已存在：${destination}`);
  fs.cpSync(sourcePath, destination, { recursive: true });
}

function toSessions(value: unknown, agent: 'opencode'): readonly SessionSummary[] {
  const rows = Array.isArray(value) ? value : isRecord(value) && Array.isArray(value.sessions) ? value.sessions : [];
  return rows.filter(isRecord).flatMap((row): readonly SessionSummary[] => {
    const id = asString(row.id);
    if (!id) return [];
    const time = isRecord(row.time) ? row.time : {};
    return [{
      agent,
      id,
      title: asString(row.title) || asString(row.slug) || '未命名 OpenCode 会话',
      cwd: asString(row.directory) || asString(row.path) || process.cwd(),
      updatedAt: toIso(row.updated ?? row.time_updated ?? time.updated ?? time.updatedAt),
      sourcePath: id,
    }];
  });
}

function readConfiguredItems(agent: 'opencode', file: string, scope: 'user' | 'project'): readonly IntegrationItem[] {
  if (!fs.existsSync(file)) return [];
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!isRecord(parsed)) return [];
    const plugins = Array.isArray(parsed.plugin) ? parsed.plugin : [];
    const pluginItems = plugins.filter((plugin): plugin is string => typeof plugin === 'string').map((name) => ({
      agent,
      kind: 'plugin' as const,
      name,
      scope,
      location: file,
      removable: true,
    }));
    const mcp = isRecord(parsed.mcp) ? Object.keys(parsed.mcp).map((name) => ({
      agent,
      kind: 'mcp' as const,
      name,
      scope,
      location: file,
      removable: true,
    })) : [];
    return [...pluginItems, ...mcp];
  } catch {
    return [];
  }
}

function readJsonFile(filePath: string): Record<string, unknown> | undefined {
  if (!fs.existsSync(filePath)) return undefined;
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function removeOpenCodeMcpConfig(filePath: string, name: string): void {
  const current = readJsonFile(filePath);
  const servers = current && isRecord(current.mcp) ? { ...current.mcp } : undefined;
  if (!current || !servers || !isRecord(servers[name])) throw new Error(`无法移除 MCP 配置：${name}`);
  delete servers[name];
  writeJsonFile(filePath, { ...current, mcp: servers });
}

function writeJsonFile(filePath: string, value: Record<string, unknown>): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
}

function updateOpenCodeMcpConfig(filePath: string, name: string, configuration: Record<string, unknown>): void {
  let current: Record<string, unknown> = {};
  if (fs.existsSync(filePath)) {
    const parsed: unknown = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (isRecord(parsed)) current = parsed;
  }
  const servers = isRecord(current.mcp) ? current.mcp : {};
  const next = { ...current, mcp: { ...servers, [name]: configuration } };
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(next, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
}

function collectMessages(value: unknown): readonly TranscriptMessage[] {
  if (Array.isArray(value)) return value.flatMap(collectMessages);
  if (!isRecord(value)) return [];
  const direct = normalizeMessage(value);
  if (direct) return [direct];
  return Object.values(value).flatMap(collectMessages);
}

function toIso(value: unknown): string {
  if (typeof value === 'number') return new Date(value).toISOString();
  if (typeof value === 'string') {
    const date = new Date(value);
    return Number.isNaN(date.valueOf()) ? new Date(0).toISOString() : date.toISOString();
  }
  return new Date(0).toISOString();
}
