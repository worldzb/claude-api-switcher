import React from 'react';
import { Box, Text } from 'ink';

export function KeyHints({ items }: { readonly items: readonly string[] }): React.JSX.Element {
  return <Box marginTop={1} gap={2}>
    {items.map((item) => <Text key={item} color="gray">{item}</Text>)}
  </Box>;
}
