import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  applyCodexModel,
  applyCodexModelCatalog,
  buildCodexModelCatalog,
  clearCodexModel,
  clearCodexModelCatalog,
  CODEX_CATALOG_FILENAME,
  findCurrentCodexModel,
  resolveCodexCatalogFile,
} from '../src/codex/config.js';

const SAMPLE = [
  'model_provider = "OpenAI"',
  'model = "gpt-5.6-luna"',
  'review_model = "gpt-5.5"',
  '',
  '[model_providers.OpenAI]',
  'name = "OpenAI"',
  'base_url = "https://relay.example.com/cc"',
  '',
  '[projects./work]',
  'trust_level = "trusted"',
  '',
].join('\n');

describe('Codex 模型切换（TOML 定向编辑）', () => {
  it('读取顶层 model，忽略 review_model 与段内键', () => {
    expect(findCurrentCodexModel(SAMPLE)).toBe('gpt-5.6-luna');
    expect(findCurrentCodexModel('review_model = "gpt-5.5"\n')).toBeUndefined();
    expect(findCurrentCodexModel('')).toBeUndefined();
    expect(findCurrentCodexModel('[tui]\n"gpt-5.5" = 4\n')).toBeUndefined();
  });

  it('替换已有 model 行且不影响其他内容', () => {
    const updated = applyCodexModel(SAMPLE, 'gpt-glm');

    expect(updated).toContain('model = "gpt-glm"');
    expect(updated).not.toContain('gpt-5.6-luna');
    expect(updated).toContain('review_model = "gpt-5.5"');
    expect(updated).toContain('[model_providers.OpenAI]');
    expect(updated).toContain('base_url = "https://relay.example.com/cc"');
    expect(updated).toContain('trust_level = "trusted"');
  });

  it('没有 model 行时插入到第一个 [table] 段之前', () => {
    const source = SAMPLE.split('\n').filter((line) => line !== 'model = "gpt-5.6-luna"').join('\n');
    const updated = applyCodexModel(source, 'gpt-glm');

    expect(updated.indexOf('model = "gpt-glm"')).toBeLessThan(updated.indexOf('[model_providers.OpenAI]'));
    expect(updated).toContain('review_model = "gpt-5.5"');
    expect(updated).toContain('trust_level = "trusted"');
    expect(updated).toMatch(/^model_provider = "OpenAI"$/m);
  });

  it('空配置时直接写入 model 行', () => {
    const updated = applyCodexModel('', 'gpt-glm');
    expect(updated.trim()).toBe('model = "gpt-glm"');
  });

  it('空模型名称被拒绝', () => {
    expect(() => applyCodexModel(SAMPLE, '   ')).toThrow('请输入模型名称');
  });

  it('清除时仅移除 model 行', () => {
    const cleared = clearCodexModel(SAMPLE);

    expect(cleared).not.toMatch(/^model\s*=/m);
    expect(cleared).toContain('review_model = "gpt-5.5"');
    expect(cleared).toContain('trust_level = "trusted"');
    expect(clearCodexModel(cleared)).toBe(cleared);
  });
});

describe('模型目录同步（model_catalog_json）', () => {
  const BUNDLED = {
    models: [
      {
        slug: 'gpt-5.6-sol',
        display_name: 'GPT-5.6-Sol',
        model_messages: { instructions_template: 'You are Codex, an agent based on GPT-5.' },
      },
      { slug: 'gpt-5.5', display_name: 'GPT-5.5' },
    ],
  };

  it('合并自定义与内置条目，克隆官方提示词模板', () => {
    const result = buildCodexModelCatalog(['gpt-glm', ' gpt-glm ', 'gpt-deepseek', '  '], BUNDLED);

    expect(result.added).toEqual(['gpt-glm', 'gpt-deepseek']);
    expect(result.skipped).toEqual([]);
    expect(result.bundledCount).toBe(2);
    expect(result.catalog.models.map((entry) => entry.slug)).toEqual(['gpt-glm', 'gpt-deepseek', 'gpt-5.6-sol', 'gpt-5.5']);
    const custom = result.catalog.models[0] as Record<string, unknown>;
    expect(custom.display_name).toBe('gpt-glm');
    expect(custom.context_window).toBe(1_000_000);
    expect(custom.max_context_window).toBe(1_000_000);
    expect(custom.visibility).toBe('list');
    expect(custom.base_instructions).toBe('You are Codex, an agent based on GPT-5.');
    expect(custom.input_modalities).toBeUndefined();
    expect(custom.supported_reasoning_levels).toEqual([
      { effort: 'low', description: expect.any(String) },
      { effort: 'medium', description: expect.any(String) },
      { effort: 'high', description: expect.any(String) },
    ]);
    // 内置条目原样保留
    expect(result.catalog.models[2]).toEqual(BUNDLED.models[0]);
  });

  it('与内置重复的自定义模型跳过；codex 不可用时无内置合并', () => {
    const merged = buildCodexModelCatalog(['gpt-5.5', 'gpt-glm'], BUNDLED);
    expect(merged.added).toEqual(['gpt-glm']);
    expect(merged.skipped).toEqual(['gpt-5.5']);

    const noBundled = buildCodexModelCatalog(['gpt-glm'], undefined);
    expect(noBundled.added).toEqual(['gpt-glm']);
    expect(noBundled.bundledCount).toBe(0);
    expect((noBundled.catalog.models[0] as Record<string, unknown>).base_instructions).toBe('');
    // 非法内置目录数据被容错忽略
    const broken = buildCodexModelCatalog(['gpt-glm'], { models: ['bad', { slug: 42 }, { slug: 'ok' }] });
    expect(broken.bundledCount).toBe(1);
    expect(broken.catalog.models.map((entry) => entry.slug)).toEqual(['gpt-glm', 'ok']);
  });

  it('为常见多模态模型声明图片输入能力', () => {
    const result = buildCodexModelCatalog(['gpt-5.6', 'deepseek-v4-flash-vision-exp', 'glm-flash']);

    expect(result.catalog.models.map((entry) => entry.input_modalities)).toEqual([
      ['text', 'image'],
      ['text', 'image'],
      ['text', 'image'],
    ]);
  });

  it('目录文件路径与 config.toml 同目录', () => {
    expect(resolveCodexCatalogFile(path.join('home', '.codex', 'config.toml'))).toBe(path.join('home', '.codex', CODEX_CATALOG_FILENAME));
  });

  it('挂载 model_catalog_json：Windows 路径用字面字符串，插入到第一个段之前', () => {
    const catalogPath = path.join('C:', 'Users', 'u', '.codex', CODEX_CATALOG_FILENAME);
    const updated = applyCodexModelCatalog(SAMPLE, catalogPath);

    expect(updated).toContain(`model_catalog_json = '${catalogPath}'`);
    expect(updated.indexOf('model_catalog_json')).toBeLessThan(updated.indexOf('[model_providers.OpenAI]'));
    expect(updated).toContain('model = "gpt-5.6-luna"');
    expect(updated).toContain('trust_level = "trusted"');
  });

  it('已有 model_catalog_json 行时替换，空配置也可写入', () => {
    const catalogPath = path.join('D:', 'codex', CODEX_CATALOG_FILENAME);
    const source = `model_catalog_json = 'old.json'\nmodel = "gpt-glm"\n\n[tui]\nnice = true\n`;
    const updated = applyCodexModelCatalog(source, catalogPath);

    expect(updated).toContain(`model_catalog_json = '${catalogPath}'`);
    expect(updated).not.toContain('old.json');
    expect(updated.match(/model_catalog_json/g)).toHaveLength(1);
    expect(updated).toContain('model = "gpt-glm"');
    expect(updated).toContain('[tui]');

    expect(applyCodexModelCatalog('', catalogPath).trim()).toBe(`model_catalog_json = '${catalogPath}'`);
  });

  it('路径含单引号时回退转义的基本字符串', () => {
    const catalogPath = path.join("it's", CODEX_CATALOG_FILENAME);
    const updated = applyCodexModelCatalog('', catalogPath);
    expect(updated).toContain(`model_catalog_json = "${catalogPath.replace(/\\/g, '\\\\')}"`);
  });

  it('撤回时仅移除 zmai 挂载的行，保留用户自己的指向与段内键', () => {
    const mine = path.join('home', '.codex', CODEX_CATALOG_FILENAME);
    const source = [
      `model_catalog_json = '${mine}'`,
      'model = "gpt-glm"',
      '',
      '[tui]',
      'notification = 4',
      '',
    ].join('\n');

    const result = clearCodexModelCatalog(source);
    expect(result.removed).toBe(true);
    expect(result.content).not.toMatch(/^model_catalog_json/m);
    expect(result.content).toContain('model = "gpt-glm"');
    expect(result.content).toContain('notification = 4');

    // 用户自己的指向不动
    const foreign = clearCodexModelCatalog("model_catalog_json = 'my-own.json'\n");
    expect(foreign.removed).toBe(false);
    expect(foreign.content).toBe("model_catalog_json = 'my-own.json'\n");

    // 没有该行时原样返回
    expect(clearCodexModelCatalog('model = "gpt-glm"\n')).toEqual({ content: 'model = "gpt-glm"\n', removed: false });
  });
});
