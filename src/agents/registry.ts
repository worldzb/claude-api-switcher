import type { AgentAdapter, AgentId } from './types.js';
import { ClaudeAdapter } from './claude-adapter.js';
import { CodexAdapter } from './codex-adapter.js';
import { OpenCodeAdapter } from './opencode-adapter.js';

export class AgentRegistry {
  private readonly adapters: ReadonlyMap<AgentId, AgentAdapter>;

  constructor(homeDirectory: string) {
    const adapters: readonly AgentAdapter[] = [
      new ClaudeAdapter(homeDirectory),
      new CodexAdapter(homeDirectory),
      new OpenCodeAdapter(homeDirectory),
    ];
    this.adapters = new Map(adapters.map((adapter) => [adapter.id, adapter]));
  }

  all(): readonly AgentAdapter[] {
    return [...this.adapters.values()];
  }

  get(id: AgentId): AgentAdapter {
    const adapter = this.adapters.get(id);
    if (!adapter) throw new Error(`不支持的 Agent：${id}`);
    return adapter;
  }
}
