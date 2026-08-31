import fs from 'node:fs';
import path from 'node:path';

import { normalizeConfigData } from './config-data.js';
import type { ConfigData } from './types.js';

export class ConfigRepository {
  constructor(private readonly filePath: string) {}

  read(): ConfigData {
    if (!fs.existsSync(this.filePath)) {
      return { configs: [], current: null };
    }

    try {
      return normalizeConfigData(JSON.parse(fs.readFileSync(this.filePath, 'utf8')));
    } catch {
      throw new Error(`无法读取配置文件：${this.filePath}`);
    }
  }

  write(data: ConfigData): void {
    const directory = path.dirname(this.filePath);
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    fs.writeFileSync(this.filePath, `${JSON.stringify(normalizeConfigData(data), null, 2)}\n`, {
      encoding: 'utf8',
      mode: 0o600,
    });
    fs.chmodSync(this.filePath, 0o600);
  }
}
