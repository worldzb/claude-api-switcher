import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import type { PortableTranscript, TranscriptContent, TranscriptMessage } from '../agents/types.js';
import { renderPortableTranscript } from './prompt-renderer.js';

export interface MigratedAsset {
  readonly name: string;
  readonly sourcePath: string;
  readonly destinationPath: string;
  readonly sha256: string;
}

export interface PreparedTranscript {
  readonly transcript: PortableTranscript;
  readonly prompt: string;
  readonly assets: readonly MigratedAsset[];
  readonly warnings: readonly string[];
}

export function prepareTranscript(transcript: PortableTranscript, assetDirectory: string): PreparedTranscript {
  const copied = copyAssets(transcript, assetDirectory);
  const rewrittenMessages = transcript.messages.map((message) => ({
    ...message,
    content: message.content.map((content) => rewriteAsset(content, copied.assets)),
  }));
  const warnings = [...transcript.warnings, ...copied.warnings];
  const rewritten: PortableTranscript = { ...transcript, messages: rewrittenMessages, warnings };
  return { transcript: rewritten, prompt: renderPortableTranscript(rewritten), assets: copied.assets, warnings };
}

function rewriteAsset(content: TranscriptContent, assets: readonly MigratedAsset[]): TranscriptContent {
  if (content.type === 'text') return content;
  const copied = assets.find((asset) => asset.sourcePath === content.path);
  return copied ? { ...content, path: copied.destinationPath } : content;
}

function copyAssets(transcript: PortableTranscript, assetDirectory: string): {
  readonly assets: readonly MigratedAsset[];
  readonly warnings: readonly string[];
} {
  const assets: MigratedAsset[] = [];
  const warnings: string[] = [];
  const paths = transcript.messages.flatMap((message) => message.content)
    .filter((content) => content.type === 'image' || content.type === 'file');

  paths.forEach((content, index) => {
    if (content.type !== 'image' && content.type !== 'file') return;
    if (!fs.existsSync(content.path)) {
      warnings.push(`附件不可读取，未复制：${content.path}`);
      return;
    }
    const stat = fs.statSync(content.path);
    if (!stat.isFile() || stat.size > 20 * 1024 * 1024) {
      warnings.push(`附件不是常规文件或超过 20MB，未复制：${content.path}`);
      return;
    }
    const name = `${String(index + 1).padStart(3, '0')}-${path.basename(content.path)}`;
    const destinationPath = path.join(assetDirectory, name);
    fs.copyFileSync(content.path, destinationPath, fs.constants.COPYFILE_EXCL);
    assets.push({ name, sourcePath: content.path, destinationPath, sha256: hashFile(destinationPath) });
  });

  return { assets: assets.flat(), warnings };
}

function hashFile(filePath: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}
