import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import type { AgentAdapter, PortableTranscript, SessionSummary, TranscriptContentAsset } from '../agents/types.js';
import { renderPortableTranscript } from './prompt-renderer.js';

const MAX_ASSET_BYTES = 20 * 1024 * 1024;

export interface MigrationResult {
  readonly id: string;
  readonly directory: string;
  readonly assetDirectory: string;
  readonly prompt: string;
  readonly attachmentCount: number;
  readonly warnings: readonly string[];
}

export class MigrationService {
  constructor(private readonly migrationDirectory: string) {}

  prepare(source: AgentAdapter, session: SessionSummary, targetAgent: string): MigrationResult {
    const transcript = source.readTranscript(session);
    const id = crypto.randomUUID();
    const directory = path.join(this.migrationDirectory, id);
    const assetDirectory = path.join(directory, 'assets');
    fs.mkdirSync(assetDirectory, { recursive: true, mode: 0o700 });

    const copied = copyAssets(transcript, assetDirectory);
    const warnings = [...transcript.warnings, ...copied.warnings];
    const portable: PortableTranscript = { ...transcript, warnings };
    const prompt = renderPortableTranscript(portable);
    const manifest = {
      id,
      source: { agent: source.id, sessionId: session.id },
      targetAgent,
      createdAt: new Date().toISOString(),
      assets: copied.assets,
      warnings,
    };
    fs.writeFileSync(path.join(directory, 'conversation.md'), prompt, { encoding: 'utf8', mode: 0o600 });
    fs.writeFileSync(path.join(directory, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });

    return { id, directory, assetDirectory, prompt, attachmentCount: copied.assets.length, warnings };
  }
}

function copyAssets(transcript: PortableTranscript, assetDirectory: string): {
  readonly assets: readonly { readonly name: string; readonly sha256: string }[];
  readonly warnings: readonly string[];
} {
  const assets: { name: string; sha256: string }[] = [];
  const warnings: string[] = [];
  const paths = transcript.messages.flatMap((message) => message.content)
    .filter((content): content is TranscriptContentAsset => content.type === 'image' || content.type === 'file');

  paths.forEach((content, index) => {
    if (!fs.existsSync(content.path)) {
      warnings.push(`附件不可读取，未复制：${content.path}`);
      return;
    }
    const stat = fs.statSync(content.path);
    if (!stat.isFile() || stat.size > MAX_ASSET_BYTES) {
      warnings.push(`附件不是常规文件或超过 20MB，未复制：${content.path}`);
      return;
    }
    const name = `${String(index + 1).padStart(3, '0')}-${path.basename(content.path)}`;
    const destination = path.join(assetDirectory, name);
    fs.copyFileSync(content.path, destination, fs.constants.COPYFILE_EXCL);
    assets.push({ name, sha256: crypto.createHash('sha256').update(fs.readFileSync(destination)).digest('hex') });
  });

  return { assets, warnings };
}
