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
      return [{
        agent: this.id,
        id,
        title: sanitizeTitle(firstText(firstMessage)) || '未命名 Claude 会话',
        cwd: cwd || decodeProjectDirectory(path.dirname(sourcePath)),
        updatedAt,
        sourcePath,
      }];
    });
  }

  readTranscript(session: SessionSummary): PortableTranscript {
    const messages = readJsonLines(session.sourcePath).flatMap((row): readonly TranscriptMessage[] => {
      const message = extractMessage(row);
      return message ? [message] : [];
    });
    return { source: session, messages, warnings: [] };
  }

  createResumeLaunch(session: SessionSummary): LaunchSpec {
    return { command: [this.command, '--resume', session.id], cwd: session.cwd || process.cwd() };
  }

  createNewLaunch(input: { readonly cwd: string; readonly prompt?: string; readonly assetDirectory?: string }): LaunchSpec {
    const assetArgument = input.assetDirectory ? ['--add-dir', input.assetDirectory] : [];
    const promptArgument = input.prompt ? [input.prompt] : [];
    return { command: [this.command, ...assetArgument, ...promptArgument], cwd: input.cwd || process.cwd() };
  }

  deleteSession(session: SessionSummary): void {
    this.removeLocalPath(session.sourcePath);
  }

  integrationRoots(project?: string) {
    return [
      { directory: path.join(this.homeDirectory, '.claude'), scope: 'user' as const },
      ...(project ? [{ directory: project, scope: 'project' as const }] : []),
    ];
  }

  listIntegrations(project?: string): readonly IntegrationItem[] {
    return [...super.listIntegrations(project), ...this.listInstalledPlugins(), ...this.listMcp(project)];
  }

  installPlugin(plugin: string): void {
    this.execute(['plugin', 'install', plugin]);
  }

  removeIntegration(item: IntegrationItem): void {
    if (item.kind === 'plugin') {
      this.execute(['plugin', 'uninstall', item.name]);
      return;
    }
    if (item.kind === 'mcp') {
      this.execute(['mcp', 'remove', item.name]);
      return;
    }
    this.removeLocalPath(item.location);
  }

  private listInstalledPlugins(): readonly IntegrationItem[] {
    const file = path.join(this.homeDirectory, '.claude', 'plugins', 'installed_plugins.json');
    if (!fs.existsSync(file)) return [];
    try {
      const parsed: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (!isRecord(parsed) || !isRecord(parsed.plugins)) return [];
      return Object.keys(parsed.plugins).map((name) => ({
        agent: this.id,
        kind: 'plugin' as const,
        name,
        scope: 'user' as const,
        location: file,
        removable: true,
      }));
    } catch {
      return [];
    }
  }

  private listMcp(project?: string): readonly IntegrationItem[] {
    const configFiles = [
      path.join(this.homeDirectory, '.claude.json'),
      ...(project ? [path.join(project, '.mcp.json')] : []),
    ];
    return configFiles.flatMap((file) => {
      if (!fs.existsSync(file)) return [];
      try {
        const parsed: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (!isRecord(parsed) || !isRecord(parsed.mcpServers)) return [];
        const scope = file.endsWith('.mcp.json') ? 'project' as const : 'user' as const;
        return Object.keys(parsed.mcpServers).map((name) => ({
          agent: this.id,
          kind: 'mcp' as const,
          name,
          scope,
          location: file,
          removable: true,
        }));
      } catch {
        return [];
      }
    });
  }
}

function extractMessage(row: unknown): TranscriptMessage | undefined {
  if (!isRecord(row)) return undefined;
  return normalizeMessage(row.message);
}

function firstText(message: TranscriptMessage | undefined): string | undefined {
  const text = message?.content.find((content) => content.type === 'text');
  return text?.type === 'text' ? text.text.replaceAll(/\s+/g, ' ').slice(0, 100) : undefined;
}

function sanitizeTitle(value: string | undefined): string | undefined {
  if (!value || /<(local-command-caveat|system-reminder|command-message)>|^\s*[\[{]/i.test(value)) {
    return undefined;
  }
  return value;
}

function decodeProjectDirectory(directory: string): string {
  return path.basename(directory).replaceAll('-', path.sep).replace(/^\/+/, path.sep);
}

function findFiles(directory: string, match: (file: string) => boolean): readonly string[] {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry): readonly string[] => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return findFiles(entryPath, match);
    return entry.isFile() && match(entryPath) ? [entryPath] : [];
  });
}
