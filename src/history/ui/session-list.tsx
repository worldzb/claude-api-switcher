import React from 'react';
import { Box, Text } from 'ink';

import type { SessionSummary } from '../../agents/types.js';
import { sessionSelectionKey } from '../session-selection.js';
import { formatSessionRow, relativeTime } from './formatters.js';
import { agentColor, theme } from './theme.js';
import { getViewport } from './viewport.js';

export function SessionList({
  sessions,
  selectedIndex,
  selectedSessionKeys,
  columns,
  visibleCount,
  baseIndex = 0,
}: {
  readonly sessions: readonly SessionSummary[];
  readonly selectedIndex: number;
  readonly selectedSessionKeys: ReadonlySet<string>;
  readonly columns: number;
  readonly visibleCount: number;
  readonly baseIndex?: number;
}): React.JSX.Element {
  const viewport = getViewport({ itemCount: sessions.length, selectedIndex, visibleCount });
  const visibleSessions = sessions.slice(viewport.start, viewport.end);

  return <Box flexDirection="column" marginTop={1}>
    {viewport.start > 0 && <Text color="gray">  ↑ 还有 {viewport.start} 条会话</Text>}
    {visibleSessions.map((session, offset) => {
      const index = viewport.start + offset;
      const number = baseIndex + index + 1;
      const row = formatSessionRow(session, Math.max(32, columns - 24));
      const selected = index === selectedIndex;
      const marked = selectedSessionKeys.has(sessionSelectionKey(session));
      return <Box key={`${session.agent}-${session.sourcePath}`} flexDirection="column" paddingX={1}>
        <Box gap={1}>
          <Text color="gray">{String(number).padStart(2, ' ')}</Text>
          <Text color={agentColor(session.agent)} bold>{row.agent.padEnd(8)}</Text>
          <Text bold inverse={selected} color={marked ? theme.accent : undefined}>{selected ? `› ${row.title}` : `${marked ? '✓' : ' '} ${row.title}`}</Text>
          <Text color="gray">{relativeTime(session.updatedAt)}</Text>
        </Box>
        <Box gap={2} paddingLeft={12}>
          <Text color="gray">{row.cwd}</Text>
          <Text dimColor>#{row.id}</Text>
        </Box>
      </Box>;
    })}
    {viewport.end < sessions.length && <Text color="gray">  ↓ 还有 {sessions.length - viewport.end} 条会话</Text>}
  </Box>;
}
