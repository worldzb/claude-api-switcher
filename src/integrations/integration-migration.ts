import fs from 'node:fs';
import path from 'node:path';

import type { AgentId, IntegrationItem } from '../agents/types.js';
import { createIntegrationManifest, type IntegrationManifest } from './integration-transfer.js';

export interface IntegrationMigrationResult {
  readonly manifest: IntegrationManifest;
  readonly directory: string;
  readonly copiedSkills: readonly string[];
  readonly warnings: readonly string[];
}

export function migrateIntegrations(
  items: readonly IntegrationItem[],
  sourceAgent: AgentId,
  targetAgent: AgentId,
  destinationRoot: string,
): IntegrationMigrationResult {
  const sourceItems = items.filter((item) => item.agent === sourceAgent);
  const manifest = createIntegrationManifest(sourceItems, sourceAgent, targetAgent);
  const directory = path.join(destinationRoot, `${sourceAgent}-to-${targetAgent}-${Date.now()}`);
  const skillsDirectory = path.join(directory, 'skills');
  fs.mkdirSync(skillsDirectory, { recursive: true, mode: 0o700 });
  const warnings: string[] = [];
  const copiedSkills: string[] = [];

  sourceItems.filter((item) => item.kind === 'skill').forEach((item) => {
    if (!fs.existsSync(item.location) || !fs.statSync(item.location).isDirectory()) {
      warnings.push(`Skill 不可复制：${item.name}`);
      return;
    }
    const destination = path.join(skillsDirectory, item.name);
    fs.cpSync(item.location, destination, { recursive: true, errorOnExist: true });
    copiedSkills.push(destination);
  });

  if (sourceItems.some((item) => item.kind === 'mcp')) {
    warnings.push('MCP 只迁移名称清单，不复制密钥和认证信息；请在目标 Agent 中重新配置。');
  }
  if (sourceItems.some((item) => item.kind === 'plugin')) {
    warnings.push('Plugin 只迁移名称清单；不同 Agent 的插件格式可能不兼容，请在目标 Agent 中重新安装。');
  }

  fs.writeFileSync(path.join(directory, 'manifest.json'), `${JSON.stringify({ ...manifest, copiedSkills, warnings }, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  return { manifest, directory, copiedSkills, warnings };
}
