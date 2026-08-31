import fs from 'node:fs';
import path from 'node:path';

import type { ApiConfig, ClaudeSettings } from '../config/types.js';

export function readClaudeSettings(filePath: string): ClaudeSettings {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  try {
    const value: unknown = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!isRecord(value)) {
      throw new Error('settings.json 必须是对象。');
    }
    return value;
  } catch {
    throw new Error(`无法读取 Claude 设置文件：${filePath}`);
  }
}

export function writeClaudeSettings(filePath: string, settings: ClaudeSettings): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(settings, null, 2)}\n`, 'utf8');
}

export function applyDefaultConfig(settings: ClaudeSettings, config: ApiConfig): ClaudeSettings {
  const env = isRecord(settings.env) ? settings.env : {};
  return {
    ...settings,
    env: {
      ...env,
      ANTHROPIC_AUTH_TOKEN: config.apiKey,
      ANTHROPIC_BASE_URL: config.baseUrl,
    },
  };
}

export function findActiveConfig(
  configs: readonly ApiConfig[],
  settings: ClaudeSettings,
): ApiConfig | undefined {
  const authToken = settings.env?.ANTHROPIC_AUTH_TOKEN;
  const baseUrl = settings.env?.ANTHROPIC_BASE_URL;
  if (typeof authToken !== 'string' || typeof baseUrl !== 'string') {
    return undefined;
  }

  return configs.find((config) => config.apiKey === authToken && config.baseUrl === baseUrl);
}

export function createTemporaryExports(config: ApiConfig): string {
  return [
    `export ANTHROPIC_API_KEY=${shellQuote(config.apiKey)}`,
    `export ANTHROPIC_BASE_URL=${shellQuote(config.baseUrl)}`,
  ].join('\n');
}

export function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
