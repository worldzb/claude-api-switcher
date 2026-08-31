import { describe, expect, it } from 'vitest';

import {
  addConfig,
  deleteConfig,
  normalizeConfigData,
} from '../src/config/config-data.js';

describe('配置数据', () => {
  it('读取旧数据时移除不受支持的配置和字段', () => {
    const result = normalizeConfigData({
      current: 'legacy',
      configs: [
        {
          name: 'Claude',
          apiKey: 'token',
          baseUrl: 'https://api.example.com',
          deprecatedProvider: 'legacy',
          target: 'claude',
        },
        {
          name: 'legacy',
          apiKey: 'legacy-token',
          baseUrl: 'https://legacy.example.com',
          target: 'legacy',
        },
      ],
    });

    expect(result).toEqual({
      current: null,
      configs: [
        {
          name: 'Claude',
          apiKey: 'token',
          baseUrl: 'https://api.example.com',
        },
      ],
    });
  });

  it('新增配置不会修改原数据', () => {
    const original = { configs: [], current: null };
    const result = addConfig(original, {
      name: '官方 API',
      apiKey: 'token',
      baseUrl: 'https://api.anthropic.com',
      createdAt: '2026-08-31T00:00:00.000Z',
    });

    expect(original).toEqual({ configs: [], current: null });
    expect(result.configs).toHaveLength(1);
  });

  it('删除当前配置时清除 current', () => {
    const result = deleteConfig({
      current: '官方 API',
      configs: [{ name: '官方 API', apiKey: 'token', baseUrl: 'https://api.anthropic.com' }],
    }, '官方 API');

    expect(result).toEqual({ configs: [], current: null });
  });
});
