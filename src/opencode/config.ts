import fs from 'node:fs';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';

import { reasoningLevelsFor, supportsImageInput } from '../model-capabilities.js';

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

export interface RegisterModelsOptions {
  readonly providerId?: string;
  /** 覆盖同步：重建已注册模型由 zmai 管理的字段，并清理已从自定义列表移除的 zmai 生成条目。 */
  readonly overwrite?: boolean;
}

export interface RegisterModelsResult {
  readonly config: OpenCodeConfig;
  readonly added: readonly string[];
  /** 注册前就已存在的模型 id；覆盖同步时其中被重建的部分同时出现在 overwritten 中 */
  readonly existing: readonly string[];
  readonly updated: readonly string[];
  /** 覆盖同步时 zmai 管理字段确已变化的已注册模型（恒为 existing 的子集） */
  readonly overwritten: readonly string[];
  /** 覆盖同步时清理掉的陈旧 zmai 生成模型（与 overwritten 恒不相交） */
  readonly pruned: readonly string[];
  /** 顶层 model 指向被清理的模型时被一并清除 */
  readonly modelCleared: boolean;
}

/**
 * 把自定义模型注册到 provider。
 *
 * 默认（保守）：只补充缺失的模型，以及为已注册模型补齐图片能力、升级此前的 400K 上下文；
 * 手工写的能力定义保持不变，也从不删除任何现有模型。
 *
 * overwrite：额外重建已注册模型由 zmai 管理的字段（limit / modalities / options / variants，
 * 保留 name 与其他自定义键），并清理已不在自定义列表中的 zmai 生成条目。
 * 注意两处刻意的不对称：覆盖作用于**所有**已存在条目（含手工写的），而清理只作用于能判定为
 * zmai 生成的条目 —— 刷新字段可重算，删除条目不可逆。
 */
export function registerProviderModels(
  config: OpenCodeConfig,
  modelIds: readonly string[],
  options: RegisterModelsOptions = {},
): RegisterModelsResult {
  const providerId = options.providerId ?? OPENCODE_PROVIDER_ID;
  const overwrite = options.overwrite === true;
  const provider = isRecord(config.provider) ? { ...config.provider } : {};
  const entry = isRecord(provider[providerId]) ? { ...provider[providerId] as Record<string, unknown> } : {};
  const models = isRecord(entry.models) ? { ...entry.models } : {};
  const added: string[] = [];
  const existing: string[] = [];
  const updated: string[] = [];
  const overwritten: string[] = [];
  const pruned: string[] = [];
  const keep = new Set<string>();

  for (const raw of modelIds) {
    const id = raw.trim();
    if (!id) {
      continue;
    }
    keep.add(id);
    if (isRecord(models[id])) {
      existing.push(id);
      if (overwrite) {
        const overwrittenModel = overwriteGeneratedModelEntry(models[id], id);
        // 仅在定义确已变化时替换，未变化的条目保持原对象以维持键序（写入 diff 最小）
        if (!isDeepStrictEqual(overwrittenModel, models[id])) {
          models[id] = overwrittenModel;
          overwritten.push(id);
        }
        continue;
      }
      const updatedModel = updateGeneratedModelEntry(models[id], id);
      if (updatedModel !== models[id]) {
        models[id] = updatedModel;
        updated.push(id);
      }
      continue;
    }
    models[id] = createModelEntry(id);
    added.push(id);
  }

  if (overwrite) {
    for (const id of Object.keys(models)) {
      if (keep.has(id)) {
        continue;
      }
      const model = models[id];
      if (isRecord(model) && isGeneratedModelEntry(model, id)) {
        delete models[id];
        pruned.push(id);
      }
    }
  }

  provider[providerId] = { ...entry, models };
  const next: OpenCodeConfig = { ...config, provider };
  const cleared = clearDanglingModel(next, providerId, pruned);
  return {
    config: cleared,
    added,
    existing,
    updated,
    overwritten,
    pruned,
    modelCleared: cleared !== next,
  };
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

  const next: OpenCodeConfig = { ...config, provider };
  const cleared = clearDanglingModel(next, providerId, removed);
  return { config: cleared, removed, modelCleared: cleared !== next };
}

/** 顶层 model 指向被移除的模型时一并清除，避免留下悬空引用。 */
function clearDanglingModel(config: OpenCodeConfig, providerId: string, removed: readonly string[]): OpenCodeConfig {
  const current = typeof config.model === 'string' ? config.model : '';
  return removed.some((name) => current === name || current === `${providerId}/${name}`)
    ? clearOpenCodeModel(config)
    : config;
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
    limit: { context: 1_000_000, output: 128000 },
    ...(supportsImageInput(id) ? { modalities: { input: ['text', 'image'] } } : {}),
    options: { store: false },
    variants: variantsFor(id),
  };
}

function updateGeneratedModelEntry(model: Record<string, unknown>, id: string): Record<string, unknown> {
  let updated = model;
  if (isGeneratedModelEntry(model, id) && isLegacyContextLimit(model.limit)) {
    updated = { ...updated, limit: { context: 1_000_000, output: 128000 } };
  }
  if (supportsImageInput(id) && updated.modalities === undefined) {
    updated = { ...updated, modalities: { input: ['text', 'image'] } };
  }
  return updated;
}

/**
 * 覆盖同步：用当前定义重建 zmai 管理的字段，保留 name 与其他自定义键。
 *
 * modalities 只在能判定条目由 zmai 生成时才会删除：supportsImageInput 是按模型名猜测的，
 * 对不认识的模型名（o3-mini、kimi-k2 之类）会返回 false，据此删掉手工声明的图片能力
 * 会让 OpenCode 静默失去图片附件支持。写入（含覆盖）是安全的，删除才需要凭据。
 */
function overwriteGeneratedModelEntry(model: Record<string, unknown>, id: string): Record<string, unknown> {
  const generated = createModelEntry(id);
  const next: Record<string, unknown> = {
    ...model,
    limit: generated.limit,
    options: generated.options,
    variants: generated.variants,
  };
  if (generated.modalities !== undefined) {
    next.modalities = generated.modalities;
  } else if (isGeneratedModelEntry(model, id)) {
    delete next.modalities;
  }
  return next;
}

function isGeneratedModelEntry(model: Record<string, unknown>, id: string): boolean {
  return model.name === id && isRecord(model.options) && model.options.store === false;
}

function isLegacyContextLimit(value: unknown): boolean {
  return isRecord(value) && value.context === 400000 && value.output === 128000;
}

function variantsFor(id: string): Record<string, unknown> {
  return Object.fromEntries(reasoningLevelsFor(id).map((level) => [level, {}]));
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
