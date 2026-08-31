import type {
  TranscriptContent,
  TranscriptMessage,
  TranscriptRole,
} from '../agents/types.js';

export function normalizeContent(value: unknown): readonly TranscriptContent[] {
  if (typeof value === 'string') {
    return value.trim() ? [{ type: 'text', text: value }] : [];
  }
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item): readonly TranscriptContent[] => {
    if (!isRecord(item)) return [];
    if (typeof item.text === 'string') return [{ type: 'text', text: item.text }];
    if ((item.type === 'input_text' || item.type === 'output_text') && typeof item.text === 'string') {
      return [{ type: 'text', text: item.text }];
    }
    if (typeof item.path === 'string' && (item.type === 'image' || item.type === 'file')) {
      return [{
        type: item.type,
        path: item.path,
        ...(typeof item.mimeType === 'string' ? { mimeType: item.mimeType } : {}),
      }];
    }
    if (typeof item.image_url === 'string') {
      return [{ type: 'text', text: `[远程图片引用：${item.image_url}]` }];
    }
    if (isRecord(item.image_url) && typeof item.image_url.url === 'string') {
      return [{ type: 'text', text: `[远程图片引用：${item.image_url.url}]` }];
    }
    if (isRecord(item.source) && typeof item.source.data === 'string' && item.type === 'image') {
      return [{ type: 'text', text: '[图片内容为内嵌数据，迁移时需要手动导出。]' }];
    }
    return [];
  });
}

export function normalizeMessage(value: unknown): TranscriptMessage | undefined {
  if (!isRecord(value)) return undefined;
  const role = toRole(value.role);
  if (!role) return undefined;
  const content = normalizeContent(value.content);
  return content.length ? { role, content } : undefined;
}

function toRole(value: unknown): TranscriptRole | undefined {
  if (value === 'user' || value === 'assistant') return value;
  if (value === 'tool' || value === 'toolResult') return 'tool';
  return undefined;
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
