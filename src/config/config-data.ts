import type { ApiConfig, ConfigData } from './types.js';

const DEFAULT_BASE_URL = 'https://api.anthropic.com';

export function normalizeConfigData(value: unknown): ConfigData {
  if (!isRecord(value) || !Array.isArray(value.configs)) {
    return { configs: [], current: null };
  }

  const configs = value.configs
    .filter(isRecord)
    .filter((config) => config.target === undefined || config.target === 'claude')
    .map(toApiConfig)
    .filter((config): config is ApiConfig => config !== null);
  const current = typeof value.current === 'string' && configs.some((config) => config.name === value.current)
    ? value.current
    : null;

  return { configs, current };
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
