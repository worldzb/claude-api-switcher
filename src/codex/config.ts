import fs from 'node:fs';
import path from 'node:path';

// 仅匹配顶层的 model 行（行首），不会命中 review_model 等其他键或 [table] 段内的键
const MODEL_LINE = /^model\s*=\s*"([^"]*)"/m;
const TABLE_HEADER = /^\s*\[/;
const CATALOG_LINE = /^model_catalog_json\s*=\s*(.+)$/m;

/** zmai 生成的模型目录文件名（config.toml 同目录） */
export const CODEX_CATALOG_FILENAME = 'zmai-models.json';

export function resolveCodexConfigFile(homeDirectory: string): string {
  return path.join(homeDirectory, '.codex', 'config.toml');
}

export function readCodexConfig(filePath: string): string {
  if (!fs.existsSync(filePath)) {
    return '';
  }
  return fs.readFileSync(filePath, 'utf8');
}

export function writeCodexConfig(filePath: string, source: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, source.endsWith('\n') ? source : `${source}\n`, 'utf8');
}

export function findCurrentCodexModel(source: string): string | undefined {
  const match = source.match(MODEL_LINE);
  return match?.[1] || undefined;
}

export function applyCodexModel(source: string, modelId: string): string {
  const model = modelId.trim();
  if (!model) {
    throw new Error('请输入模型名称。');
  }

  const line = `model = "${model}"`;
  if (MODEL_LINE.test(source)) {
    return source.replace(MODEL_LINE, line);
  }

  // 没有顶层 model 行时：插入到第一个 [table] 段之前，保持顶层键位置
  const lines = source ? source.split('\n') : [];
  const headerIndex = lines.findIndex((value) => TABLE_HEADER.test(value));
  if (headerIndex < 0) {
    return `${source.replace(/\n*$/, '')}\n\n${line}\n`;
  }
  const top = lines.slice(0, headerIndex).join('\n').replace(/\n*$/, '\n');
  const rest = lines.slice(headerIndex).join('\n').replace(/\n*$/, '\n');
  return `${top}${line}\n\n${rest}`;
}

export function clearCodexModel(source: string): string {
  const match = source.match(MODEL_LINE);
  if (!match) {
    return source;
  }

  const lines = source.split('\n').filter((value) => value !== match[0]);
  return `${lines.join('\n').replace(/\n*$/, '\n')}`;
}

export interface CodexModelCatalog {
  readonly models: readonly Record<string, unknown>[];
}

export interface BuildCatalogResult {
  readonly catalog: CodexModelCatalog;
  /** 实际生成的自定义条目（跳过与内置重复的） */
  readonly added: readonly string[];
  /** 与内置目录重复而跳过的自定义模型 */
  readonly skipped: readonly string[];
  /** 内置目录保留的条目数（codex 不可用时为 0） */
  readonly bundledCount: number;
}

/**
 * 构建模型目录：自定义模型在前，官方内置条目原样保留在后。
 * codex 的目录会整体替换内置列表，合并内置条目才能让 /model 同时显示两者。
 */
export function buildCodexModelCatalog(modelIds: readonly string[], bundled?: unknown): BuildCatalogResult {
  const bundledEntries = parseBundledEntries(bundled);
  const bundledSlugs = new Set(bundledEntries.map((entry) => entry.slug as string));
  const instructions = pickInstructionsTemplate(bundledEntries);

  const names = [...new Set(modelIds.map((model) => model.trim()).filter((model) => model !== ''))];
  const added: string[] = [];
  const skipped: string[] = [];
  const customEntries: Record<string, unknown>[] = [];
  for (const name of names) {
    if (bundledSlugs.has(name)) {
      skipped.push(name);
      continue;
    }
    customEntries.push(createCatalogEntry(name, instructions));
    added.push(name);
  }

  return {
    catalog: { models: [...customEntries, ...bundledEntries] },
    added,
    skipped,
    bundledCount: bundledEntries.length,
  };
}

export function resolveCodexCatalogFile(configFile: string): string {
  return path.join(path.dirname(configFile), CODEX_CATALOG_FILENAME);
}

/** 挂载模型目录：写入顶层的 model_catalog_json 行（存在则替换）。 */
export function applyCodexModelCatalog(source: string, catalogPath: string): string {
  const line = `model_catalog_json = ${toTomlStringValue(catalogPath)}`;
  const { top, rest } = splitTopLevel(source);
  if (CATALOG_LINE.test(top)) {
    return joinTopLevel(top.replace(CATALOG_LINE, line), rest);
  }
  return joinTopLevel(top ? `${top.replace(/\n*$/, '')}\n${line}` : line, rest);
}

export interface ClearCatalogResult {
  readonly content: string;
  /** 是否移除了 zmai 挂载的 model_catalog_json 行 */
  readonly removed: boolean;
}

/** 撤回模型目录：仅移除指向 zmai 生成文件的 model_catalog_json 行，用户自己的指向保持不动。 */
export function clearCodexModelCatalog(source: string): ClearCatalogResult {
  const { top, rest } = splitTopLevel(source);
  const match = top.match(CATALOG_LINE);
  if (!match || !match[1].includes(CODEX_CATALOG_FILENAME)) {
    return { content: source, removed: false };
  }

  const lines = top.split('\n').filter((value) => value !== match[0]);
  return { content: joinTopLevel(lines.join('\n').replace(/\n*$/, ''), rest), removed: true };
}

function parseBundledEntries(bundled: unknown): readonly Record<string, unknown>[] {
  const models = (bundled as { models?: unknown } | undefined)?.models;
  if (!Array.isArray(models)) {
    return [];
  }
  return models.filter((entry): entry is Record<string, unknown> =>
    typeof entry === 'object' && entry !== null && !Array.isArray(entry) && typeof (entry as Record<string, unknown>).slug === 'string');
}

function pickInstructionsTemplate(entries: readonly Record<string, unknown>[]): string {
  for (const entry of entries) {
    const messages = entry.model_messages;
    const template = (messages as { instructions_template?: unknown } | undefined)?.instructions_template;
    if (typeof template === 'string' && template !== '') {
      return template;
    }
  }
  return '';
}

function createCatalogEntry(slug: string, instructions: string): Record<string, unknown> {
  return {
    slug,
    display_name: slug,
    description: `${slug}（zmai 同步）`,
    context_window: 400000,
    max_context_window: 400000,
    supported_reasoning_levels: [
      { effort: 'low', description: 'Fast responses with lighter reasoning' },
      { effort: 'medium', description: 'Balances speed and reasoning depth for everyday tasks' },
      { effort: 'high', description: 'Greater reasoning depth for complex problems' },
    ],
    shell_type: 'default',
    visibility: 'list',
    supported_in_api: true,
    priority: 50,
    base_instructions: instructions,
    supports_reasoning_summaries: 'auto',
    support_verbosity: false,
    default_verbosity: 'low',
    apply_patch_tool_type: 'freeform',
    truncation_policy: { mode: 'tokens', limit: 10000 },
    supports_parallel_tool_calls: true,
    experimental_supported_tools: [],
  };
}

/** 顶层键必须位于第一个 [table] 段之前，编辑时只作用于顶层区域 */
function splitTopLevel(source: string): { readonly top: string; readonly rest: string } {
  const lines = source ? source.split('\n') : [];
  const headerIndex = lines.findIndex((value) => TABLE_HEADER.test(value));
  if (headerIndex < 0) {
    return { top: lines.join('\n'), rest: '' };
  }
  return { top: lines.slice(0, headerIndex).join('\n'), rest: lines.slice(headerIndex).join('\n') };
}

function joinTopLevel(top: string, rest: string): string {
  if (!rest) {
    return `${top}\n`;
  }
  const header = top ? `${top}\n\n` : '';
  return `${header}${rest}`;
}

/** Windows 路径优先用 TOML 字面字符串（单引号，反斜杠无需转义），含单引号时回退基本字符串 */
function toTomlStringValue(value: string): string {
  if (!value.includes("'") && !/[\r\n\t]/.test(value)) {
    return `'${value}'`;
  }
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r/g, '\\r').replace(/\n/g, '\\n').replace(/\t/g, '\\t')}"`;
}
