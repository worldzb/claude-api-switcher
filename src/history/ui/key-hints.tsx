import { Box, Text } from 'ink';

export function KeyHints({ items }: { readonly items: readonly string[] }): React.JSX.Element {
  return <Box marginTop={1}><Text color="gray">{items.join(' │ ')}</Text></Box>;
}
