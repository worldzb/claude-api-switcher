import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Text, useApp, useInput, useStdout } from 'ink';

import type { AgentId, LaunchSpec, SessionSummary } from '../../agents/types.js';
import { filterSessionsByScope, type SessionScope } from '../session-scope.js';
import { selectSessions, sessionSelectionKey, toggleSessionSelection } from '../session-selection.js';
import { pageSessions, searchSessions } from '../session-service.js';
import { KeyHints } from './key-hints.js';
import { SearchInput } from './search-input.js';
import { SessionDetails } from './session-details.js';
import { SessionList } from './session-list.js';
import { agentColor, theme } from './theme.js';
import { getVerticalNavigation } from './navigation.js';
import { calculateVisibleSessionCount } from './viewport.js';

type Screen = 'list' | 'search' | 'actions' | 'agents' | 'confirm-delete' | 'confirm-bulk-delete' | 'result';
type Operation = 'resume' | 'migrate';
type AgentFilter = 'all' | AgentId;

export interface HistoryActionResult {
  readonly message: string;
  readonly launch?: LaunchSpec;
}

const AGENT_FILTERS: readonly AgentFilter[] = ['all', 'claude', 'codex', 'opencode'];

export interface HistoryAppProps {
  readonly agent?: AgentId;
  readonly pageSize: number;
  readonly currentDirectory: string;
  readonly agents: readonly { readonly id: AgentId; readonly name: string; readonly installed: boolean }[];
  readonly loadSessions: (onProgress: (message: string) => void) => Promise<readonly SessionSummary[]>;
  readonly onResume: (session: SessionSummary, target: AgentId) => Promise<HistoryActionResult>;
  readonly onMigrate: (session: SessionSummary, target: AgentId) => Promise<HistoryActionResult>;
  readonly onDelete: (session: SessionSummary) => Promise<HistoryActionResult>;
  readonly onDeleteMany: (sessions: readonly SessionSummary[]) => Promise<HistoryActionResult>;
  readonly onForegroundLaunch: (spec: LaunchSpec) => void;
  readonly onClearScreen: () => void;
}

export function HistoryApp(props: HistoryAppProps): React.JSX.Element {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const loadSessionsRef = useRef(props.loadSessions);
  const [sessions, setSessions] = useState<readonly SessionSummary[]>([]);
  const [scope, setScope] = useState<SessionScope>('current');
  const [agentFilter, setAgentFilter] = useState<AgentFilter>(props.agent || 'all');
  const [loading, setLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('正在准备历史扫描…');
  const [loadingError, setLoadingError] = useState('');
  const [pageNumber, setPageNumber] = useState(1);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedSessionKeys, setSelectedSessionKeys] = useState<ReadonlySet<string>>(() => new Set());
  const [screen, setScreen] = useState<Screen>('list');
  const [actionIndex, setActionIndex] = useState(0);
  const [agentIndex, setAgentIndex] = useState(0);
  const [operation, setOperation] = useState<Operation>('resume');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');

  const refreshSessions = useCallback(async (): Promise<void> => {
    setLoading(true);
    setLoadingMessage('正在准备历史扫描…');
    setLoadingError('');
    try {
      setSessions(await loadSessionsRef.current(setLoadingMessage));
      setPageNumber(1);
      setSelectedIndex(0);
      setSelectedSessionKeys(new Set());
    } catch (caught) {
      setLoadingError(caught instanceof Error ? caught.message : '加载历史会话失败。');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshSessions();
  }, [refreshSessions]);

  const currentSessions = useMemo(
    () => filterSessionsByScope(sessions, 'current', props.currentDirectory),
    [sessions, props.currentDirectory],
  );
  const scopedSessions = scope === 'current' ? currentSessions : sessions;
  const agentSessions = useMemo(() => agentFilter === 'all'
    ? scopedSessions
    : scopedSessions.filter((session) => session.agent === agentFilter), [scopedSessions, agentFilter]);
  const searchedSessions = useMemo(() => searchSessions(agentSessions, query), [agentSessions, query]);
  const page = useMemo(() => pageSessions(searchedSessions, {
    page: pageNumber,
    pageSize: props.pageSize,
  }), [searchedSessions, pageNumber, props.pageSize]);
  const selected = page.items[Math.min(selectedIndex, Math.max(0, page.items.length - 1))];
  const selectedSessions = useMemo(
    () => sessions.filter((session) => selectedSessionKeys.has(sessionSelectionKey(session))),
    [sessions, selectedSessionKeys],
  );
  const visibleSessionCount = calculateVisibleSessionCount(stdout?.rows || 24);
  const availableAgents = props.agents.filter((agent) => agent.installed);

  const switchScope = (nextScope: SessionScope): void => {
    props.onClearScreen();
    setScreen('list');
    setScope(nextScope);
    setPageNumber(1);
    setSelectedIndex(0);
  };

  const toggleScope = (): void => switchScope(scope === 'current' ? 'all' : 'current');

  const switchPage = (nextPage: number): void => {
    props.onClearScreen();
    setPageNumber(Math.max(1, Math.min(nextPage, page.totalPages)));
    setSelectedIndex(0);
  };

  const switchAgentFilter = (nextFilter: AgentFilter): void => {
    props.onClearScreen();
    setAgentFilter(nextFilter);
    setPageNumber(1);
    setSelectedIndex(0);
  };

  const applySearch = (): void => {
    props.onClearScreen();
    setPageNumber(1);
    setSelectedIndex(0);
    setScreen('list');
  };

  const cycleAgentFilter = (): void => {
    const currentIndex = AGENT_FILTERS.indexOf(agentFilter);
    switchAgentFilter(AGENT_FILTERS[(currentIndex + 1) % AGENT_FILTERS.length]!);
  };

  const run = async (callback: () => Promise<HistoryActionResult>): Promise<void> => {
    setBusy(true);
    setError('');
    try {
      const action = await callback();
      if (action.launch) {
        exit();
        props.onForegroundLaunch(action.launch);
        return;
      }
      setResult(action.message);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '操作失败。');
    } finally {
      setBusy(false);
      setScreen('result');
    }
  };

  useInput((input, key) => {
    if (loading) {
      if (input === 'q' || key.escape) exit();
      return;
    }
    if (busy) return;
    if (screen === 'list') {
      if (input === 'q' || key.escape) return void exit();
      if (input === '/') return setScreen('search');
      if (input === 'r') return void refreshSessions();
      if (input === ' ' && selected) return setSelectedSessionKeys((keys) => toggleSessionSelection(keys, selected));
      if (key.ctrl && input === 'a') return setSelectedSessionKeys(selectSessions(searchedSessions));
      if (input === 'x' && selectedSessions.length) return setScreen('confirm-bulk-delete');
      if (key.tab) return toggleScope();
      if (key.leftArrow) return switchScope('current');
      if (key.rightArrow) return switchScope('all');
      if (input === '1') return switchAgentFilter('all');
      if (input === '2') return switchAgentFilter('claude');
      if (input === '3') return switchAgentFilter('codex');
      if (input === '4') return switchAgentFilter('opencode');
      if (input === 'a') return cycleAgentFilter();
      if ((key.pageUp || (key.ctrl && input === 'u') || input === '[' || input === 'p' || input === '-') && page.page > 1) return switchPage(page.page - 1);
      if ((key.pageDown || (key.ctrl && input === 'd') || input === ']' || input === 'n' || input === '=') && page.page < page.totalPages) return switchPage(page.page + 1);
      if (key.upArrow) {
        const next = getVerticalNavigation({
          selectedIndex,
          itemCount: page.items.length,
          page: page.page,
          totalPages: page.totalPages,
          pageSize: props.pageSize,
          direction: 'up',
        });
        setPageNumber(next.page);
        return setSelectedIndex(next.selectedIndex);
      }
      if (key.downArrow) {
        const next = getVerticalNavigation({
          selectedIndex,
          itemCount: page.items.length,
          page: page.page,
          totalPages: page.totalPages,
          direction: 'down',
        });
        setPageNumber(next.page);
        return setSelectedIndex(next.selectedIndex);
      }
      if (key.return && selected) {
        setActionIndex(0);
        return setScreen('actions');
      }
      return;
    }
    if (screen === 'search') return;
    if (screen === 'actions') {
      if (key.escape || input === 'b') return setScreen('list');
      if (key.upArrow) return setActionIndex((index) => Math.max(0, index - 1));
      if (key.downArrow) return setActionIndex((index) => Math.min(2, index + 1));
      if (!key.return || !selected) return;
      if (actionIndex === 2) return setScreen('confirm-delete');
      setOperation(actionIndex === 0 ? 'resume' : 'migrate');
      setAgentIndex(Math.max(0, availableAgents.findIndex((agent) => agent.id === selected.agent)));
      return setScreen('agents');
    }
    if (screen === 'agents') {
      if (key.escape || input === 'b') return setScreen('actions');
      if (key.upArrow) return setAgentIndex((index) => Math.max(0, index - 1));
      if (key.downArrow) return setAgentIndex((index) => Math.min(availableAgents.length - 1, index + 1));
      if (!key.return || !selected || !availableAgents[agentIndex]) return;
      const target = availableAgents[agentIndex].id;
      return void run(() => target === selected.agent ? props.onResume(selected, target) : props.onMigrate(selected, target));
    }
    if (screen === 'confirm-delete') {
      if (key.escape || input === 'n') return setScreen('actions');
      if (input === 'y' && selected) return void run(() => props.onDelete(selected));
      return;
    }
    if (screen === 'confirm-bulk-delete') {
      if (key.escape || input === 'n') return setScreen('list');
      if (input === 'y' && selectedSessions.length) return void run(() => props.onDeleteMany(selectedSessions));
      return;
    }
    if (screen === 'result' && (key.return || key.escape || input === 'b')) {
      setScreen('list');
      setError('');
      return void refreshSessions();
    }
  });

  if (loading) return <LoadingScreen message={loadingMessage} />;
  if (loadingError) return <LoadErrorScreen error={loadingError} />;
  if (screen === 'search') return <SearchInput query={query} onChange={setQuery} onSubmit={applySearch} onCancel={() => setScreen('list')} />;
  if (screen === 'confirm-bulk-delete' && selectedSessions.length) return <ConfirmBulkDeleteScreen sessions={selectedSessions} />;
  if (!page.items.length) return <EmptyScreen scope={scope} onAllScope={() => switchScope('all')} />;
  if (screen === 'actions' && selected) return <ActionScreen session={selected} selectedIndex={actionIndex} />;
  if (screen === 'agents' && selected) return <AgentScreen session={selected} operation={operation} agents={availableAgents} selectedIndex={agentIndex} />;
  if (screen === 'confirm-delete' && selected) return <ConfirmDeleteScreen session={selected} />;
  if (screen === 'result') return <ResultScreen message={result} error={error} />;

  return <Box flexDirection="column" paddingX={1}>
    <Box justifyContent="space-between" borderStyle="round" borderColor={theme.accent} paddingX={1}>
      <Text bold color={theme.accent}>ZMAI · 历史会话</Text>
      <Text color="gray">{page.total} 条 · 第 {page.page}/{page.totalPages} 页{selectedSessions.length ? ` · 已选 ${selectedSessions.length}` : ''}{query ? ` · 搜索：${query}` : ''}</Text>
    </Box>
    <Tabs scope={scope} currentCount={currentSessions.length} allCount={sessions.length} />
    <AgentTabs selected={agentFilter} sessions={scopedSessions} />
    <SessionList sessions={page.items} selectedIndex={selectedIndex} selectedSessionKeys={selectedSessionKeys} columns={stdout?.columns || 80} visibleCount={visibleSessionCount} />
    <KeyHints items={['↑↓ 选择（跨页）', 'Space 多选', 'x 批量删除', '/ 搜索', 'Tab / ←→ 范围', '1 全部 2 Claude 3 Codex 4 OpenCode', 'Ctrl+U / Ctrl+D 或 - / = 翻页', 'Enter 操作', 'r 刷新', 'q 退出']} />
  </Box>;
}

function Tabs({ scope, currentCount, allCount }: { readonly scope: SessionScope; readonly currentCount: number; readonly allCount: number }): React.JSX.Element {
  return <Box gap={2} marginTop={1}>
    <Text inverse={scope === 'current'} color={scope === 'current' ? theme.accent : 'gray'}> 1 当前项目 ({currentCount}) </Text>
    <Text inverse={scope === 'all'} color={scope === 'all' ? theme.accent : 'gray'}> 2 全部会话 ({allCount}) </Text>
  </Box>;
}

function AgentTabs({ selected, sessions }: { readonly selected: AgentFilter; readonly sessions: readonly SessionSummary[] }): React.JSX.Element {
  return <Box gap={1} marginTop={1}>
    {AGENT_FILTERS.map((agent) => {
      const count = agent === 'all' ? sessions.length : sessions.filter((session) => session.agent === agent).length;
      const label = agent === 'all' ? '1 全部' : agent === 'claude' ? '2 CLAUDE' : agent === 'codex' ? '3 CODEX' : '4 OPENCODE';
      return <Text key={agent} inverse={selected === agent} color={agent === 'all' ? 'gray' : agentColor(agent)}> {label} ({count}) </Text>;
    })}
  </Box>;
}

function LoadingScreen({ message }: { readonly message: string }): React.JSX.Element {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setFrame((current) => (current + 1) % frames.length), 80);
    return () => clearInterval(timer);
  }, []);

  return <Box flexDirection="column" padding={1} borderStyle="round" borderColor={theme.accent}>
    <Box gap={1}>
      <Text color={theme.accent}>{frames[frame]}</Text>
      <Text bold color={theme.accent}>ZMAI · 正在加载历史会话</Text>
    </Box>
    <Text color="gray">{message}</Text>
    <KeyHints items={['q 退出']} />
  </Box>;
}

function LoadErrorScreen({ error }: { readonly error: string }): React.JSX.Element {
  return <Box flexDirection="column" padding={1} borderStyle="round" borderColor={theme.danger}>
    <Text bold color={theme.danger}>加载历史会话失败</Text>
    <Text>{error}</Text>
    <KeyHints items={['r 重试', 'q 退出']} />
  </Box>;
}

function EmptyScreen({ scope, onAllScope }: { readonly scope: SessionScope; readonly onAllScope: () => void }): React.JSX.Element {
  return <Box flexDirection="column" padding={1}>
    <Text color="yellow">{scope === 'current' ? '当前项目没有历史会话。' : '没有找到会话。'}</Text>
    {scope === 'current' && <Text color="gray">按 → 或 2 切换到“全部会话”。</Text>}
    <KeyHints items={scope === 'current' ? ['→ / 2 全部会话', 'r 刷新', 'q 退出'] : ['← / 1 当前项目', 'r 刷新', 'q 退出']} />
  </Box>;
}

function ActionScreen({ session, selectedIndex }: { readonly session: SessionSummary; readonly selectedIndex: number }): React.JSX.Element {
  const items = [`以 ${session.agent} 续接`, '选择其他 Agent 迁移并继续', '删除会话'];
  return <Box flexDirection="column" padding={1}><Text bold color={theme.accent}>会话操作</Text><SessionDetails session={session} /><Box flexDirection="column" marginTop={1}>{items.map((item, index) => <Text key={item} color={index === 2 ? theme.danger : undefined} inverse={index === selectedIndex}>{index === selectedIndex ? '› ' : '  '}{item}</Text>)}</Box><KeyHints items={['↑↓ 选择', 'Enter 确认', 'Esc 返回']} /></Box>;
}

function AgentScreen({ session, operation, agents, selectedIndex }: { readonly session: SessionSummary; readonly operation: Operation; readonly agents: readonly { readonly id: AgentId; readonly name: string }[]; readonly selectedIndex: number }): React.JSX.Element {
  return <Box flexDirection="column" padding={1}><Text bold color={theme.accent}>{operation === 'resume' ? '选择继续会话的 Agent' : '选择迁移目标 Agent'}</Text><Text color="gray">原会话：{session.agent} · 默认选择原 Agent</Text><Box flexDirection="column" marginTop={1}>{agents.map((agent, index) => <Text key={agent.id} color={agentColor(agent.id)} inverse={index === selectedIndex}>{index === selectedIndex ? '› ' : '  '}{agent.name}{agent.id === session.agent ? '（原 Agent）' : ''}</Text>)}</Box><KeyHints items={['↑↓ 选择', 'Enter 确认', 'Esc 返回']} /></Box>;
}

function ConfirmDeleteScreen({ session }: { readonly session: SessionSummary }): React.JSX.Element {
  return <Box flexDirection="column" padding={1} borderStyle="double" borderColor={theme.danger}><Text bold color={theme.danger}>永久删除会话？</Text><Text>{session.title}</Text><Text color="gray">{session.agent} · {session.id}</Text><KeyHints items={['y 确认删除', 'n / Esc 取消']} /></Box>;
}

function ConfirmBulkDeleteScreen({ sessions }: { readonly sessions: readonly SessionSummary[] }): React.JSX.Element {
  const preview = sessions.slice(0, 5);
  const remaining = sessions.length - preview.length;
  return <Box flexDirection="column" padding={1} borderStyle="double" borderColor={theme.danger}>
    <Text bold color={theme.danger}>永久删除已选的 {sessions.length} 个会话？</Text>
    <Box flexDirection="column" marginTop={1}>
      {preview.map((session) => <Text key={sessionSelectionKey(session)}>{session.agent} · {session.title}</Text>)}
      {remaining > 0 && <Text color="gray">… 以及另外 {remaining} 个会话</Text>}
    </Box>
    <KeyHints items={['y 确认删除', 'n / Esc 取消']} />
  </Box>;
}

function ResultScreen({ message, error }: { readonly message: string; readonly error: string }): React.JSX.Element {
  const isError = Boolean(error);
  return <Box flexDirection="column" padding={1} borderStyle="round" borderColor={isError ? theme.danger : theme.success}><Text bold color={isError ? theme.danger : theme.success}>{isError ? '操作失败' : '操作完成'}</Text><Text>{isError ? error : message}</Text><KeyHints items={['Enter 返回并刷新']} /></Box>;
}
