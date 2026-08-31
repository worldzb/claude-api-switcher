import React from 'react';
import { Box, Text } from 'ink';

import type { SessionSummary } from '../../agents/types.js';
import { relativeTime } from './formatters.js';
import { agentColor } from './theme.js';

export function SessionDetails({ session }: { readonly session: SessionSummary }): React.JSX.Element {
  return <Box flexDirection="column" borderStyle="round" borderColor={agentColor(session.agent)} paddingX={1} marginTop={1}>
    <Text bold>{session.title}</Text>
    <Text color={agentColor(session.agent)}>{session.agent.toUpperCase()} · {relativeTime(session.updatedAt)}</Text>
    <Text color="gray">{session.cwd}</Text>
    <Text dimColor>会话 ID：{session.id}</Text>
  </Box>;
}
