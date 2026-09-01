import React from 'react';
import { Box, Text, useInput } from 'ink';

export function SearchInput({
  query,
  onChange,
  onSubmit,
  onCancel,
}: {
  readonly query: string;
  readonly onChange: (value: string) => void;
  readonly onSubmit: () => void;
  readonly onCancel: () => void;
}): React.JSX.Element {
  useInput((input, key) => {
    if (key.escape) return onCancel();
    if (key.return) return onSubmit();
    if (key.backspace || key.delete) return onChange(query.slice(0, -1));
    if (input && !key.ctrl && !key.meta) onChange(`${query}${input}`);
  });

  return <Box flexDirection="column" padding={1} borderStyle="round" borderColor="cyan">
    <Text bold color="cyan">搜索历史会话</Text>
    <Box>
      <Text color="gray">关键词： </Text>
      <Text>{query || ' '}</Text>
      <Text color="cyan">▍</Text>
    </Box>
    <Text color="gray">搜索标题、项目目录、Agent 或会话 ID；Enter 确认，Esc 取消。</Text>
  </Box>;
}
