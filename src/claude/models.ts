import type { ClaudeSettings, ModelPickerRow, ModelPickerSetting } from '../config/types.js';

export interface ModelOption {
  readonly value: string;
  readonly label: string;
  readonly hint?: string;
}

export const BUILTIN_MODELS: readonly ModelOption[] = [
  { value: 'opus', label: 'opus', hint: '官方别名 · 最强能力' },
  { value: 'sonnet', label: 'sonnet', hint: '官方别名 · 均衡性能' },
  { value: 'haiku', label: 'haiku', hint: '官方别名 · 最快速度' },
];

export function isBuiltinModel(name: string): boolean {
  return BUILTIN_MODELS.some((model) => model.value === name);
}

export function applyModelSetting(settings: ClaudeSettings, model: string): ClaudeSettings {
  const value = model.trim();
  if (!value) {
    throw new Error('请输入模型名称。');
  }

  return { ...settings, model: value };
}

export function clearModelSetting(settings: ClaudeSettings): ClaudeSettings {
  if (settings.model === undefined) {
    return settings;
  }

  const { model: _model, ...rest } = settings;
  return rest;
}

export function findCurrentModel(settings: ClaudeSettings): string | undefined {
  const model = settings.model;
  return typeof model === 'string' && model.trim() ? model : undefined;
}

/**
 * 将自定义模型列表同步为 /model 选择器行（modelPicker，Claude Code ≥ 2.1.242）。
 * 默认追加在内置模型之后；列表为空时移除该字段，恢复官方选择器。
 * 已存在同模型行时保留其 label / description / replaceBuiltInOptions。
 */
export function applyModelPickerSetting(settings: ClaudeSettings, models: readonly string[]): ClaudeSettings {
  const names = [...new Set(models.map((model) => model.trim()).filter((model) => model !== ''))];
  if (names.length === 0) {
    return clearModelPickerSetting(settings);
  }

  const previous = isModelPickerSetting(settings.modelPicker) ? settings.modelPicker : undefined;
  const previousRows = new Map(
    (previous?.options ?? [])
      .filter((row): row is ModelPickerRow => typeof row?.model === 'string' && row.model.trim() !== '')
      .map((row) => [row.model.trim(), row] as const),
  );

  return {
    ...settings,
    modelPicker: {
      ...(previous?.replaceBuiltInOptions !== undefined ? { replaceBuiltInOptions: previous.replaceBuiltInOptions } : {}),
      options: names.map((name) => previousRows.get(name) ?? { model: name }),
    },
  };
}

export function clearModelPickerSetting(settings: ClaudeSettings): ClaudeSettings {
  if (settings.modelPicker === undefined) {
    return settings;
  }

  const { modelPicker: _modelPicker, ...rest } = settings;
  return rest;
}

function isModelPickerSetting(value: unknown): value is ModelPickerSetting {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  return Array.isArray((value as { options?: unknown }).options);
}
