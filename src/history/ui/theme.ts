import type { AgentId } from '../../agents/types.js';

export const theme = {
  accent: 'cyan',
  muted: 'gray',
  selectedBackground: 'blue',
  danger: 'red',
  success: 'green',
} as const;

export function agentColor(agent: AgentId): 'magenta' | 'green' | 'yellow' {
  if (agent === 'claude') return 'magenta';
  if (agent === 'codex') return 'green';
  return 'yellow';
}
