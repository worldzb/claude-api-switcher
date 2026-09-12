import type { AgentId } from './types.js';
import { isRecord } from './jsonl.js';

/**
 * 各 Agent 的 MCP 配置格式并不相同，直接照搬另一个 Agent 的配置会被拒绝：
 * Claude / Codex 用 `{"command": ...}` 或 `{"url": ...}`；
 * OpenCode 必须是 `{"type":"local","command":[...]}` 或 `{"type":"remote","url":...}`，且要求 `enabled`。
 */
export type McpConfigurationResult =
  | { readonly ok: true; readonly configuration: string }
  | { readonly ok: false; readonly error: string };

/** 把 JSON.parse 的报错转成能定位问题的说明：长配置里少一个字符很难靠肉眼发现。 */
export function describeJsonError(error: unknown, value: string): string {
  const message = error instanceof Error ? error.message : '';
  const position = Number(/position (\d+)/.exec(message)?.[1]);
  const reason = message.replace(/\s*at position \d+.*$/, '');
  if (!Number.isFinite(position)) return reason;
  return `${reason}（位置 ${position} 附近：${value.slice(Math.max(0, position - 10), position + 10)}）`;
}

/**
 * 中文输入法会把 " 自动转成 “ ”，终端里几乎看不出区别，但 JSON 会解析失败。
 * 只在原值解析失败、替换成半角后能解析时才修正，避免改动合法字符串里的中文标点。
 */
export function fixMcpPunctuation(value: string): string | undefined {
  try {
    JSON.parse(value);
    return undefined;
  } catch { /* 只有原本解析失败时才尝试修正。 */ }
  const normalized = value.replaceAll(/[“”]/g, '"').replaceAll(/[‘’]/g, "'").replaceAll(/[，]/g, ',').replaceAll(/[：]/g, ':');
  if (normalized === value) return undefined;
  try {
    JSON.parse(normalized);
    return normalized;
  } catch {
    return undefined;
  }
}

/** 校验 MCP 配置 JSON；返回错误信息，合法时返回 undefined。不做 Agent 相关处理。 */
export function validateMcpConfigurationJson(value: string): string | undefined {
  try {
    const parsed: unknown = JSON.parse(value);
    return isRecord(parsed) ? undefined : 'MCP 配置必须是 JSON 对象。';
  } catch (error) {
    return `MCP 配置必须是有效的 JSON：${describeJsonError(error, value)}`;
  }
}

/**
 * 按目标 Agent 的格式规范化配置：能无损转换时转换（例如把 `{"type":"streamable-http","url":…}` 转成
 * OpenCode 的 remote 形式并补上 `enabled`），无法转换时返回该 Agent 期望的格式说明。
 */
export function prepareMcpConfiguration(agent: AgentId, value: string): McpConfigurationResult {
  const text = (fixMcpPunctuation(value.trim()) ?? value.trim());
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return { ok: false, error: `MCP 配置必须是有效的 JSON：${describeJsonError(error, text)}` };
  }
  if (!isRecord(parsed)) return { ok: false, error: 'MCP 配置必须是 JSON 对象。' };
  return agent === 'opencode' ? prepareOpenCodeConfiguration(parsed) : prepareUrlOrCommandConfiguration(agent, parsed);
}

function prepareUrlOrCommandConfiguration(agent: AgentId, parsed: Record<string, unknown>): McpConfigurationResult {
  if (!hasUrl(parsed) && !hasCommand(parsed)) {
    return { ok: false, error: `${agent === 'codex' ? 'Codex' : 'Claude Code'} 的 MCP 配置需要 url，或 command（字符串或字符串数组）。` };
  }
  return { ok: true, configuration: JSON.stringify(parsed) };
}

function prepareOpenCodeConfiguration(parsed: Record<string, unknown>): McpConfigurationResult {
  const type = typeof parsed.type === 'string' ? parsed.type.trim().toLowerCase() : '';
  const url = typeof parsed.url === 'string' ? parsed.url.trim() : '';
  const environment = isRecord(parsed.environment) ? parsed.environment : isRecord(parsed.env) ? parsed.env : undefined;
  const command = commandArray(parsed);
  // OpenCode 只认 remote / local，Claude 的 streamable-http、sse、http 一律按 remote 处理。
  if (url && ['', 'remote', 'http', 'sse', 'streamable-http', 'streamable_http'].includes(type)) {
    return {
      ok: true,
      configuration: JSON.stringify({
        type: 'remote',
        url,
        ...(isRecord(parsed.headers) ? { headers: parsed.headers } : {}),
        enabled: parsed.enabled !== false,
      }),
    };
  }
  if (command && ['', 'local', 'stdio'].includes(type)) {
    return {
      ok: true,
      configuration: JSON.stringify({
        type: 'local',
        command,
        ...(environment ? { environment } : {}),
        ...(typeof parsed.cwd === 'string' && parsed.cwd ? { cwd: parsed.cwd } : {}),
        ...(typeof parsed.timeout === 'number' ? { timeout: parsed.timeout } : {}),
        enabled: parsed.enabled !== false,
      }),
    };
  }
  return { ok: false, error: openCodeFormatHint(type) };
}

function openCodeFormatHint(type: string): string {
  const prefix = type ? `OpenCode 不认识 type "${type}"。` : '';
  return `${prefix}OpenCode 的 MCP 配置需要使用 remote（{"type":"remote","url":"https://example.com/mcp","enabled":true}）或 local（{"type":"local","command":["npx","-y","server"],"enabled":true}）。`;
}

function hasUrl(value: Record<string, unknown>): boolean {
  return typeof value.url === 'string' && value.url.trim() !== '';
}

function hasCommand(value: Record<string, unknown>): boolean {
  return commandArray(value) !== undefined;
}

function commandArray(value: Record<string, unknown>): readonly string[] | undefined {
  const command = value.command;
  if (typeof command === 'string' && command.trim()) return [command, ...stringArray(value.args)];
  if (Array.isArray(command) && command.length > 0 && command.every((part) => typeof part === 'string' && part)) {
    return [...command, ...stringArray(value.args)];
  }
  return undefined;
}

function stringArray(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.filter((part): part is string => typeof part === 'string') : [];
}
