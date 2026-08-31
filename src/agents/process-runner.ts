import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export function findExecutable(name: string): string | undefined {
  const paths = (process.env.PATH || '').split(path.delimiter);
  const extensions = process.platform === 'win32' ? ['', '.cmd', '.exe', '.bat'] : [''];
  return paths
    .flatMap((directory) => extensions.map((extension) => path.join(directory, `${name}${extension}`)))
    .find((candidate) => fs.existsSync(candidate));
}

export function runCommand(command: string, args: readonly string[], cwd?: string): string {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 30_000,
  });
  if (result.error) {
    throw new Error(`无法执行 ${command}：${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`${command} 执行失败：${(result.stderr || result.stdout || '未知错误').trim()}`);
  }
  return result.stdout.trim();
}

export function getVersion(command: string): string | undefined {
  try {
    return runCommand(command, ['--version']).split('\n')[0]?.trim();
  } catch {
    return undefined;
  }
}
