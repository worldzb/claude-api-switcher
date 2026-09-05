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

/**
 * 各模型的推理档位（reasoning effort levels），与 models.dev 的 reasoning_options 一一对应。
 * 只列出本项目可能同步到的模型；键为去掉供应商前缀后的模型 id。
 */
const MODEL_VARIANT_LEVELS: Readonly<Record<string, readonly string[]>> = {
  // DeepSeek V4
  'deepseek-v4-flash': ['low', 'high', 'max'],
  'deepseek-v4-flash-vision-exp': ['low', 'high', 'max'],
  'deepseek-v4-pro': ['high', 'max'],
  // GLM（Zhipu）
  'glm-5.2': ['high', 'max'],
  'glm-5.3': ['low', 'high', 'max'],
  'glm-5.3-flash': ['low', 'high', 'max'],
  glm: ['low', 'high', 'max'],
  'glm-flash': ['low', 'high', 'max'],
  // GPT / o 系列（OpenAI）
  'gpt-5': ['minimal', 'low', 'medium', 'high'],
  'gpt-5-mini': ['minimal', 'low', 'medium', 'high'],
  'gpt-5-nano': ['minimal', 'low', 'medium', 'high'],
  'gpt-5-pro': ['high'],
  'gpt-5.1': ['none', 'low', 'medium', 'high'],
  'gpt-5.2': ['none', 'low', 'medium', 'high', 'xhigh'],
  'gpt-5.2-pro': ['medium', 'high', 'xhigh'],
  'gpt-5.3-codex': ['none', 'low', 'medium', 'high', 'xhigh'],
  'gpt-5.3-codex-spark': ['none', 'low', 'medium', 'high', 'xhigh'],
  'gpt-5.4': ['none', 'low', 'medium', 'high', 'xhigh'],
  'gpt-5.4-mini': ['none', 'low', 'medium', 'high', 'xhigh'],
  'gpt-5.4-nano': ['none', 'low', 'medium', 'high', 'xhigh'],
  'gpt-5.4-pro': ['medium', 'high', 'xhigh'],
  'gpt-5.5': ['none', 'low', 'medium', 'high', 'xhigh'],
  'gpt-5.5-pro': ['medium', 'high', 'xhigh'],
  'gpt-5.6': ['none', 'low', 'medium', 'high', 'xhigh', 'max'],
  'gpt-5.6-luna': ['none', 'low', 'medium', 'high', 'xhigh', 'max'],
  'gpt-5.6-sol': ['none', 'low', 'medium', 'high', 'xhigh', 'max'],
  'gpt-5.6-terra': ['none', 'low', 'medium', 'high', 'xhigh', 'max'],
  // 无推理档位的模型（图像等）
  'gpt-image-2': [],
};

/** 未列出的模型回退到 GPT 系默认四档，保持原有行为。 */
const DEFAULT_VARIANTS: readonly string[] = ['low', 'medium', 'high', 'xhigh'];

function variantsFor(id: string): Record<string, unknown> {
  return Object.fromEntries(variantLevelsFor(id).map((level) => [level, {}]));
}

function variantLevelsFor(id: string): readonly string[] {
  const key = normalizeModelKey(id);
  const exact = MODEL_VARIANT_LEVELS[key];
  if (exact !== undefined) {
    return exact;
  }

  // wxhand 中转以 gpt- 前缀包装第三方模型，剥离后再匹配底层模型
  if (key.startsWith('gpt-')) {
    const underlying = MODEL_VARIANT_LEVELS[key.slice('gpt-'.length)];
    if (underlying !== undefined) {
      return underlying;
    }
  }

  if (key.includes('deepseek')) {
    return ['low', 'high', 'max'];
  }
  if (key.startsWith('glm')) {
    return ['low', 'high', 'max'];
  }
  return DEFAULT_VARIANTS;
}

function normalizeModelKey(id: string): string {
  const value = id.trim().toLowerCase();
  const slash = value.lastIndexOf('/');
  return slash >= 0 ? value.slice(slash + 1) : value;
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
