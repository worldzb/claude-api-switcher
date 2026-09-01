import fs from 'node:fs';
import path from 'node:path';

import type { AgentId, PortableTranscript, SessionSummary } from '../agents/types.js';
import type { MigrationResult } from './migration-service.js';
import { createTargetTranscript } from './target-transcript.js';

export interface NativeMigrationPlan {
  readonly target: AgentId;
  readonly source: SessionSummary;
  readonly migration: MigrationResult;
  readonly prompt: string;
  readonly assetPaths: readonly string[];
}

export function createNativeMigrationPlan(target: AgentId, source: SessionSummary, migration: MigrationResult, transcript: PortableTranscript): NativeMigrationPlan {
  const converted = createTargetTranscript({ ...transcript, messages: transcript.messages, warnings: migration.warnings });
  return { target, source, migration, prompt: converted.prompt, assetPaths: converted.assetPaths.map((asset) => mapAssetPath(asset, migration)), };
}

export function writeOpenCodeImportFile(plan: NativeMigrationPlan): string {
  const filePath = path.join(plan.migration.directory, 'opencode-import.json');
  const content = {
    version: 1,
    title: `从 ${plan.source.agent} 迁移：${plan.source.title}`,
    directory: plan.source.cwd,
    messages: [{ role: 'user', content: plan.prompt }],
  };
  fs.writeFileSync(filePath, `${JSON.stringify(content, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  return filePath;
}

function mapAssetPath(asset: string, migration: MigrationResult): string {
  const name = path.basename(asset);
  const candidate = path.join(migration.assetDirectory, name);
  return fs.existsSync(candidate) ? candidate : asset;
}
