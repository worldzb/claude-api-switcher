import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export function findExecutable(name: string): string | undefined {
  const paths = (process.env.PATH || '').split(path.delimiter);
  const extensions = executableExtensions(process.platform);
  return paths
    .flatMap((directory) => extensions.map((extension) => path.join(directory, `${name}${extension}`)))
    .find((candidate) => fs.existsSync(candidate));
}

export function executableExtensions(platform: NodeJS.Platform): readonly string[] {
  return platform === 'win32' ? ['.exe', '.cmd', '.bat'] : [''];
}

export function runCommand(command: string, args: readonly string[], cwd?: string): string {
  const invocation = getCommandInvocation(command, args);
  const result = spawnSync(invocation.command, invocation.args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 30_000,
    windowsVerbatimArguments: invocation.windowsVerbatimArguments,
  });
  if (result.error) {
    throw new Error(`无法执行 ${command}：${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`${command} 执行失败：${(result.stderr || result.stdout || '未知错误').trim()}`);
  }
  return result.stdout.trim();
}

export function launchCommand(command: string, args: readonly string[], cwd?: string): number | null {
  const executable = resolveCommand(command);
  const invocation = getCommandInvocation(executable, args);
  const result = spawnSync(invocation.command, invocation.args, {
    cwd,
    stdio: 'inherit',
    windowsVerbatimArguments: invocation.windowsVerbatimArguments,
  });
  if (result.error) throw new Error(`无法启动 ${command}：${result.error.message}`);
  return result.status;
}

export function createWindowsBatchCommand(command: string, args: readonly string[]): string {
  const values = [command, ...args];
  if (values.some((value) => /[\r\n"%&|<>()^!]/.test(value))) {
    throw new Error('Windows 批处理命令参数包含不安全字符。');
  }
  return `call ${values.map((value) => `"${value}"`).join(' ')}`;
}

function resolveCommand(command: string): string {
  if (path.isAbsolute(command) || /[\\/]/.test(command)) return command;
  return findExecutable(command) || command;
}

function getCommandInvocation(command: string, args: readonly string[]): {
  readonly command: string;
  readonly args: readonly string[];
  readonly windowsVerbatimArguments: boolean;
} {
  const windowsBatchFile = process.platform === 'win32' && /\.(cmd|bat)$/i.test(command);
  return windowsBatchFile
    ? { command: process.env.ComSpec || 'cmd.exe', args: ['/d', '/s', '/c', createWindowsBatchCommand(command, args)], windowsVerbatimArguments: true }
    : { command, args, windowsVerbatimArguments: false };
}

export function getVersion(command: string): string | undefined {
  try {
    return runCommand(command, ['--version']).split('\n')[0]?.trim();
  } catch {
    return undefined;
  }
}
