import type { AgentId } from './types.js';

/**
 * MCP 名称在不同 Agent 上的限制并不一样：
 * Claude 与 OpenCode 把名称写成 JSON 键，可以是任意文字（含中文）；
 * Codex 通过 `codex mcp add <name>` 写入，CLI 只接受 ASCII 名称。
 */
const ASCII_NAME = /^[A-Za-z0-9\-_:@/.]+$/;
const UNICODE_NAME = /^[\p{L}\p{N}\p{M}._@/-]+$/u;

const PATTERNS: Readonly<Record<AgentId, RegExp>> = {
  claude: UNICODE_NAME,
  codex: ASCII_NAME,
  opencode: UNICODE_NAME,
};

/** 校验名称在该 Agent 上是否可用；返回错误信息，可用时返回 undefined。 */
export function mcpNameError(agent: AgentId, value: string): string | undefined {
  const name = value.trim();
  if (!name) return 'MCP 名称不能为空。';
  if (PATTERNS[agent].test(name)) return undefined;
  return agent === 'codex'
    ? 'Codex 只接受字母、数字与 - _ : @ / . 组成的名称，不支持中文，请改名或改用 Claude / OpenCode。'
    : 'MCP 名称只能包含中文、字母、数字、点、下划线、短横线、@ 或 /。';
}
