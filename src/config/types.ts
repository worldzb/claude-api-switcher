export interface ApiConfig {
  readonly name: string;
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly createdAt?: string;
}

export interface ConfigData {
  readonly configs: readonly ApiConfig[];
  readonly current: string | null;
}

export type ClaudeSettings = Readonly<Record<string, unknown>> & {
  readonly env?: Readonly<Record<string, unknown>>;
};
