import { describe, expect, it } from 'vitest';

import {
  addConfig,
  addCustomModel,
  addCustomModels,
  deleteConfig,
  normalizeConfigData,
  removeCustomModel,
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
      customModels: { claude: [], opencode: [], codex: [] },
    });
  });

  it('新增配置不会修改原数据', () => {
    const original = { configs: [], current: null, customModels: { claude: [], opencode: [], codex: [] } };
    const result = addConfig(original, {
      name: '官方 API',
      apiKey: 'token',
      baseUrl: 'https://api.anthropic.com',
      createdAt: '2026-08-31T00:00:00.000Z',
    });

    expect(original).toEqual({ configs: [], current: null, customModels: { claude: [], opencode: [], codex: [] } });
    expect(result.configs).toHaveLength(1);
  });

  it('删除当前配置时清除 current', () => {
    const result = deleteConfig({
      current: '官方 API',
      configs: [{ name: '官方 API', apiKey: 'token', baseUrl: 'https://api.anthropic.com' }],
      customModels: { claude: ['glm-4.6'], opencode: ['gpt-5.6'], codex: [] },
    }, '官方 API');

    expect(result).toEqual({
      configs: [],
      current: null,
      customModels: { claude: ['glm-4.6'], opencode: ['gpt-5.6'], codex: [] },
    });
  });
});

describe('自定义模型', () => {
  it('旧版扁平列表迁移为 claude 列表', () => {
    const result = normalizeConfigData({ configs: [], customModels: [' glm-4.6 ', '', 'glm-4.6', 42] });

    expect(result.customModels).toEqual({ claude: ['glm-4.6'], opencode: [], codex: [] });
  });

  it('按 agent 解析并对每个列表 trim、过滤空串、去重', () => {
    const result = normalizeConfigData({
      configs: [],
      customModels: {
        claude: ['glm-4.6', 'glm-4.6', ' '],
        opencode: [' gpt-5.6-terra ', 'gpt-5.6', 'gpt-5.6-terra'],
        codex: ['gpt-glm'],
      },
    });

    expect(result.customModels).toEqual({
      claude: ['glm-4.6'],
      opencode: ['gpt-5.6-terra', 'gpt-5.6'],
      codex: ['gpt-glm'],
    });
  });

  it('customModels 缺失或非法时归一为空列表', () => {
    expect(normalizeConfigData({ configs: [] }).customModels).toEqual({ claude: [], opencode: [], codex: [] });
    expect(normalizeConfigData({ configs: [], customModels: 'glm-4.6' }).customModels).toEqual({ claude: [], opencode: [], codex: [] });
    expect(normalizeConfigData(null).customModels).toEqual({ claude: [], opencode: [], codex: [] });
  });

  it('codex 列表独立解析与管理', () => {
    const data = { configs: [], current: null, customModels: { claude: [], opencode: [], codex: ['gpt-glm'] } };

    expect(addCustomModel(data, 'codex', ' gpt-5.6 ').customModels.codex).toEqual(['gpt-glm', 'gpt-5.6']);
    expect(() => addCustomModel(data, 'codex', 'gpt-glm')).toThrow('已存在');
    const removed = removeCustomModel(data, 'codex', 'gpt-glm');
    expect(removed.customModels.codex).toEqual([]);
    expect(removed.customModels.opencode).toEqual([]);
  });

  it('按 agent 添加自定义模型时 trim 且去重', () => {
    const data = { configs: [], current: null, customModels: { claude: ['glm-4.6'], opencode: ['gpt-5.6'], codex: [] } };

    expect(addCustomModel(data, 'claude', ' deepseek-chat ').customModels.claude).toEqual(['glm-4.6', 'deepseek-chat']);
    expect(addCustomModel(data, 'opencode', ' gpt-5.5 ').customModels.opencode).toEqual(['gpt-5.6', 'gpt-5.5']);
    expect(() => addCustomModel(data, 'claude', 'glm-4.6')).toThrow('已存在');
    expect(() => addCustomModel(data, 'opencode', '   ')).toThrow('请输入模型名称');
  });

  it('按 agent 移除自定义模型，不影响其他 agent 列表', () => {
    const data = { configs: [], current: null, customModels: { claude: ['glm-4.6'], opencode: ['gpt-5.6'], codex: [] } };

    const result = removeCustomModel(data, 'opencode', 'gpt-5.6');
    expect(result.customModels).toEqual({ claude: ['glm-4.6'], opencode: [], codex: [] });
    expect(() => removeCustomModel(data, 'claude', 'gpt-5.6')).toThrow('不存在');
  });

  it('批量添加时跳过已存在与空串并返回明细', () => {
    const data = { configs: [], current: null, customModels: { claude: ['glm-4.6'], opencode: [], codex: [] } };

    const result = addCustomModels(data, 'claude', ['deepseek-chat', ' glm-4.6 ', '  ', 'glm-4.7']);

    expect(result.data.customModels.claude).toEqual(['glm-4.6', 'deepseek-chat', 'glm-4.7']);
    expect(result.added).toEqual(['deepseek-chat', 'glm-4.7']);
    expect(result.existing).toEqual(['glm-4.6']);
    expect(data.customModels.claude).toEqual(['glm-4.6']);
  });

  it('读取旧数据时丢弃已移除的 modelGroups 字段', () => {
    const result = normalizeConfigData({
      configs: [],
      modelGroups: [{ name: 'glm', models: { claude: 'claude-glm' } }],
    });

    expect(result).toEqual({ configs: [], current: null, customModels: { claude: [], opencode: [], codex: [] } });
  });
});
