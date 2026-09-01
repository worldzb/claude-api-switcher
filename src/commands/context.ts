import type { AgentRegistry } from '../agents/registry.js';
import type { ConfigRepository } from '../config/config-repository.js';
import type { MigrationService } from '../migration/migration-service.js';
import type { ManagedSessionRepository } from '../sessions/managed-session-repository.js';
import type { SessionLauncher } from '../sessions/session-launcher.js';

export interface CommandContext {
  readonly repository: ConfigRepository;
  readonly claudeSettingsFile: string;
  readonly environmentFile: string;
  readonly agents: AgentRegistry;
  readonly managedSessions: ManagedSessionRepository;
  readonly sessionLauncher: SessionLauncher;
  readonly migrationService: MigrationService;
  readonly migrationDirectory: string;
}
