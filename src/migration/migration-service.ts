import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import type { AgentAdapter, SessionSummary } from '../agents/types.js';
import { prepareTranscript } from './native-transcript.js';

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

    const copied = prepareTranscript(transcript, assetDirectory);
    const warnings = copied.warnings;
    const prompt = copied.prompt;
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
