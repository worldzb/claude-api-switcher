import { describe, expect, it } from 'vitest';

import {
  applyDefaultConfig,
  createTemporaryExports,
  findActiveConfig,
} from '../src/claude/settings.js';

const config = {
  name: '测试 API',
  apiKey: "token'with'quote",
  baseUrl: 'https://api.example.com',
};

describe('Claude 设置', () => {
  it('更新默认配置时保留其他设置且不修改原对象', () => {
    const settings = { permissions: { allow: ['Read'] }, env: { OTHER: 'value' } };
    const updated = applyDefaultConfig(settings, config);

    expect(updated).toEqual({
      permissions: { allow: ['Read'] },
      env: {
        OTHER: 'value',
        ANTHROPIC_AUTH_TOKEN: config.apiKey,
        ANTHROPIC_BASE_URL: config.baseUrl,
      },
    });
    expect(settings).toEqual({ permissions: { allow: ['Read'] }, env: { OTHER: 'value' } });
  });

  it('为 eval 输出安全转义 shell 环境变量', () => {
    expect(createTemporaryExports(config)).toBe(
      "export ANTHROPIC_API_KEY='token'\\''with'\\''quote'\nexport ANTHROPIC_BASE_URL='https://api.example.com'",
    );
  });

  it('根据 Claude 设置定位当前保存的配置', () => {
    const matched = findActiveConfig([config], {
      env: {
        ANTHROPIC_AUTH_TOKEN: config.apiKey,
        ANTHROPIC_BASE_URL: config.baseUrl,
      },
    });

    expect(matched).toEqual(config);
  });
});
