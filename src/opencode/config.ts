import fs from 'node:fs';
import path from 'node:path';

export const OPENCODE_PROVIDER_ID = 'wxhand';
export const OPENCODE_ANTHROPIC_PROVIDER_ID = 'anthropic';

export type OpenCodeConfig = Readonly<Record<string, unknown>>;

export function resolveOpenCodeConfigFile(homeDirectory: string): string {
  const directory = path.join(homeDirectory, '.config', 'opencode');
  for (const name of ['opencode.jsonc', 'opencode.json']) {
    const filePath = path.join(directory, name);
    if (fs.existsSync(filePath)) {
      return filePath;
    }
  }
  return path.join(directory, 'opencode.jsonc');
}

export function readOpenCodeConfig(filePath: string): OpenCodeConfig {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  try {
    const value: unknown = JSON.parse(stripJsoncComments(fs.readFileSync(filePath, 'utf8')));
    if (!isRecord(value)) {
      throw new Error('配置必须是对象。');
    }
    return value;
  } catch {
    throw new Error(`无法读取 OpenCode 配置文件：${filePath}`);
  }
}

export function writeOpenCodeConfig(filePath: string, config: OpenCodeConfig): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
}

export function listProviderModels(config: OpenCodeConfig, providerId = OPENCODE_PROVIDER_ID): readonly string[] {
  const provider = getProviderEntry(config, providerId);
  const models = isRecord(provider.models) ? provider.models : {};
  return Object.keys(models);
}

export function findCurrentOpenCodeModel(config: OpenCodeConfig): string | undefined {
  const model = config.model;
  return typeof model === 'string' && model.trim() ? model : undefined;
}

export function resolveOpenCodeProviderId(modelId: string): string {
  const value = modelId.trim().toLowerCase();
  const slash = value.indexOf('/');
  if (slash > 0) {
    const prefix = value.slice(0, slash);
    if (prefix === OPENCODE_PROVIDER_ID || prefix === OPENCODE_ANTHROPIC_PROVIDER_ID) {
      return prefix;
    }
  }
  const name = slash >= 0 ? value.slice(slash + 1) : value;
  return name.startsWith('claude') ? OPENCODE_ANTHROPIC_PROVIDER_ID : OPENCODE_PROVIDER_ID;
}

export function applyOpenCodeModel(config: OpenCodeConfig, modelId: string, providerId?: string): OpenCodeConfig {
  const value = modelId.trim();
  if (!value) {
    throw new Error('请输入模型名称。');
  }

  // OpenCode 走 wxhand 接口，不能注册 claude 模型
  if (providerId === undefined && resolveOpenCodeProviderId(value) === OPENCODE_ANTHROPIC_PROVIDER_ID) {
    throw new Error('OpenCode 的 wxhand 接口不支持 claude 模型。');
  }

  const target = providerId ?? OPENCODE_PROVIDER_ID;
  const model = value.includes('/') ? value : `${target}/${value}`;
  const id = model.slice(model.indexOf('/') + 1);
  const provider = isRecord(config.provider) ? { ...config.provider } : {};
  const entry = isRecord(provider[target]) ? { ...provider[target] as Record<string, unknown> } : {};
  const models = isRecord(entry.models) ? { ...entry.models } : {};
  if (!isRecord(models[id])) {
    models[id] = createModelEntry(id);
  }
  provider[target] = { ...entry, models };
  return { ...config, model, provider };
}

export interface RegisterModelsResult {
  readonly config: OpenCodeConfig;
  readonly added: readonly string[];
  readonly existing: readonly string[];
}

export function registerProviderModels(
  config: OpenCodeConfig,
  modelIds: readonly string[],
  providerId = OPENCODE_PROVIDER_ID,
): RegisterModelsResult {
  const provider = isRecord(config.provider) ? { ...config.provider } : {};
  const entry = isRecord(provider[providerId]) ? { ...provider[providerId] as Record<string, unknown> } : {};
  const models = isRecord(entry.models) ? { ...entry.models } : {};
  const added: string[] = [];
  const existing: string[] = [];

  for (const raw of modelIds) {
    const id = raw.trim();
    if (!id) {
      continue;
    }
    if (isRecord(models[id])) {
      existing.push(id);
      continue;
    }
    models[id] = createModelEntry(id);
    added.push(id);
  }

  provider[providerId] = { ...entry, models };
  return { config: { ...config, provider }, added, existing };
}

export interface UnregisterModelsResult {
  readonly config: OpenCodeConfig;
  readonly removed: readonly string[];
  readonly modelCleared: boolean;
}

/** 撤回注册：从 provider.models 中移除指定模型；顶层 model 若指向被移除的模型则一并清除。 */
export function unregisterProviderModels(
  config: OpenCodeConfig,
  modelIds: readonly string[],
  providerId = OPENCODE_PROVIDER_ID,
): UnregisterModelsResult {
  const names = [...new Set(modelIds.map((model) => model.trim()).filter((model) => model !== ''))];
  const provider = isRecord(config.provider) ? { ...config.provider } : {};
  const entry = isRecord(provider[providerId]) ? { ...provider[providerId] as Record<string, unknown> } : {};
  const models = isRecord(entry.models) ? { ...entry.models } : {};

  const removed = names.filter((name) => isRecord(models[name]));
  if (removed.length === 0) {
    return { config, removed, modelCleared: false };
  }
  for (const name of removed) {
    delete models[name];
  }
  provider[providerId] = { ...entry, models };

  const current = typeof config.model === 'string' ? config.model : '';
  const modelCleared = removed.some((name) => current === name || current === `${providerId}/${name}`);
  const next: OpenCodeConfig = { ...config, provider };
  return { config: modelCleared ? clearOpenCodeModel(next) : next, removed, modelCleared };
}

export function clearOpenCodeModel(config: OpenCodeConfig): OpenCodeConfig {
  if (config.model === undefined) {
    return config;
  }

  const { model: _model, ...rest } = config;
  return rest;
}

function getProviderEntry(config: OpenCodeConfig, providerId: string): Record<string, unknown> {
  const provider = isRecord(config.provider) ? config.provider : {};
  const entry = provider[providerId];
  return isRecord(entry) ? entry : {};
}

function createModelEntry(id: string): Record<string, unknown> {
  return {
    name: id,
    limit: { context: 400000, output: 128000 },
    options: { store: false },
    variants: variantsFor(id),
  };
}

/** opencode 各模型族的思考档位（reasoning effort levels），依据 models.dev 的 reasoning_options 而定。 */
const FAMILY_VARIANTS: Readonly<Record<string, readonly string[]>> = {
  deepseek: ['low', 'high', 'max'],
  glm: ['low', 'high', 'max'],
};

/** 未匹配模型族的 GPT 系默认四档。 */
const DEFAULT_VARIANTS: readonly string[] = ['low', 'medium', 'high', 'xhigh'];

function variantsFor(id: string): Record<string, unknown> {
  const name = id.toLowerCase();
  const family = Object.keys(FAMILY_VARIANTS).find((key) => name.includes(key));
  const levels = family ? FAMILY_VARIANTS[family] : DEFAULT_VARIANTS;
  return Object.fromEntries(levels.map((level) => [level, {}]));
}

export function stripJsoncComments(source: string): string {
  let result = '';
  let index = 0;
  let inString = false;
  while (index < source.length) {
    const char = source[index];
    const next = source[index + 1];
    if (inString) {
      result += char;
      if (char === '\\' && next !== undefined) {
        result += next;
        index += 2;
        continue;
      }
      if (char === '"') {
        inString = false;
      }
      index += 1;
      continue;
    }
    if (char === '"') {
      inString = true;
      result += char;
      index += 1;
      continue;
    }
    if (char === '/' && next === '/') {
      while (index < source.length && source[index] !== '\n') {
        index += 1;
      }
      continue;
    }
    if (char === '/' && next === '*') {
      index += 2;
      while (index < source.length && !(source[index] === '*' && source[index + 1] === '/')) {
        index += 1;
      }
      index += 2;
      continue;
    }
    result += char;
    index += 1;
  }
  return result;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
