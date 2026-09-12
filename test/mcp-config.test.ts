import { describe, expect, it } from 'vitest';

import {
  describeJsonError,
  fixMcpPunctuation,
  prepareMcpConfiguration,
} from '../src/agents/mcp-config.js';

const DINGTALK = '{"type":"streamable-http","url":"https://mcp-gw.example.com/server/c0da2d834d9?key=3027afd8"}';

function configuration(agent: 'claude' | 'codex' | 'opencode', value: string): string {
  const result = prepareMcpConfiguration(agent, value);
  if (!result.ok) throw new Error(`预期通过，实际失败：${result.error}`);
  return result.configuration;
}

function error(agent: 'claude' | 'codex' | 'opencode', value: string): string {
  const result = prepareMcpConfiguration(agent, value);
  if (result.ok) throw new Error(`预期失败，实际通过：${result.configuration}`);
  return result.error;
}

describe('JSON 错误说明', () => {
  it('给出原因、出错位置和附近内容', () => {
    const value = '{"type":"streamable-http","url":"https://example.com/?key=0123456789abcdef"}';
    const described = describeJsonError(new SyntaxError("Expected ',' or '}' after property value in JSON at position 63 (line 1 column 64)"), value);
    expect(described).toContain("Expected ',' or '}' after property value");
    expect(described).toContain('位置 63');
    expect(described).toContain(value.slice(53, 73));
    expect(described).not.toContain('line 1 column');
  });

  it('没有位置信息时只返回原因', () => {
    expect(describeJsonError(new SyntaxError('Unexpected end of JSON input'), '{"a":')).toBe('Unexpected end of JSON input');
    expect(describeJsonError(undefined, '{}')).toBe('');
  });
});

describe('输入法标点修正', () => {
  it('把中文标点修正为半角', () => {
    expect(fixMcpPunctuation('{“command”：“npx”，“args”：[“-y”，“server”]}')).toBe('{"command":"npx","args":["-y","server"]}');
  });

  it('不修正本身合法或无法修正的内容', () => {
    expect(fixMcpPunctuation('{"command":"npx"}')).toBeUndefined();
    expect(fixMcpPunctuation('{"command":"echo","args":["他说“你好”"]}')).toBeUndefined();
    expect(fixMcpPunctuation('{"command":"echo","args":["时间：12:00"]}')).toBeUndefined();
    expect(fixMcpPunctuation('{“command”：“npx”')).toBeUndefined();
  });
});

describe('Claude 与 Codex 配置', () => {
  it('接受 url 或 command，并原样保留其他字段', () => {
    expect(configuration('claude', '{"command":"npx","args":["-y","server"]}')).toBe('{"command":"npx","args":["-y","server"]}');
    expect(configuration('claude', '{"type":"http","url":"https://example.com/mcp","headers":{"X-A":"1"}}'))
      .toBe('{"type":"http","url":"https://example.com/mcp","headers":{"X-A":"1"}}');
    expect(configuration('codex', '{"url":"https://example.com/mcp"}')).toBe('{"url":"https://example.com/mcp"}');
  });

  it('缺少 url 与 command 时拒绝', () => {
    expect(error('claude', '{}')).toContain('需要 url，或 command');
    expect(error('codex', '{"args":["-y"]}')).toContain('需要 url，或 command');
  });
});

describe('OpenCode 配置', () => {
  it('把 Claude 风格的 streamable-http 转换为 remote 并补上 enabled', () => {
    expect(configuration('opencode', DINGTALK)).toBe(JSON.stringify({
      type: 'remote',
      url: 'https://mcp-gw.example.com/server/c0da2d834d9?key=3027afd8',
      enabled: true,
    }));
    expect(configuration('opencode', '{"type":"sse","url":"https://example.com/sse"}'))
      .toBe('{"type":"remote","url":"https://example.com/sse","enabled":true}');
  });

  it('保留 headers，并把 Claude 的 env 映射成 environment', () => {
    expect(configuration('opencode', '{"type":"http","url":"https://example.com/mcp","headers":{"Authorization":"Bearer x"},"enabled":false}'))
      .toBe('{"type":"remote","url":"https://example.com/mcp","headers":{"Authorization":"Bearer x"},"enabled":false}');
    expect(configuration('opencode', '{"command":"npx","args":["-y","server"],"env":{"TOKEN":"x"}}'))
      .toBe('{"type":"local","command":["npx","-y","server"],"environment":{"TOKEN":"x"},"enabled":true}');
  });

  it('local 配置合并 args 并去掉 OpenCode 不认识的键', () => {
    expect(configuration('opencode', '{"type":"stdio","command":["bun","x","server"],"args":["--flag"]}'))
      .toBe('{"type":"local","command":["bun","x","server","--flag"],"enabled":true}');
  });

  it('缺少 url 与 command 时给出期望的两种格式', () => {
    const message = error('opencode', '{"type":"remote"}');
    expect(message).toContain('type "remote"');
    expect(message).toContain('"type":"remote","url"');
    expect(message).toContain('"type":"local","command"');
    expect(error('opencode', '{}')).toContain('OpenCode 的 MCP 配置需要');
  });

  it('无法识别的 type 会被指出', () => {
    expect(error('opencode', '{"type":"websocket","url":"wss://example.com"}')).toContain('不认识 type "websocket"');
  });

  it('非法 JSON 与输入法标点都会被处理', () => {
    expect(error('opencode', '{"type":"remote"')).toContain('必须是有效的 JSON');
    expect(configuration('opencode', '{“type”：“remote”，“url”：“https://example.com/mcp”}'))
      .toBe('{"type":"remote","url":"https://example.com/mcp","enabled":true}');
  });
});
