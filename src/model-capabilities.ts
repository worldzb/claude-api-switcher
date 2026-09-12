export function supportsImageInput(modelId: string): boolean {
  const id = modelId.trim().toLowerCase();
  return id.includes('vision')
    || id.includes('-vl')
    || id.includes('omni')
    || id.includes('image')
    || id.includes('claude')
    || id.includes('deepseek')
    || id.includes('gemini')
    || id.includes('gpt-4')
    || id.includes('gpt-5')
    || id.includes('glm-4')
    || id.includes('glm-5')
    || id.includes('glm-flash');
}

/**
 * 各模型的推理档位（reasoning effort levels），与 models.dev 的 reasoning_options 一一对应。
 * 只列出本项目可能同步到的模型；键为去掉供应商前缀后的模型 id。
 * OpenCode 的 variants 与 Codex 的 supported_reasoning_levels 共用此表。
 */
const MODEL_REASONING_LEVELS: Readonly<Record<string, readonly string[]>> = {
  // DeepSeek V4
  'deepseek-v4-flash': ['low', 'high', 'max'],
  'deepseek-v4-flash-vision-exp': ['low', 'high', 'max'],
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
const DEFAULT_REASONING_LEVELS: readonly string[] = ['low', 'medium', 'high', 'xhigh'];

/** 解析模型的推理档位列表，供 OpenCode 的 variants 与 Codex 的 supported_reasoning_levels 共用。 */
export function reasoningLevelsFor(modelId: string): readonly string[] {
  const key = normalizeModelKey(modelId);
  const exact = MODEL_REASONING_LEVELS[key];
  if (exact !== undefined) {
    return exact;
  }

  // wxhand 中转以 gpt- 前缀包装第三方模型，剥离后再匹配底层模型
  if (key.startsWith('gpt-')) {
    const underlying = MODEL_REASONING_LEVELS[key.slice('gpt-'.length)];
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
  return DEFAULT_REASONING_LEVELS;
}

function normalizeModelKey(id: string): string {
  const value = id.trim().toLowerCase();
  const slash = value.lastIndexOf('/');
  return slash >= 0 ? value.slice(slash + 1) : value;
}
