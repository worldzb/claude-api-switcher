export const AGENT_IDS = ['claude', 'codex', 'opencode'] as const;

export type AgentId = (typeof AGENT_IDS)[number];

export interface AgentInstallation {
  readonly id: AgentId;
  readonly name: string;
  readonly installed: boolean;
  readonly executable?: string;
  readonly version?: string;
  readonly historyRoot: string;
  readonly capabilities: readonly string[];
}

export interface SessionSummary {
  readonly agent: AgentId;
  readonly id: string;
  readonly title: string;
  readonly cwd: string;
  readonly updatedAt: string;
  readonly sourcePath: string;
}

export interface TranscriptContentText {
  readonly type: 'text';
  readonly text: string;
}

export interface TranscriptContentAsset {
  readonly type: 'image' | 'file';
  readonly path: string;
  readonly mimeType?: string;
}

export type TranscriptContent = TranscriptContentText | TranscriptContentAsset;
export type TranscriptRole = 'user' | 'assistant' | 'tool';

export interface TranscriptMessage {
  readonly role: TranscriptRole;
  readonly content: readonly TranscriptContent[];
}

export interface PortableTranscript {
  readonly source: SessionSummary;
  readonly messages: readonly TranscriptMessage[];
  readonly warnings: readonly string[];
}

export interface HistoryPage {
  readonly items: readonly SessionSummary[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
}

export interface LaunchSpec {
  readonly command: readonly string[];
  readonly cwd: string;
}

export interface IntegrationItem {
  readonly agent: AgentId;
  readonly kind: 'plugin' | 'skill' | 'mcp';
  readonly name: string;
  readonly scope: 'user' | 'project';
  readonly location: string;
  readonly removable: boolean;
  readonly enabled?: boolean;
}

export interface AgentAdapter {
  readonly id: AgentId;
  readonly name: string;
  discover(): AgentInstallation;
  listSessions(): readonly SessionSummary[];
  readTranscript(session: SessionSummary): PortableTranscript;
  createResumeLaunch(session: SessionSummary): LaunchSpec;
  createNewLaunch(input: { readonly cwd: string; readonly prompt?: string; readonly assetDirectory?: string }): LaunchSpec;
  deleteSession(session: SessionSummary): void;
  listIntegrations(project?: string): readonly IntegrationItem[];
  installPlugin(plugin: string, scope: 'user' | 'project'): void;
  installSkill(sourcePath: string, scope: 'user' | 'project', project?: string): void;
  addMcp(name: string, configuration: string, scope: 'user' | 'project', project?: string): void;
  removeIntegration(item: IntegrationItem): void;
  readMcpConfiguration(item: IntegrationItem): string;
  setIntegrationEnabled(item: IntegrationItem, enabled: boolean): void;
}
