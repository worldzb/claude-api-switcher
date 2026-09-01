import fs from 'node:fs';
import path from 'node:path';

import { AbstractFileAdapter } from './abstract-file-adapter.js';
import { asString, isRecord, readJsonLines } from './jsonl.js';
import type { IntegrationItem, LaunchSpec, PortableTranscript, SessionSummary, TranscriptMessage } from './types.js';
import { normalizeMessage } from '../migration/transcript-normalizer.js';

export class ClaudeAdapter extends AbstractFileAdapter {
  readonly id = 'claude' as const;
  readonly name = 'Claude Code';
  readonly command = 'claude';
  readonly historyRoot: string;

  constructor(private readonly homeDirectory: string) {
    super();
    this.historyRoot = path.join(homeDirectory, '.claude', 'projects');
  }

  listSessions(): readonly SessionSummary[] {
    return findFiles(this.historyRoot, (file) => file.endsWith('.jsonl')).flatMap((sourcePath) => {
      const rows = readJsonLines(sourcePath).filter(isRecord);
      const first = rows[0];
      if (!first) return [];
      const id = asString(first.sessionId) || path.basename(sourcePath, '.jsonl');
      const firstMessage = rows.map(extractMessage).find((message) => message?.role === 'user');
      const cwd = rows.map((row) => asString(row.cwd)).find((value): value is string => Boolean(value));
      const updatedAt = asString(rows.at(-1)?.timestamp) || fs.statSync(sourcePath).mtime.toISOString();
      return [{ agent: this.id, id, title: sanitizeTitle(firstText(firstMessage)) || '未命名 Claude 会话', cwd: cwd || decodeProjectDirectory(path.dirname(sourcePath)), updatedAt, sourcePath }];
    });
  }

  readTranscript(session: SessionSummary): PortableTranscript {
    const messages = readJsonLines(session.sourcePath).flatMap((row): readonly TranscriptMessage[] => {
      const message = extractMessage(row);
      return message ? [message] : [];
    });
    return { source: session, messages, warnings: [] };
  }

  createResumeLaunch(session: SessionSummary): LaunchSpec { return { command: [this.command, '--resume', session.id], cwd: session.cwd || process.cwd() }; }

  createNewLaunch(input: { readonly cwd: string; readonly prompt?: string; readonly assetDirectory?: string }): LaunchSpec {
    const assetArgument = input.assetDirectory ? ['--add-dir', input.assetDirectory] : [];
    const promptArgument = input.prompt ? [input.prompt] : [];
    return { command: [this.command, ...assetArgument, ...promptArgument], cwd: input.cwd || process.cwd() };
  }

  deleteSession(session: SessionSummary): void { this.removeLocalPath(session.sourcePath); }

  integrationRoots(project?: string) {
    return [{ directory: path.join(this.homeDirectory, '.claude'), scope: 'user' as const }, ...(project ? [{ directory: project, scope: 'project' as const }] : [])];
  }

  listIntegrations(project?: string): readonly IntegrationItem[] { return [...super.listIntegrations(project), ...this.listInstalledPlugins(), ...this.listMcp(project)]; }
  installPlugin(plugin: string, scope: 'user' | 'project'): void { this.execute(['plugin', 'install', plugin, '--scope', scope]); }
  installSkill(sourcePath: string, scope: 'user' | 'project', project?: string): void { copySkill(sourcePath, skillDirectory(this.homeDirectory, scope, project)); }
  addMcp(name: string, configuration: string, scope: 'user' | 'project', project?: string): void { updateMcpConfig(mcpConfigPath(this.homeDirectory, scope, project), name, configuration); }

  removeIntegration(item: IntegrationItem): void {
    if (item.kind === 'plugin') { this.execute(['plugin', 'uninstall', item.name]); return; }
    if (item.kind === 'mcp') { this.execute(['mcp', 'remove', item.name]); return; }
    this.removeLocalPath(item.location);
  }

  readMcpConfiguration(item: IntegrationItem): string {
    if (item.kind !== 'mcp') throw new Error('只能复制 MCP 配置。');
    const parsed: unknown = JSON.parse(fs.readFileSync(item.location, 'utf8'));
    const servers = isRecord(parsed) && isRecord(parsed.mcpServers) ? parsed.mcpServers : undefined;
    const configuration = servers?.[item.name];
    if (!configuration) throw new Error(`无法读取 MCP 配置：${item.name}`);
    return JSON.stringify(configuration);
  }

  setIntegrationEnabled(item: IntegrationItem, enabled: boolean): void {
    if (item.kind !== 'plugin') throw new Error('Claude Code 目前只支持启用或禁用 Plugin。');
    this.execute(['plugin', enabled ? 'enable' : 'disable', item.name, '--scope', item.scope]);
  }

  private listInstalledPlugins(): readonly IntegrationItem[] {
    try {
      const parsed: unknown = JSON.parse(this.execute(['plugin', 'list', '--json']));
      if (Array.isArray(parsed)) {
        return parsed.filter(isRecord).flatMap((plugin): readonly IntegrationItem[] => {
          const name = asString(plugin.id);
          if (!name) return [];
          return [{
            agent: this.id,
            kind: 'plugin',
            name,
            scope: plugin.scope === 'project' ? 'project' as const : 'user' as const,
            location: asString(plugin.installPath) || path.join(this.homeDirectory, '.claude', 'plugins'),
            removable: true,
            ...(typeof plugin.enabled === 'boolean' ? { enabled: plugin.enabled } : {}),
          }];
        });
      }
    } catch { /* Fall back to Claude's local installation index. */ }
    const file = path.join(this.homeDirectory, '.claude', 'plugins', 'installed_plugins.json');
    if (!fs.existsSync(file)) return [];
    try {
      const parsed: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (!isRecord(parsed) || !isRecord(parsed.plugins)) return [];
      return Object.keys(parsed.plugins).map((name) => ({ agent: this.id, kind: 'plugin' as const, name, scope: 'user' as const, location: file, removable: true }));
    } catch { return []; }
  }

  private listMcp(project?: string): readonly IntegrationItem[] {
    return [mcpConfigPath(this.homeDirectory, 'user'), ...(project ? [mcpConfigPath(this.homeDirectory, 'project', project)] : [])].flatMap((file) => {
      if (!fs.existsSync(file)) return [];
      try {
        const parsed: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (!isRecord(parsed) || !isRecord(parsed.mcpServers)) return [];
        const scope = file.endsWith('.mcp.json') ? 'project' as const : 'user' as const;
        return Object.keys(parsed.mcpServers).map((name) => ({ agent: this.id, kind: 'mcp' as const, name, scope, location: file, removable: true }));
      } catch { return []; }
    });
  }
}

function extractMessage(row: unknown): TranscriptMessage | undefined { return isRecord(row) ? normalizeMessage(row.message) : undefined; }
function firstText(message: TranscriptMessage | undefined): string | undefined { const text = message?.content.find((content) => content.type === 'text'); return text?.type === 'text' ? text.text.replaceAll(/\s+/g, ' ').slice(0, 100) : undefined; }
function sanitizeTitle(value: string | undefined): string | undefined { return !value || /<(local-command-caveat|system-reminder|command-message)>|^\s*[\[{]/i.test(value) ? undefined : value; }
function decodeProjectDirectory(directory: string): string { return path.basename(directory).replaceAll('-', path.sep).replace(/^\/+/, path.sep); }
function findFiles(directory: string, match: (file: string) => boolean): readonly string[] { if (!fs.existsSync(directory)) return []; return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => { const entryPath = path.join(directory, entry.name); return entry.isDirectory() ? findFiles(entryPath, match) : entry.isFile() && match(entryPath) ? [entryPath] : []; }); }
function skillDirectory(home: string, scope: 'user' | 'project', project?: string): string { return path.join(scope === 'user' ? path.join(home, '.claude') : project || process.cwd(), 'skills'); }
function mcpConfigPath(home: string, scope: 'user' | 'project', project?: string): string { return scope === 'project' ? path.join(project || process.cwd(), '.mcp.json') : path.join(home, '.claude.json'); }
function copySkill(sourcePath: string, root: string): void { if (!fs.existsSync(sourcePath) || !fs.statSync(sourcePath).isDirectory()) throw new Error(`Skill 目录不存在：${sourcePath}`); fs.mkdirSync(root, { recursive: true }); const destination = path.join(root, path.basename(sourcePath)); if (fs.existsSync(destination)) throw new Error(`Skill 已存在：${destination}`); fs.cpSync(sourcePath, destination, { recursive: true }); }
function updateMcpConfig(filePath: string, name: string, configuration: string): void { let current: Record<string, any> = {}; if (fs.existsSync(filePath)) { const parsed: unknown = JSON.parse(fs.readFileSync(filePath, 'utf8')); if (isRecord(parsed)) current = parsed; } const server = JSON.parse(configuration); const next = { ...current, mcpServers: { ...(isRecord(current.mcpServers) ? current.mcpServers : {}), [name]: server } }; fs.mkdirSync(path.dirname(filePath), { recursive: true }); fs.writeFileSync(filePath, `${JSON.stringify(next, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 }); }
