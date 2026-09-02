import { describe, expect, it } from 'vitest';

import {
  applyModelPickerSetting,
  applyModelSetting,
  BUILTIN_MODELS,
  clearModelPickerSetting,
  clearModelSetting,
  findCurrentModel,
  isBuiltinModel,
} from '../src/claude/models.js';

describe('Claude 模型设置', () => {
  it('写入模型时保留其他设置且不修改原对象', () => {
    const settings = { permissions: { allow: ['Read'] }, env: { OTHER: 'value' } };
    const updated = applyModelSetting(settings, ' glm-4.6 ');

    expect(updated).toEqual({
      permissions: { allow: ['Read'] },
      env: { OTHER: 'value' },
      model: 'glm-4.6',
    });
    expect(settings).toEqual({ permissions: { allow: ['Read'] }, env: { OTHER: 'value' } });
  });

  it('空模型名称被拒绝', () => {
    expect(() => applyModelSetting({}, '   ')).toThrow('请输入模型名称');
  });

  it('清除模型时仅移除 model 字段', () => {
    const settings = { model: 'sonnet', env: { ANTHROPIC_BASE_URL: 'https://api.example.com' } };
    const cleared = clearModelSetting(settings);

    expect(cleared).toEqual({ env: { ANTHROPIC_BASE_URL: 'https://api.example.com' } });
    expect(clearModelSetting(cleared)).toBe(cleared);
  });

  it('清除模型时容忍非字符串的 model 值', () => {
    expect(clearModelSetting({ model: 123, other: 'value' })).toEqual({ other: 'value' });
  });

  it('读取当前模型时容错非字符串与空白值', () => {
    expect(findCurrentModel({ model: 'opus' })).toBe('opus');
    expect(findCurrentModel({})).toBeUndefined();
    expect(findCurrentModel({ model: '   ' })).toBeUndefined();
  });
});

describe('内置模型目录', () => {
  it('包含官方别名且值唯一', () => {
    const values = BUILTIN_MODELS.map((model) => model.value);
    expect(new Set(values).size).toBe(values.length);
    for (const value of ['opus', 'sonnet', 'haiku']) {
      expect(values).toContain(value);
    }
  });

  it('识别内置模型', () => {
    expect(isBuiltinModel('sonnet')).toBe(true);
    expect(isBuiltinModel('glm-4.6')).toBe(false);
  });
});

describe('/model 选择器同步（modelPicker）', () => {
  it('将自定义模型列表写入 modelPicker.options 并保留其他设置', () => {
    const settings = { env: { ANTHROPIC_BASE_URL: 'https://api.example.com' }, model: 'claude-glm' };
    const updated = applyModelPickerSetting(settings, ['claude-glm', 'claude-deepseek-v4-flash']);

    expect(updated).toEqual({
      env: { ANTHROPIC_BASE_URL: 'https://api.example.com' },
      model: 'claude-glm',
      modelPicker: {
        options: [{ model: 'claude-glm' }, { model: 'claude-deepseek-v4-flash' }],
      },
    });
    expect(settings).toEqual({ env: { ANTHROPIC_BASE_URL: 'https://api.example.com' }, model: 'claude-glm' });
  });

  it('trim、去重、过滤空串', () => {
    const updated = applyModelPickerSetting({}, [' claude-glm ', '', 'claude-glm', '  ']);

    expect(updated.modelPicker?.options).toEqual([{ model: 'claude-glm' }]);
  });

  it('已存在同模型行时保留 label / description 与 replaceBuiltInOptions，列表外的行被移除', () => {
    const settings = {
      modelPicker: {
        replaceBuiltInOptions: true,
        options: [
          { model: 'claude-glm', label: 'GLM', description: '中转模型' },
          { model: 'stale-model' },
          { model: 42 },
        ],
      },
    };
    const updated = applyModelPickerSetting(settings, ['claude-glm', 'claude-deepseek-v4-flash']);

    expect(updated.modelPicker).toEqual({
      replaceBuiltInOptions: true,
      options: [{ model: 'claude-glm', label: 'GLM', description: '中转模型' }, { model: 'claude-deepseek-v4-flash' }],
    });
  });

  it('modelPicker 非法时按新列表重建', () => {
    const updated = applyModelPickerSetting({ modelPicker: 'bad' }, ['claude-glm']);

    expect(updated.modelPicker).toEqual({ options: [{ model: 'claude-glm' }] });
  });

  it('列表为空时移除 modelPicker 字段', () => {
    const settings = { model: 'claude-glm', modelPicker: { options: [{ model: 'claude-glm' }] } };
    const updated = applyModelPickerSetting(settings, []);

    expect(updated).toEqual({ model: 'claude-glm' });
    expect(clearModelPickerSetting(updated)).toBe(updated);
  });
});
