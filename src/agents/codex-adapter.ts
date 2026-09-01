import fs from 'node:fs';
import path from 'node:path';

import { AbstractFileAdapter } from './abstract-file-adapter.js';
import { asString, isRecord, readJsonLines } from './jsonl.js';
import type { IntegrationItem, LaunchSpec, PortableTranscript, SessionSummary, TranscriptMessage } from './types.js';
import { normalizeMessage } from '../migration/transcript-normalizer.js';

export class CodexAdapter extends AbstractFileAdapter {
  readonly id = 'codex' as const;
  readonly name = 'Codex';
  readonly command = 'codex';
  readonly historyRoot: string;

  constructor(private readonly homeDirectory: string) {
    super();
    this.historyRoot = path.join(homeDirectory, '.codex', 'sessions');
  }

  listSessions(): readonly SessionSummary[] {
    return findFiles(this.historyRoot).flatMap((sourcePath) => {
      const rows = readJsonLines(sourcePath).filter(isRecord);
      const metadata = rows.find((row) => row.type === 'session_meta' || row.type === 'session_metadata');
      const payload = isRecord(metadata?.payload) ? metadata.payload : metadata || {};
      const id = asString(payload.id) || sessionIdFromFile(sourcePath);
      const messages = rows.map(extractMessage).filter((message): message is TranscriptMessage => message !== undefined);
      return [{
        agent: this.id,
        id,
        title: sanitizeTitle(firstText(messages)) || '未命名 Codex 会话',
        cwd: asString(payload.cwd) || process.cwd(),
        updatedAt: asString(rows.at(-1)?.timestamp) || fs.statSync(sourcePath).mtime.toISOString(),
        sourcePath,
      }];
    });
  }

  readTranscript(session: SessionSummary): PortableTranscript {
    const messages = readJsonLines(session.sourcePath)
      .map(extractMessage)
      .filter((message): message is TranscriptMessage => message !== undefined);
    return { source: session, messages, warnings: [] };
  }

  createResumeLaunch(session: SessionSummary): LaunchSpec {
    return { command: [this.command, 'resume', session.id], cwd: session.cwd || process.cwd() };
  }

  createNewLaunch(input: { readonly cwd: string; readonly prompt?: string; readonly assetDirectory?: string }): LaunchSpec {
    const imageArgs = input.assetDirectory ? imageArguments(input.assetDirectory) : [];
    const promptArgument = input.prompt ? [input.prompt] : [];
    return { command: [this.command, ...imageArgs, ...promptArgument], cwd: input.cwd || process.cwd() };
  }

  deleteSession(session: SessionSummary): void {
    this.execute(['delete', '--force', session.id], session.cwd);
  }

  integrationRoots(project?: string) {
    return [
      { directory: path.join(this.homeDirectory, '.codex'), scope: 'user' as const },
      ...(project ? [{ directory: path.join(project, '.codex'), scope: 'project' as const }] : []),
    ];
  }

  listIntegrations(project?: string): readonly IntegrationItem[] {
    return [...super.listIntegrations(project), ...this.listPlugins(), ...this.listMcp()];
  }

  installPlugin(plugin: string): void {
    this.execute(['plugin', 'add', plugin]);
  }

  installSkill(sourcePath: string, scope: 'user' | 'project', project?: string): void {
    copySkill(sourcePath, path.join(scope === 'user' ? this.homeDirectory : project || process.cwd(), '.codex', 'skills'));
  }

  addMcp(name: string, configuration: string): void {
    const parsed = JSON.parse(configuration) as { readonly url?: string; readonly command?: string; readonly args?: readonly string[] };
    if (parsed.url) {
      this.execute(['mcp', 'add', name, '--url', parsed.url]);
      return;
    }
    if (parsed.command) {
      this.execute(['mcp', 'add', name, '--', parsed.command, ...(parsed.args || [])]);
      return;
    }
    throw new Error('Codex MCP 配置需要 url 或 command。');
  }

  removeIntegration(item: IntegrationItem): void {
    if (item.kind === 'plugin') {
      this.execute(['plugin', 'remove', item.name]);
      return;
    }
    if (item.kind === 'mcp') {
      this.execute(['mcp', 'remove', item.name]);
      return;
    }
    this.removeLocalPath(item.location);
  }

  readMcpConfiguration(item: IntegrationItem): string {
    if (item.kind !== 'mcp') throw new Error('只能复制 MCP 配置。');
    return this.execute(['mcp', 'get', item.name, '--json']);
  }

  private listPlugins(): readonly IntegrationItem[] {
    try {
      return toCommandItems(this.execute(['plugin', 'list']), this.id, 'plugin');
    } catch {
      return [];
    }
  }

  private listMcp(): readonly IntegrationItem[] {
    try {
      return toCommandItems(this.execute(['mcp', 'list']), this.id, 'mcp');
    } catch {
      return [];
    }
  }
}

function extractMessage(row: unknown): TranscriptMessage | undefined {
  if (!isRecord(row)) return undefined;
  const payload = isRecord(row.payload) ? row.payload : row;
  const direct = normalizeMessage(payload.message || payload);
  if (direct) return direct;
  if (payload.type === 'response_item' && isRecord(payload.payload)) return normalizeMessage(payload.payload);
  return undefined;
}

function firstText(messages: readonly TranscriptMessage[]): string | undefined {
  const message = messages.find((item) => item.role === 'user');
  const text = message?.content.find((content) => content.type === 'text');
  return text?.type === 'text' ? text.text.replaceAll(/\s+/g, ' ').slice(0, 100) : undefined;
}

function sanitizeTitle(value: string | undefined): string | undefined {
  if (!value || /<environment_context>|# AGENTS\.md instructions|^\s*[\[{]/i.test(value)) {
    return undefined;
  }
  return value;
}

function sessionIdFromFile(sourcePath: string): string {
  const match = path.basename(sourcePath).match(/([0-9a-f]{8}-[0-9a-f-]{27,})\.jsonl$/i);
  return match?.[1] || path.basename(sourcePath, '.jsonl');
}

function imageArguments(directory: string): readonly string[] {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory)
    .filter((file) => /\.(png|jpe?g|gif|webp)$/i.test(file))
    .flatMap((file) => ['--image', path.join(directory, file)]);
}

function toCommandItems(
  output: string,
  agent: 'codex',
  kind: IntegrationItem['kind'],
): readonly IntegrationItem[] {
  return output.split('\n')
    .map((line) => line.trim().split(/\s+/)[0])
    .filter((name): name is string => Boolean(name) && !/^(name|no|installed)/i.test(name))
    .map((name) => ({ agent, kind, name, scope: 'user' as const, location: `codex ${kind}`, removable: true }));
}

function copySkill(sourcePath: string, root: string): void {
  if (!fs.existsSync(sourcePath) || !fs.statSync(sourcePath).isDirectory()) throw new Error(`Skill 目录不存在：${sourcePath}`);
  fs.mkdirSync(root, { recursive: true });
  const destination = path.join(root, path.basename(sourcePath));
  if (fs.existsSync(destination)) throw new Error(`Skill 已存在：${destination}`);
  fs.cpSync(sourcePath, destination, { recursive: true });
}

function findFiles(directory: string): readonly string[] {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry): readonly string[] => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return findFiles(entryPath);
    return entry.isFile() && entry.name.endsWith('.jsonl') ? [entryPath] : [];
  });
}
