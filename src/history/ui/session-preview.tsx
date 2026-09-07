import React from 'react';
import { Box, Text } from 'ink';

import type { TranscriptContent, TranscriptMessage, TranscriptRole } from '../../agents/types.js';
import { truncate } from './formatters.js';
import { theme } from './theme.js';

const PREVIEW_MESSAGE_COUNT = 6;
const PREVIEW_MESSAGE_WIDTH = 180;

export interface PreviewMessage {
  readonly role: TranscriptRole;
  readonly text: string;
}

/** 会话记录按时间追加，倒序后使最近的消息优先显示。 */
export function latestPreviewMessages(messages: readonly TranscriptMessage[]): readonly PreviewMessage[] {
  return [...messages]
    .reverse()
    .slice(0, PREVIEW_MESSAGE_COUNT)
    .map((message) => ({
      role: message.role,
      text: truncate(message.content.map(previewContent).join(' ').replaceAll(/\s+/g, ' '), PREVIEW_MESSAGE_WIDTH),
    }));
}

export function SessionPreview({ messages }: { readonly messages: readonly TranscriptMessage[] }): React.JSX.Element {
  const preview = latestPreviewMessages(messages);
  return <Box flexDirection="column" borderStyle="round" borderColor={theme.accent} paddingX={1} marginTop={1}>
    <Text bold color={theme.accent}>会话预览 · 最新消息优先</Text>
    {!preview.length && <Text color="gray">此会话没有可预览的消息。</Text>}
    {preview.map((message, index) => <Box key={`${message.role}-${index}`} gap={1} marginTop={1}>
      <Text color={roleColor(message.role)} bold>{roleLabel(message.role)}</Text>
      <Text>{message.text}</Text>
    </Box>)}
    {messages.length > preview.length && <Text color="gray">已显示最近 {preview.length} 条，共 {messages.length} 条。</Text>}
  </Box>;
}

function previewContent(content: TranscriptContent): string {
  if (content.type === 'text') return content.text;
  return content.type === 'image' ? '[图片附件]' : '[文件附件]';
}

function roleLabel(role: TranscriptRole): string {
  return role === 'user' ? '用户' : role === 'assistant' ? '助手' : '工具';
}

function roleColor(role: TranscriptRole): 'cyan' | 'green' | 'gray' {
  return role === 'user' ? 'cyan' : role === 'assistant' ? 'green' : 'gray';
}
