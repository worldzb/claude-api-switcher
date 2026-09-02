export interface ApiConfig {
  readonly name: string;
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly createdAt?: string;
}

export type AgentId = 'claude' | 'opencode' | 'codex';

export interface CustomModels {
  readonly claude: readonly string[];
  readonly opencode: readonly string[];
  readonly codex: readonly string[];
}

export interface ConfigData {
  readonly configs: readonly ApiConfig[];
  readonly current: string | null;
  readonly customModels: CustomModels;
}

export interface ModelPickerRow {
  readonly model: string;
  readonly label?: string;
  readonly description?: string;
}

export interface ModelPickerSetting {
  readonly options: readonly ModelPickerRow[];
  readonly replaceBuiltInOptions?: boolean;
}

export type ClaudeSettings = Readonly<Record<string, unknown>> & {
  readonly env?: Readonly<Record<string, unknown>>;
  readonly model?: string;
  readonly modelPicker?: ModelPickerSetting;
};
