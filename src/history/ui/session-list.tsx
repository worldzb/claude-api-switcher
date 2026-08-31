import React from 'react';
import { Box, Text } from 'ink';

import type { SessionSummary } from '../../agents/types.js';
import { formatSessionRow, relativeTime } from './formatters.js';
import { agentColor } from './theme.js';
import { getViewport } from './viewport.js';

export function SessionList({
  sessions,
  selectedIndex,
  columns,
  visibleCount,
}: {
  readonly sessions: readonly SessionSummary[];
  readonly selectedIndex: number;
  readonly columns: number;
  readonly visibleCount: number;
}): React.JSX.Element {
  const viewport = getViewport({ itemCount: sessions.length, selectedIndex, visibleCount });
  const visibleSessions = sessions.slice(viewport.start, viewport.end);

  return <Box flexDirection="column" marginTop={1}>
    {viewport.start > 0 && <Text color="gray">  ↑ 还有 {viewport.start} 条会话</Text>}
    {visibleSessions.map((session, offset) => {
      const index = viewport.start + offset;
      const row = formatSessionRow(session, Math.max(32, columns - 24));
      const selected = index === selectedIndex;
      return <Box key={`${session.agent}-${session.sourcePath}`} flexDirection="column" paddingX={1}>
        <Box gap={1}>
          <Text color={agentColor(session.agent)} bold>{row.agent.padEnd(8)}</Text>
          <Text bold inverse={selected}>{selected ? `› ${row.title}` : `  ${row.title}`}</Text>
          <Text color="gray">{relativeTime(session.updatedAt)}</Text>
        </Box>
        <Box gap={2} paddingLeft={9}>
          <Text color="gray">{row.cwd}</Text>
          <Text dimColor>#{row.id}</Text>
        </Box>
      </Box>;
    })}
    {viewport.end < sessions.length && <Text color="gray">  ↓ 还有 {sessions.length - viewport.end} 条会话</Text>}
  </Box>;
}
