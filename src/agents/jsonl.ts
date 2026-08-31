import fs from 'node:fs';

export function readJsonLines(filePath: string): readonly unknown[] {
  try {
    return fs.readFileSync(filePath, 'utf8')
      .split('\n')
      .flatMap((line): readonly unknown[] => {
        if (!line.trim()) return [];
        try {
          return [JSON.parse(line)];
        } catch {
          return [];
        }
      });
  } catch {
    return [];
  }
}

export function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}
