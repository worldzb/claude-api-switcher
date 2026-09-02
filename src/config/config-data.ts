import type { AgentId, ApiConfig, ConfigData, CustomModels } from './types.js';

const DEFAULT_BASE_URL = 'https://api.anthropic.com';

export function normalizeConfigData(value: unknown): ConfigData {
  if (!isRecord(value) || !Array.isArray(value.configs)) {
    return { configs: [], current: null, customModels: { claude: [], opencode: [], codex: [] } };
  }

  const configs = value.configs
    .filter(isRecord)
    .filter((config) => config.target === undefined || config.target === 'claude')
    .map(toApiConfig)
    .filter((config): config is ApiConfig => config !== null);
  const current = typeof value.current === 'string' && configs.some((config) => config.name === value.current)
    ? value.current
    : null;
  const customModels = normalizeCustomModels(value.customModels);

  return { configs, current, customModels };
}

function normalizeCustomModels(value: unknown): CustomModels {
  if (Array.isArray(value)) {
    // 旧版扁平列表仅服务于 Claude，迁移为 claude 列表
    return { claude: toStringList(value), opencode: [], codex: [] };
  }
  if (isRecord(value)) {
    return {
      claude: toStringList(value.claude),
      opencode: toStringList(value.opencode),
      codex: toStringList(value.codex),
    };
  }
  return { claude: [], opencode: [], codex: [] };
}

function toStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const models: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') {
      continue;
    }
    const model = item.trim();
    if (model && !models.includes(model)) {
      models.push(model);
    }
  }
  return models;
}

export function addConfig(data: ConfigData, config: ApiConfig): ConfigData {
  if (data.configs.some((item) => item.name === config.name)) {
    throw new Error(`配置 "${config.name}" 已存在。`);
  }

  return { ...data, configs: [...data.configs, config] };
}

export function deleteConfig(data: ConfigData, name: string): ConfigData {
  if (!data.configs.some((config) => config.name === name)) {
    throw new Error(`配置 "${name}" 不存在。`);
  }

  return {
    ...data,
    configs: data.configs.filter((config) => config.name !== name),
    current: data.current === name ? null : data.current,
  };
}

export function setCurrentConfig(data: ConfigData, name: string): ConfigData {
  if (!data.configs.some((config) => config.name === name)) {
    throw new Error(`配置 "${name}" 不存在。`);
  }

  return { ...data, current: name };
}

export function addCustomModel(data: ConfigData, agent: AgentId, name: string): ConfigData {
  const model = name.trim();
  if (!model) {
    throw new Error('请输入模型名称。');
  }
  if (data.customModels[agent].includes(model)) {
    throw new Error(`模型 "${model}" 已存在。`);
  }

  return { ...data, customModels: { ...data.customModels, [agent]: [...data.customModels[agent], model] } };
}

export interface CustomModelsAddResult {
  readonly data: ConfigData;
  readonly added: readonly string[];
  readonly existing: readonly string[];
}

export function addCustomModels(data: ConfigData, agent: AgentId, names: readonly string[]): CustomModelsAddResult {
  let current = data;
  const added: string[] = [];
  const existing: string[] = [];
  for (const raw of names) {
    const model = raw.trim();
    if (!model) {
      continue;
    }
    if (current.customModels[agent].includes(model)) {
      existing.push(model);
      continue;
    }
    current = addCustomModel(current, agent, model);
    added.push(model);
  }
  return { data: current, added, existing };
}

export function removeCustomModel(data: ConfigData, agent: AgentId, name: string): ConfigData {
  const model = name.trim();
  if (!data.customModels[agent].includes(model)) {
    throw new Error(`自定义模型 "${model}" 不存在。`);
  }

  return { ...data, customModels: { ...data.customModels, [agent]: data.customModels[agent].filter((item) => item !== model) } };
}

export function getConfig(data: ConfigData, name: string): ApiConfig {
  const config = data.configs.find((item) => item.name === name);
  if (!config) {
    throw new Error(`配置 "${name}" 不存在。`);
  }

  return config;
}

export function createApiConfig(input: {
  name: string;
  apiKey: string;
  baseUrl?: string;
  createdAt?: string;
}): ApiConfig {
  const name = input.name.trim();
  const apiKey = input.apiKey.trim();
  const baseUrl = (input.baseUrl || DEFAULT_BASE_URL).trim();

  if (!name) {
    throw new Error('请输入配置名称。');
  }
  if (!apiKey) {
    throw new Error('请输入 API Key。');
  }
  try {
    new URL(baseUrl);
  } catch {
    throw new Error('Base URL 格式不正确。');
  }

  return {
    name,
    apiKey,
    baseUrl,
    ...(input.createdAt ? { createdAt: input.createdAt } : {}),
  };
}

function toApiConfig(value: Record<string, unknown>): ApiConfig | null {
  if (typeof value.name !== 'string' || typeof value.apiKey !== 'string') {
    return null;
  }

  try {
    return createApiConfig({
      name: value.name,
      apiKey: value.apiKey,
      baseUrl: typeof value.baseUrl === 'string' ? value.baseUrl : DEFAULT_BASE_URL,
      createdAt: typeof value.createdAt === 'string' ? value.createdAt : undefined,
    });
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
