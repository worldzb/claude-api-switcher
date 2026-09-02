import { describe, expect, it } from 'vitest';

import { createWindowsBatchCommand, executableExtensions, launchCommand } from '../src/agents/process-runner.js';

describe('process runner', () => {
  it('prefers executable Windows command wrappers over extensionless shims', () => {
    expect(executableExtensions('win32')).toEqual(['.exe', '.cmd', '.bat']);
    expect(executableExtensions('linux')).toEqual(['']);
  });

  it('runs Windows batch wrappers through cmd without interpolating unsafe arguments', () => {
    expect(createWindowsBatchCommand('C:\\Program Files\\nodejs\\codex.cmd', ['delete', '--force', '01a06216-1732-7312-9e4b-c69c978d8feb']))
      .toBe('call "C:\\Program Files\\nodejs\\codex.cmd" "delete" "--force" "01a06216-1732-7312-9e4b-c69c978d8feb"');
    expect(() => createWindowsBatchCommand('codex.cmd', ['delete', 'unsafe&value']))
      .toThrow('Windows 批处理命令参数包含不安全字符。');
  });

  it('starts a resolved local command for foreground launches', () => {
    expect(launchCommand(process.execPath, ['-e', 'process.exit(0)'])).toBe(0);
  });
});
