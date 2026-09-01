import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Text, useApp, useInput, useStdout } from 'ink';

import type { AgentId, IntegrationItem } from '../../agents/types.js';
import { KeyHints } from '../../history/ui/key-hints.js';
import { agentColor, theme } from '../../history/ui/theme.js';
import { pageResourceItems } from '../resource-pagination.js';

const AGENT_FILTERS: readonly ('all' | AgentId)[] = ['all', 'claude', 'codex', 'opencode'];
type ResourceScope = 'project' | 'user';
const RESOURCE_SCOPES: readonly ResourceScope[] = ['project', 'user'];
type ResourceAction = 'copy' | 'remove' | 'enable' | 'disable';

export interface ResourceAppProps {
  readonly kind: IntegrationItem['kind'];
  readonly label: string;
  readonly items: readonly IntegrationItem[];
  readonly projectDirectory: string;
  readonly onRefresh: () => Promise<readonly IntegrationItem[]>;
  readonly onCopy: (item: IntegrationItem, target: AgentId, scope: ResourceScope) => Promise<string>;
  readonly onRemove: (item: IntegrationItem) => Promise<string>;
  readonly onSetEnabled: (item: IntegrationItem, enabled: boolean) => Promise<string>;
  readonly onClearScreen: () => void;
}

interface PendingAction { readonly action: ResourceAction; readonly target?: AgentId }

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
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

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
      if (key.leftArrow || input === '[D') return setTargetScope('project');
      if (key.rightArrow || input === '[C') return setTargetScope('user');
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
    if (key.leftArrow || input === '[D') return changeScope('project');
    if (key.rightArrow || input === '[C') return changeScope('user');
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

  if (loading) return <Box flexDirection="column" padding={1} borderStyle="round" borderColor={theme.accent}><Box gap={1}><Text color={theme.accent}>{frames[loadingFrame]}</Text><Text bold color={theme.accent}>ZMAI · 正在加载 {props.label}</Text></Box><Text color="gray">{loadingMessage}</Text><KeyHints items={['q 退出']} /></Box>;
  if (loadingError) return <Box flexDirection="column" padding={1} borderStyle="round" borderColor={theme.danger}><Text bold color={theme.danger}>{props.label} 加载失败</Text><Text>{loadingError}</Text><KeyHints items={['r 重试', 'q 退出']} /></Box>;
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
    <KeyHints items={['↑↓ 选择', '←→ 范围', '1 全部 2 Claude 3 Codex 4 OpenCode', '- + 翻页', 'Enter 操作', 'r 刷新', 'q 退出']} />
  </Box>;
}

function actionLabel(action: ResourceAction): string { return action === 'copy' ? '复制到其他 Agent' : action === 'remove' ? '卸载' : action === 'enable' ? '启用' : '禁用'; }
function confirmationLabel(action: PendingAction, label: string): string { return action.action === 'copy' ? `确认复制 ${label} 到 ${action.target?.toUpperCase()}` : `确认${actionLabel(action.action)} ${label}`; }
