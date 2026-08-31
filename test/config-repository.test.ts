import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { ConfigRepository } from '../src/config/config-repository.js';

const directories: string[] = [];

afterEach(() => {
  directories.forEach((directory) => fs.rmSync(directory, { recursive: true, force: true }));
  directories.length = 0;
});

describe('ConfigRepository', () => {
  it('保存时将旧数据归一化为 Claude 配置', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'zmai-'));
    directories.push(directory);
    const filePath = path.join(directory, 'claude-configs.json');
    fs.writeFileSync(filePath, JSON.stringify({
      current: 'legacy',
      configs: [
        { name: 'Claude', apiKey: 'token', baseUrl: 'https://api.example.com' },
        { name: 'legacy', apiKey: 'legacy-token', baseUrl: 'https://legacy.example.com', target: 'legacy' },
      ],
    }));

    const repository = new ConfigRepository(filePath);

    expect(repository.read()).toEqual({
      current: null,
      configs: [{ name: 'Claude', apiKey: 'token', baseUrl: 'https://api.example.com' }],
    });
  });
});
