import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  applyOpenCodeModel,
  clearOpenCodeModel,
  findCurrentOpenCodeModel,
  listProviderModels,
  readOpenCodeConfig,
  registerProviderModels,
  resolveOpenCodeConfigFile,
  resolveOpenCodeProviderId,
  stripJsoncComments,
  unregisterProviderModels,
  writeOpenCodeConfig,
} from '../src/opencode/config.js';

const directories: string[] = [];

afterEach(() => {
  directories.forEach((directory) => fs.rmSync(directory, { recursive: true, force: true }));
  directories.length = 0;
});

function tempHome(): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'zmai-opencode-'));
  directories.push(directory);
  return directory;
}

describe('JSONC 解析', () => {
  it('移除行注释与块注释但保留字符串内容', () => {
    const source = [
      '{',
      '  // 行注释 https://example.com',
      '  "url": "https://api.example.com", /* 块注释 */',
      '  "note": "字符串中的 // 和 /* 不受影响",',
      '  "escape": "说\\"话\\"",',
      '  "key": "value"',
      '}',
    ].join('\n');

    expect(JSON.parse(stripJsoncComments(source))).toEqual({
      url: 'https://api.example.com',
      note: '字符串中的 // 和 /* 不受影响',
      escape: '说"话"',
      key: 'value',
    });
  });

  it('读取带注释的 opencode.jsonc', () => {
    const home = tempHome();
    const filePath = path.join(home, '.config', 'opencode', 'opencode.jsonc');
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, '{\n  // 默认配置\n  "model": "openai/gpt-5.5",\n  "theme": "dark"\n}');

    expect(readOpenCodeConfig(filePath)).toEqual({
      model: 'openai/gpt-5.5',
      theme: 'dark',
    });
  });
});

describe('OpenCode 模型切换', () => {
  it('切换已注册模型时保留原有定义与其他字段', () => {
    const config = {
      theme: 'dark',
      model: 'wxhand/gpt-5.2',
      provider: {
        wxhand: {
          options: { baseURL: 'https://api.example.com', apiKey: 'token' },
          models: { 'gpt-5.5': { name: 'GPT-5.5', limit: { context: 1050000, output: 128000 } } },
        },
      },
    };

    const updated = applyOpenCodeModel(config, 'gpt-5.5');

    expect(updated.model).toBe('wxhand/gpt-5.5');
    expect(updated.theme).toBe('dark');
    expect(listProviderModels(updated)).toEqual(['gpt-5.5']);
    const entry = (updated.provider as Record<string, unknown>).wxhand as Record<string, unknown>;
    expect((entry.models as Record<string, unknown>)['gpt-5.5']).toEqual({
      name: 'GPT-5.5',
      limit: { context: 1050000, output: 128000 },
    });
  });

  it('切换未注册模型时自动写入默认模型定义且不修改原对象', () => {
    const config = {
      provider: {
        wxhand: {
          options: { baseURL: 'https://api.example.com' },
          models: { 'gpt-5.2': { name: 'GPT-5.2' } },
        },
      },
    };

    const updated = applyOpenCodeModel(config, 'gpt-5.6-terra');

    expect(updated.model).toBe('wxhand/gpt-5.6-terra');
    const entry = (updated.provider as Record<string, unknown>).wxhand as Record<string, unknown>;
    expect((entry.models as Record<string, unknown>)['gpt-5.6-terra']).toEqual({
      name: 'gpt-5.6-terra',
      limit: { context: 1_000_000, output: 128000 },
      modalities: { input: ['text', 'image'] },
      options: { store: false },
      variants: { none: {}, low: {}, medium: {}, high: {}, xhigh: {}, max: {} },
    });
    expect((entry.options as Record<string, unknown>).baseURL).toBe('https://api.example.com');
    expect(listProviderModels(config)).toEqual(['gpt-5.2']);
  });

  it('输入带供应商前缀的模型名时按前缀注册', () => {
    const updated = applyOpenCodeModel({}, 'openai/gpt-5.6');

    expect(updated.model).toBe('openai/gpt-5.6');
    expect(listProviderModels(updated)).toEqual(['gpt-5.6']);
  });

  it('claude 模型被拒绝：openai 接口不支持', () => {
    expect(() => applyOpenCodeModel({}, 'claude-glm')).toThrow('不支持 claude 模型');
    expect(() => applyOpenCodeModel({}, 'anthropic/claude-glm')).toThrow('不支持 claude 模型');
  });

  it('按模型名解析目标 provider', () => {
    expect(resolveOpenCodeProviderId('claude-glm')).toBe('anthropic');
    expect(resolveOpenCodeProviderId('anthropic/claude-glm')).toBe('anthropic');
    expect(resolveOpenCodeProviderId('openai/claude-x')).toBe('anthropic');
    expect(resolveOpenCodeProviderId('wxhand/gpt-5.6')).toBe('wxhand');
    expect(resolveOpenCodeProviderId('openai/gpt-5.6')).toBe('wxhand');
    expect(resolveOpenCodeProviderId('gpt-5.6')).toBe('wxhand');
    expect(resolveOpenCodeProviderId('GPT-5.6')).toBe('wxhand');
  });

  it('空模型名称被拒绝', () => {
    expect(() => applyOpenCodeModel({}, '   ')).toThrow('请输入模型名称');
  });

  it('清除模型时仅移除 model 字段', () => {
    const config = { model: 'openai/gpt-5.5', theme: 'dark' };
    const cleared = clearOpenCodeModel(config);

    expect(cleared).toEqual({ theme: 'dark' });
    expect(clearOpenCodeModel(cleared)).toBe(cleared);
  });

  it('读取当前模型时容错', () => {
    expect(findCurrentOpenCodeModel({ model: 'openai/gpt-5.5' })).toBe('openai/gpt-5.5');
    expect(findCurrentOpenCodeModel({})).toBeUndefined();
    expect(findCurrentOpenCodeModel({ model: '   ' })).toBeUndefined();
  });
});

describe('批量注册模型（同步）', () => {
  it('批量注册配置中的模型，已注册的保留原定义', () => {
    const config = {
      provider: {
        wxhand: {
          options: { baseURL: 'https://api.example.com' },
          models: { 'gpt-5.5': { name: 'GPT-5.5', limit: { context: 1050000 } } },
        },
      },
    };

    const result = registerProviderModels(config, ['gpt-glm', ' gpt-5.5 ', '  ', 'gpt-image-2']);

    expect(result.added).toEqual(['gpt-glm', 'gpt-image-2']);
    expect(result.existing).toEqual(['gpt-5.5']);
    expect(result.updated).toEqual(['gpt-5.5']);
    expect(listProviderModels(result.config)).toEqual(['gpt-5.5', 'gpt-glm', 'gpt-image-2']);
    const entry = (result.config.provider as Record<string, unknown>).wxhand as Record<string, unknown>;
    expect((entry.models as Record<string, unknown>)['gpt-5.5']).toEqual({
      name: 'GPT-5.5',
      limit: { context: 1050000 },
      modalities: { input: ['text', 'image'] },
    });
    expect((entry.models as Record<string, unknown>)['gpt-glm']).toEqual({
      name: 'gpt-glm',
      limit: { context: 1_000_000, output: 128000 },
      options: { store: false },
      variants: { low: {}, high: {}, max: {} },
    });
    expect((entry.options as Record<string, unknown>).baseURL).toBe('https://api.example.com');
    expect(listProviderModels(config)).toEqual(['gpt-5.5']);
  });

  it('provider 缺失时创建默认结构', () => {
    const result = registerProviderModels({ theme: 'dark' }, ['gpt-5.6']);

    expect(result.existing).toEqual([]);
    expect(result.updated).toEqual([]);
    expect((result.config as Record<string, unknown>).theme).toBe('dark');
    expect(listProviderModels(result.config)).toEqual(['gpt-5.6']);
  });

  it('deepseek-v4-pro 写入 high/max 两档', () => {
    const result = registerProviderModels({}, ['gpt-deepseek-v4-pro']);

    const entry = (result.config.provider as Record<string, unknown>).wxhand as Record<string, unknown>;
    expect((entry.models as Record<string, unknown>)['gpt-deepseek-v4-pro']).toEqual({
      name: 'gpt-deepseek-v4-pro',
      limit: { context: 1_000_000, output: 128000 },
      options: { store: false },
      variants: { high: {}, max: {} },
    });
  });

  it('不同模型的档位按模型一一对应', () => {
    const result = registerProviderModels({}, [
      'gpt-deepseek-v4-flash',
      'gpt-glm-5.2',
      'gpt-glm-5.3',
      'gpt-5.6',
      'gpt-image-2',
    ]);

    const models = (result.config.provider as Record<string, unknown>).wxhand as Record<string, unknown>;
    const getVariants = (id: string) => (models.models as Record<string, unknown>)[id] as { variants: Record<string, unknown> };
    expect(Object.keys(getVariants('gpt-deepseek-v4-flash').variants)).toEqual(['low', 'high', 'max']);
    expect(Object.keys(getVariants('gpt-glm-5.2').variants)).toEqual(['high', 'max']);
    expect(Object.keys(getVariants('gpt-glm-5.3').variants)).toEqual(['low', 'high', 'max']);
    expect(Object.keys(getVariants('gpt-5.6').variants)).toEqual(['none', 'low', 'medium', 'high', 'xhigh', 'max']);
    expect(Object.keys(getVariants('gpt-image-2').variants)).toEqual([]);
  });

  it('可注册到指定的其他 provider', () => {
    const result = registerProviderModels({}, ['other-model'], 'anthropic');

    expect(result.added).toEqual(['other-model']);
    expect(listProviderModels(result.config, 'anthropic')).toEqual(['other-model']);
  });

  it('保留已有的图片能力定义', () => {
    const config = {
      provider: {
        wxhand: {
          models: { 'gpt-5.6': { name: 'GPT-5.6', modalities: { input: ['text'] } } },
        },
      },
    };

    const result = registerProviderModels(config, ['gpt-5.6']);

    expect(result.updated).toEqual([]);
    expect(result.config).toEqual(config);
  });

  it('将此前 zmai 生成的 400K 模型升级为 1M', () => {
    const config = {
      provider: {
        wxhand: {
          models: {
            'gpt-5.6': {
              name: 'gpt-5.6',
              limit: { context: 400000, output: 128000 },
              options: { store: false },
              variants: {},
            },
          },
        },
      },
    };

    const result = registerProviderModels(config, ['gpt-5.6']);

    expect(result.updated).toEqual(['gpt-5.6']);
    const entry = (result.config.provider as Record<string, unknown>).wxhand as Record<string, unknown>;
    expect((entry.models as Record<string, unknown>)['gpt-5.6']).toMatchObject({
      limit: { context: 1_000_000, output: 128000 },
      modalities: { input: ['text', 'image'] },
    });
  });

  it('为 glm-flash 登记图片输入能力', () => {
    const result = registerProviderModels({}, ['glm-flash']);

    const provider = (result.config.provider as Record<string, unknown>).wxhand as Record<string, unknown>;
    expect((provider.models as Record<string, unknown>)['glm-flash']).toMatchObject({
      modalities: { input: ['text', 'image'] },
    });
  });
});

describe('撤回注册（恢复默认）', () => {
  it('移除已注册模型，保留未在列表中的模型与 provider 其他字段', () => {
    const config = {
      model: 'wxhand/gpt-glm',
      provider: {
        wxhand: {
          options: { baseURL: 'https://api.example.com' },
          models: {
            'gpt-glm': { name: 'gpt-glm' },
            'gpt-5.6': { name: 'GPT-5.6' },
          },
        },
      },
    };

    const result = unregisterProviderModels(config, ['gpt-glm', 'not-registered']);

    expect(result.removed).toEqual(['gpt-glm']);
    expect(listProviderModels(result.config)).toEqual(['gpt-5.6']);
    expect(result.modelCleared).toBe(true);
    expect(findCurrentOpenCodeModel(result.config)).toBeUndefined();
    const entry = (result.config.provider as Record<string, unknown>).wxhand as Record<string, unknown>;
    expect((entry.options as Record<string, unknown>).baseURL).toBe('https://api.example.com');
    expect(listProviderModels(config)).toEqual(['gpt-glm', 'gpt-5.6']);
  });

  it('顶层 model 指向未移除的模型时保留', () => {
    const config = {
      model: 'wxhand/gpt-5.6',
      provider: { wxhand: { models: { 'gpt-glm': {}, 'gpt-5.6': {} } } },
    };

    const result = unregisterProviderModels(config, ['gpt-glm']);

    expect(result.modelCleared).toBe(false);
    expect(findCurrentOpenCodeModel(result.config)).toBe('wxhand/gpt-5.6');
  });

  it('没有可移除的模型时原样返回', () => {
    const config = { theme: 'dark', provider: { openai: { models: { 'gpt-5.6': {} } } } };

    const result = unregisterProviderModels(config, ['gpt-glm']);

    expect(result.removed).toEqual([]);
    expect(result.modelCleared).toBe(false);
    expect(result.config).toBe(config);
  });
});

describe('配置文件定位与写入', () => {
  it('优先选择已存在的配置文件，默认使用 opencode.jsonc', () => {
    const home = tempHome();
    expect(resolveOpenCodeConfigFile(home)).toBe(path.join(home, '.config', 'opencode', 'opencode.jsonc'));

    const jsonPath = path.join(home, '.config', 'opencode', 'opencode.json');
    fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
    fs.writeFileSync(jsonPath, '{}');
    expect(resolveOpenCodeConfigFile(home)).toBe(jsonPath);
  });

  it('写入后可重新读取且保留 JSONC 中原有数据', () => {
    const home = tempHome();
    const filePath = resolveOpenCodeConfigFile(home);
    writeOpenCodeConfig(filePath, applyOpenCodeModel({ theme: 'dark' }, 'gpt-5.6'));

    expect(readOpenCodeConfig(filePath)).toEqual({
      theme: 'dark',
      model: 'wxhand/gpt-5.6',
      provider: {
        wxhand: {
          models: {
            'gpt-5.6': {
              name: 'gpt-5.6',
              limit: { context: 1_000_000, output: 128000 },
              modalities: { input: ['text', 'image'] },
              options: { store: false },
              variants: { none: {}, low: {}, medium: {}, high: {}, xhigh: {}, max: {} },
            },
          },
        },
      },
    });
  });

  it('配置文件不存在时读取返回空对象', () => {
    const home = tempHome();
    expect(readOpenCodeConfig(resolveOpenCodeConfigFile(home))).toEqual({});
  });
});
