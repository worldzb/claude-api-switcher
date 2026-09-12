import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Text, useApp, useInput, useStdout } from 'ink';

import { AGENT_IDS, type AgentId, type IntegrationItem } from '../../agents/types.js';
import { prepareMcpConfiguration } from '../../agents/mcp-config.js';
import { KeyHints } from '../../history/ui/key-hints.js';
import { agentColor, theme } from '../../history/ui/theme.js';
import { pageResourceItems } from '../resource-pagination.js';
import {
  MCP_ADD_TARGETS,
  mcpAddTargetScope,
  mcpConfigurationHint,
  mcpNameHint,
  mcpAgentsForTarget,
  nextMcpAddStep,
  previousMcpAddStep,
  resolveMcpProjectPath,
  validateMcpName,
  validateProjectPath,
  type McpAddStep,
  type McpAddTarget,
} from './mcp-add.js';

const AGENT_FILTERS: readonly ('all' | AgentId)[] = ['all', 'claude', 'codex', 'opencode'];
// 部分终端把方向键作为原始转义序列送入，保留裸序列兜底。
const ARROW_LEFT = '\u001b[D';
const ARROW_RIGHT = '\u001b[C';
type ResourceScope = 'project' | 'user';
const RESOURCE_SCOPES: readonly ResourceScope[] = ['project', 'user'];
type ResourceAction = 'copy' | 'remove' | 'enable' | 'disable';

export interface McpAddInput {
  readonly agent: AgentId;
  readonly name: string;
  readonly configuration: string;
  readonly scope: ResourceScope;
  readonly project?: string;
}

export interface ResourceAppProps {
  readonly kind: IntegrationItem['kind'];
  readonly label: string;
  readonly items: readonly IntegrationItem[];
  readonly projectDirectory: string;
  readonly homeDirectory: string;
  readonly onRefresh: () => Promise<readonly IntegrationItem[]>;
  readonly onCopy: (item: IntegrationItem, target: AgentId, scope: ResourceScope) => Promise<string>;
  readonly onRemove: (item: IntegrationItem) => Promise<string>;
  readonly onSetEnabled: (item: IntegrationItem, enabled: boolean) => Promise<string>;
  /** 添加 MCP；未提供时列表不显示添加入口。 */
  readonly onAdd?: (input: McpAddInput) => Promise<string>;
  /** 支持写入项目级 MCP 的 Agent；缺省视为全部支持。 */
  readonly mcpProjectAgents?: readonly AgentId[];
  readonly onClearScreen: () => void;
}

interface PendingAction { readonly action: ResourceAction; readonly target?: AgentId }

interface McpAddDraft {
  readonly step: McpAddStep;
  readonly targetIndex: number;
  readonly projectPath: string;
  readonly agentIndex: number;
  readonly name: string;
  readonly configuration: string;
  readonly error: string;
}

export function resourceActions(item: IntegrationItem): readonly ResourceAction[] {
  return ['copy', ...(item.removable ? ['remove' as const] : []), ...(item.agent === 'claude' && item.kind === 'plugin' && item.enabled !== true ? ['enable' as const] : []), ...(item.agent === 'claude' && item.kind === 'plugin' && item.enabled !== false ? ['disable' as const] : [])];
}

export function ResourceApp(props: ResourceAppProps): React.JSX.Element {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const refreshRef = useRef(props.onRefresh);
  const [items, setItems] = useState<readonly IntegrationItem[]>(props.items);
  const [scope, setScope] = useState<ResourceScope>('project');
  const [filter, setFilter] = useState<'all' | AgentId>('all');
  const [pageNumber, setPageNumber] = useState(1);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('正在准备扫描…');
  const [loadingFrame, setLoadingFrame] = useState(0);
  const [loadingError, setLoadingError] = useState('');
  const [pending, setPending] = useState<PendingAction>();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [showingActions, setShowingActions] = useState(false);
  const [choosingTarget, setChoosingTarget] = useState(false);
  const [actionIndex, setActionIndex] = useState(0);
  const [targetIndex, setTargetIndex] = useState(0);
  const [targetScope, setTargetScope] = useState<ResourceScope>('project');
  const [addDraft, setAddDraft] = useState<McpAddDraft>();
  // Ink 在 useEffect 中重新注册按键监听，闭包里的 state 可能落后一次渲染；
  // 因此向导统一读写这个同步更新的 ref，避免快速输入时丢字符或校验到旧的草稿。
  const addDraftRef = useRef<McpAddDraft>();
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  const canAdd = props.kind === 'mcp' && Boolean(props.onAdd);
  const projectAgents = props.mcpProjectAgents ?? AGENT_IDS;
  const pathContext = { cwd: props.projectDirectory, homeDirectory: props.homeDirectory };
  const addAgents = addDraft ? mcpAgentsForTarget(MCP_ADD_TARGETS[addDraft.targetIndex].value, projectAgents) : [];

  const reload = (): void => {
    setLoading(true);
    setLoadingError('');
    setLoadingMessage('正在扫描资源…');
    void refreshRef.current().then((nextItems) => {
      setItems(nextItems);
      setPageNumber(1);
      setSelectedIndex(0);
      setLoading(false);
    }).catch((caught: unknown) => {
      setLoadingError(caught instanceof Error ? caught.message : '资源扫描失败。');
      setLoading(false);
    });
  };

  useEffect(() => {
    const timer = setInterval(() => setLoadingFrame((frame) => (frame + 1) % frames.length), 80);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => { reload(); }, []);

  const filtered = useMemo(() => items.filter((item) => item.scope === scope && (filter === 'all' || item.agent === filter)), [items, scope, filter]);
  const pageSize = Math.max(1, Math.floor(((stdout?.rows || 24) - 10) / 2));
  const page = pageResourceItems(filtered, pageNumber, pageSize);
  const selected = page.items[selectedIndex];
  const currentCount = items.filter((item) => item.scope === 'project').length;
  const userCount = items.filter((item) => item.scope === 'user').length;
  const targets = selected ? AGENT_FILTERS.filter((agent): agent is AgentId => agent !== 'all' && agent !== selected.agent) : [];

  useInput((input, key) => {
    if (loading) {
      if (input === 'q' || key.escape) exit();
      return;
    }
    if (addDraftRef.current) return handleMcpAddInput(input, key);
    if (message || error) {
      if (key.return || key.escape) { setMessage(''); setError(''); }
      return;
    }
    if (pending) {
      if (input.toLowerCase() === 'y' && selected) {
        const action = pending;
        setPending(undefined);
        if (action.action === 'copy' && action.target) {
          const target = action.target;
          void runAction(() => props.onCopy(selected, target, targetScope));
        }
        else if (action.action === 'remove') void runAction(() => props.onRemove(selected));
        else if (action.action === 'enable' || action.action === 'disable') void runAction(() => props.onSetEnabled(selected, action.action === 'enable'));
      } else if (input.toLowerCase() === 'n' || key.escape) setPending(undefined);
      return;
    }
    if (choosingTarget) {
      if (key.escape) return setChoosingTarget(false);
      if (key.upArrow) return setTargetIndex((index) => Math.max(0, index - 1));
      if (key.downArrow) return setTargetIndex((index) => Math.min(targets.length - 1, index + 1));
      if (key.leftArrow || input === ARROW_LEFT) return setTargetScope('project');
      if (key.rightArrow || input === ARROW_RIGHT) return setTargetScope('user');
      if (key.return && selected && targets[targetIndex]) {
        setChoosingTarget(false);
        setPending({ action: 'copy', target: targets[targetIndex] });
      }
      return;
    }
    if (showingActions) {
      const actions = selected ? resourceActions(selected) : [];
      if (key.escape) return setShowingActions(false);
      if (key.upArrow) return setActionIndex((index) => Math.max(0, index - 1));
      if (key.downArrow) return setActionIndex((index) => Math.min(Math.max(0, actions.length - 1), index + 1));
      if (key.return && selected) {
        const action = actions[actionIndex];
        if (action === 'copy') { setTargetIndex(0); setShowingActions(false); setChoosingTarget(true); }
        else if (action) { setShowingActions(false); setPending({ action }); }
      }
      return;
    }
    if (input === 'q' || key.escape) return void exit();
    if (input === 'r') return reload();
    if (input === 'a' && canAdd) return startMcpAdd();
    if (key.leftArrow || input === ARROW_LEFT) return changeScope('project');
    if (key.rightArrow || input === ARROW_RIGHT) return changeScope('user');
    if (input === '1') return changeFilter('all');
    if (input === '2') return changeFilter('claude');
    if (input === '3') return changeFilter('codex');
    if (input === '4') return changeFilter('opencode');
    if (input === '-' || key.pageUp) return changePage(page.page - 1);
    if (input === '+' || input === '=' || key.pageDown) return changePage(page.page + 1);
    if (key.upArrow) return setSelectedIndex((index) => Math.max(0, index - 1));
    if (key.downArrow) return setSelectedIndex((index) => Math.min(Math.max(0, page.items.length - 1), index + 1));
    if (key.return && selected) { setActionIndex(0); setShowingActions(true); }
  });

  function changeScope(next: ResourceScope): void { props.onClearScreen(); setScope(next); setPageNumber(1); setSelectedIndex(0); }
  function changeFilter(next: 'all' | AgentId): void { props.onClearScreen(); setFilter(next); setPageNumber(1); setSelectedIndex(0); }
  function changePage(next: number): void { if (next < 1 || next > page.totalPages) return; props.onClearScreen(); setPageNumber(next); setSelectedIndex(0); }
  function runAction(action: () => Promise<string>): void { void action().then((result) => { setMessage(result); return refreshRef.current(); }).then(setItems).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : '操作失败。')); }

  function writeMcpDraft(next: McpAddDraft | undefined): void {
    addDraftRef.current = next;
    setAddDraft(next);
  }

  function startMcpAdd(): void {
    props.onClearScreen();
    writeMcpDraft({ step: 'target', targetIndex: scope === 'user' ? 0 : 1, projectPath: '', agentIndex: 0, name: '', configuration: '', error: '' });
  }

  function handleMcpAddInput(input: string, key: { readonly return: boolean; readonly escape: boolean; readonly upArrow: boolean; readonly downArrow: boolean; readonly backspace: boolean; readonly delete: boolean; readonly ctrl: boolean; readonly meta: boolean }): void {
    const draft = addDraftRef.current;
    if (!draft) return;
    const target = MCP_ADD_TARGETS[draft.targetIndex].value;
    if (key.escape) {
      const previous = previousMcpAddStep(target, draft.step);
      return writeMcpDraft(previous ? { ...draft, step: previous, error: '' } : undefined);
    }
    if (draft.step === 'confirm') {
      if (input.toLowerCase() === 'y' || key.return) return submitMcpAdd(draft);
      if (input.toLowerCase() === 'n') return writeMcpDraft(undefined);
      return;
    }
    if (key.upArrow || key.downArrow) {
      const delta = key.upArrow ? -1 : 1;
      if (draft.step === 'target') return writeMcpDraft({ ...draft, targetIndex: clampIndex(draft.targetIndex + delta, MCP_ADD_TARGETS.length), agentIndex: 0, error: '' });
      if (draft.step === 'agent') return writeMcpDraft({ ...draft, agentIndex: clampIndex(draft.agentIndex + delta, mcpAgentsForTarget(target, projectAgents).length), error: '' });
      return;
    }
    if (key.return) return advanceMcpAdd(draft);
    if (draft.step === 'projectPath' || draft.step === 'name' || draft.step === 'configuration') {
      if (key.backspace || key.delete) return updateAddText((value) => value.slice(0, -1));
      // 粘贴内容里可能带换行，直接输入会让 JSON 变成非法，统一按空白丢弃。
      const text = input.replaceAll(/[\r\n]/g, '');
      if (text && !key.ctrl && !key.meta) return updateAddText((value) => `${value}${text}`);
    }
  }

  function updateAddText(change: (value: string) => string): void {
    const draft = addDraftRef.current;
    if (!draft) return;
    if (draft.step === 'projectPath') return writeMcpDraft({ ...draft, projectPath: change(draft.projectPath), error: '' });
    if (draft.step === 'name') return writeMcpDraft({ ...draft, name: change(draft.name), error: '' });
    if (draft.step === 'configuration') return writeMcpDraft({ ...draft, configuration: change(draft.configuration), error: '' });
  }

  function advanceMcpAdd(draft: McpAddDraft): void {
    const target = MCP_ADD_TARGETS[draft.targetIndex].value;
    if (draft.step === 'target') {
      if (!mcpAgentsForTarget(target, projectAgents).length) return writeMcpDraft({ ...draft, error: '没有 Agent 支持项目级 MCP 配置。' });
      return writeMcpDraft({ ...draft, step: nextMcpAddStep(target, 'target') ?? 'agent', agentIndex: 0, error: '' });
    }
    if (draft.step === 'projectPath') {
      const projectError = validateProjectPath(draft.projectPath, pathContext);
      if (projectError) return writeMcpDraft({ ...draft, error: projectError });
      return writeMcpDraft({ ...draft, step: 'agent', agentIndex: 0, error: '' });
    }
    if (draft.step === 'agent') return writeMcpDraft({ ...draft, step: 'name', error: '' });
    if (draft.step === 'name') {
      const agent = mcpAgentsForTarget(target, projectAgents)[draft.agentIndex];
      const nameError = agent ? validateMcpName(draft.name, mcpDuplicateCandidates(draft), agent) : '没有 Agent 支持项目级 MCP 配置。';
      if (nameError) return writeMcpDraft({ ...draft, error: nameError });
      return writeMcpDraft({ ...draft, step: 'configuration', error: '' });
    }
    if (draft.step === 'configuration') {
      const agent = mcpAgentsForTarget(target, projectAgents)[draft.agentIndex];
      if (!agent) return writeMcpDraft({ ...draft, error: '没有 Agent 支持项目级 MCP 配置。' });
      // 按目标 Agent 的格式校验/转换，确认页展示的就是实际写入的内容。
      const prepared = prepareMcpConfiguration(agent, draft.configuration);
      if (!prepared.ok) return writeMcpDraft({ ...draft, error: prepared.error });
      return writeMcpDraft({ ...draft, configuration: prepared.configuration, step: 'confirm', error: '' });
    }
  }

  function mcpDuplicateCandidates(draft: McpAddDraft): readonly IntegrationItem[] {
    const target = MCP_ADD_TARGETS[draft.targetIndex].value;
    if (target === 'other') return [];
    const targetScope = mcpAddTargetScope(target);
    const agent = mcpAgentsForTarget(target, projectAgents)[draft.agentIndex];
    return items.filter((item) => item.scope === targetScope && item.agent === agent);
  }

  function submitMcpAdd(draft: McpAddDraft): void {
    const target = MCP_ADD_TARGETS[draft.targetIndex].value;
    const agent = mcpAgentsForTarget(target, projectAgents)[draft.agentIndex];
    const add = props.onAdd;
    writeMcpDraft(undefined);
    if (!agent || !add) return setError('没有 Agent 支持项目级 MCP 配置。');
    const targetScope = mcpAddTargetScope(target);
    const project = targetScope === 'project' ? (target === 'other' ? resolveMcpProjectPath(draft.projectPath, pathContext) : props.projectDirectory) : undefined;
    runAction(() => add({ agent, name: draft.name.trim(), configuration: draft.configuration.trim(), scope: targetScope, ...(project ? { project } : {}) }));
  }

  if (loading) return <Box flexDirection="column" padding={1} borderStyle="round" borderColor={theme.accent}><Box gap={1}><Text color={theme.accent}>{frames[loadingFrame]}</Text><Text bold color={theme.accent}>ZMAI · 正在加载 {props.label}</Text></Box><Text color="gray">{loadingMessage}</Text><KeyHints items={['q 退出']} /></Box>;
  if (loadingError) return <Box flexDirection="column" padding={1} borderStyle="round" borderColor={theme.danger}><Text bold color={theme.danger}>{props.label} 加载失败</Text><Text>{loadingError}</Text><KeyHints items={['r 重试', 'q 退出']} /></Box>;
  if (addDraft) return <McpAddScreen draft={addDraft} projectDirectory={props.projectDirectory} homeDirectory={props.homeDirectory} agents={addAgents} />;
  if (pending && selected) return <Box flexDirection="column" padding={1} borderStyle="double" borderColor={pending.action === 'remove' || pending.action === 'disable' ? theme.danger : theme.accent}><Text bold color={theme.danger}>{confirmationLabel(pending, props.label)}？</Text><Text>{selected.agent} · {selected.name}</Text><Text color="gray">{selected.location}</Text><KeyHints items={['y 确认', 'n / Esc 取消']} /></Box>;
  if (message || error) return <Box flexDirection="column" padding={1} borderStyle="round" borderColor={error ? theme.danger : theme.success}><Text bold color={error ? theme.danger : theme.success}>{error ? '操作失败' : '操作完成'}</Text><Text>{error || message}</Text><KeyHints items={['Enter 返回列表', 'q 退出']} /></Box>;
  if (choosingTarget && selected) return <Box flexDirection="column" padding={1} borderStyle="round" borderColor={theme.accent}><Text bold color={theme.accent}>复制 {props.label} 到其他 Agent</Text><Box gap={1} marginTop={1}><Text inverse={targetScope === 'project'}>← 当前目录</Text><Text inverse={targetScope === 'user'}>→ 全局</Text></Box>{targets.map((target, index) => <Text key={target} inverse={index === targetIndex}>{index === targetIndex ? '› ' : '  '}{target.toUpperCase()}</Text>)}<KeyHints items={['←→ 选择范围', '↑↓ 选择 Agent', 'Enter 继续', 'Esc 返回']} /></Box>;
  if (showingActions && selected) { const actions = resourceActions(selected); return <Box flexDirection="column" padding={1} borderStyle="round" borderColor={theme.accent}><Text bold color={theme.accent}>{props.label} 操作</Text>{actions.map((action, index) => <Text key={action} inverse={index === actionIndex}>{index === actionIndex ? '› ' : '  '}{actionLabel(action)}</Text>)}<KeyHints items={['↑↓ 选择', 'Enter 确认', 'Esc 返回']} /></Box>; }

  return <Box flexDirection="column" paddingX={1}>
    <Box justifyContent="space-between" borderStyle="round" borderColor={theme.accent} paddingX={1}><Text bold color={theme.accent}>ZMAI · {props.label}</Text><Text color="gray">{page.total} 项 · 第 {page.page}/{page.totalPages} 页</Text></Box>
    <Box gap={1} marginTop={1}>{RESOURCE_SCOPES.map((itemScope) => <Text key={itemScope} inverse={scope === itemScope} color={scope === itemScope ? theme.accent : 'gray'}>{itemScope === 'project' ? `← 当前项目 (${currentCount})` : `→ 全局 (${userCount})`}</Text>)}</Box>
    <Box gap={1} marginTop={1}>{AGENT_FILTERS.map((agent, index) => <Text key={agent} inverse={filter === agent} color={agent === 'all' ? 'gray' : agentColor(agent)}>{index + 1} {agent === 'all' ? '全部' : agent.toUpperCase()} ({items.filter((item) => item.scope === scope && (agent === 'all' || item.agent === agent)).length})</Text>)}</Box>
    <Box flexDirection="column" marginTop={1}>{page.items.map((item, index) => <Box key={`${item.agent}:${item.kind}:${item.scope}:${item.name}:${item.location}:${index}`} flexDirection="column" paddingX={1}><Box gap={1}><Text color={agentColor(item.agent)} bold>{item.agent.toUpperCase().padEnd(8)}</Text><Text inverse={index === selectedIndex} bold>{index === selectedIndex ? `› ${item.name}` : `  ${item.name}`}</Text><Text color="gray">{item.scope}</Text></Box><Text color="gray" dimColor>{`  ${item.location}`}</Text></Box>)}</Box>
    <Text color="gray" dimColor>{scope === 'project' ? `项目：${props.projectDirectory}` : '全局资源'}</Text>
    <KeyHints items={['↑↓ 选择', '←→ 范围', ...(canAdd ? ['a 添加 MCP'] : []), '1 全部 2 Claude 3 Codex 4 OpenCode', '- + 翻页', 'Enter 操作', 'r 刷新', 'q 退出']} />
  </Box>;
}

function McpAddScreen({ draft, projectDirectory, homeDirectory, agents }: { readonly draft: McpAddDraft; readonly projectDirectory: string; readonly homeDirectory: string; readonly agents: readonly AgentId[] }): React.JSX.Element {
  const target: McpAddTarget = MCP_ADD_TARGETS[draft.targetIndex].value;
  const steps = target === 'other' ? 6 : 5;
  const projectLabel = target === 'other' ? resolveMcpProjectPath(draft.projectPath, { cwd: projectDirectory, homeDirectory }) : projectDirectory;
  const errorText = draft.error ? <Text color={theme.danger}>{draft.error}</Text> : null;
  if (draft.step === 'target') return <Box flexDirection="column" padding={1} borderStyle="round" borderColor={theme.accent}><Text bold color={theme.accent}>添加 MCP · 1/{steps} 选择范围</Text><Box flexDirection="column" marginTop={1}>{MCP_ADD_TARGETS.map((choice, index) => <Box key={choice.value} flexDirection="column"><Text inverse={index === draft.targetIndex}>{index === draft.targetIndex ? '› ' : '  '}{choice.label}{choice.value === 'current' ? `（${projectDirectory}）` : ''}</Text><Text color="gray" dimColor>{`    ${choice.description}`}</Text></Box>)}</Box>{errorText}<KeyHints items={['↑↓ 选择', 'Enter 继续', 'Esc 取消']} /></Box>;
  if (draft.step === 'projectPath') return <TextInput title={`添加 MCP · 2/${steps} 指定项目目录`} value={draft.projectPath} hint={`目录需已存在，支持 ~ 开头；留空使用当前目录 ${projectDirectory}`} error={errorText} />;
  if (draft.step === 'agent') return <Box flexDirection="column" padding={1} borderStyle="round" borderColor={theme.accent}><Text bold color={theme.accent}>添加 MCP · {target === 'other' ? '3' : '2'}/{steps} 选择 Agent</Text><Text color="gray">{target === 'user' ? '写入全局配置' : `写入项目配置：${projectLabel}`}</Text><Box flexDirection="column" marginTop={1}>{agents.map((agent, index) => <Text key={agent} inverse={index === draft.agentIndex} color={agentColor(agent)}>{index === draft.agentIndex ? '› ' : '  '}{agent.toUpperCase()}</Text>)}</Box>{errorText}<KeyHints items={['↑↓ 选择', 'Enter 继续', 'Esc 上一步']} /></Box>;
  if (draft.step === 'name') return <TextInput title={`添加 MCP · ${target === 'other' ? '4' : '3'}/${steps} MCP 名称`} value={draft.name} hint={agents[draft.agentIndex] ? mcpNameHint(agents[draft.agentIndex]!) : ''} error={errorText} />;
  if (draft.step === 'configuration') return <TextInput title={`添加 MCP · ${target === 'other' ? '5' : '4'}/${steps} MCP 配置`} value={draft.configuration} hint={agents[draft.agentIndex] ? mcpConfigurationHint(agents[draft.agentIndex]!) : ''} error={errorText} />;
  return <Box flexDirection="column" padding={1} borderStyle="double" borderColor={theme.accent}><Text bold color={theme.accent}>添加 MCP · 确认</Text><Text>范围：{target === 'user' ? '全局' : `项目 · ${projectLabel}`}</Text><Text>Agent：{agents[draft.agentIndex]?.toUpperCase() || '—'}</Text><Text>名称：{draft.name.trim()}</Text><Text>配置：{draft.configuration.trim()}</Text><KeyHints items={['y / Enter 确认', 'n 取消', 'Esc 上一步']} /></Box>;
}

function TextInput({ title, value, hint, error }: { readonly title: string; readonly value: string; readonly hint: string; readonly error?: React.ReactNode }): React.JSX.Element {
  return <Box flexDirection="column" padding={1} borderStyle="round" borderColor={theme.accent}><Text bold color={theme.accent}>{title}</Text><Box><Text color="gray">输入： </Text><Text>{value || ' '}</Text><Text color={theme.accent}>▍</Text></Box><Text color="gray" dimColor>{hint}</Text>{error}<KeyHints items={['Enter 继续', 'Esc 上一步']} /></Box>;
}

function clampIndex(index: number, length: number): number { return Math.max(0, Math.min(Math.max(0, length - 1), index)); }
function actionLabel(action: ResourceAction): string { return action === 'copy' ? '复制到其他 Agent' : action === 'remove' ? '卸载' : action === 'enable' ? '启用' : '禁用'; }
function confirmationLabel(action: PendingAction, label: string): string { return action.action === 'copy' ? `确认复制 ${label} 到 ${action.target?.toUpperCase()}` : `确认${actionLabel(action.action)} ${label}`; }
