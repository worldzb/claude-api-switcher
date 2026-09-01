#!/usr/bin/env node

import { AgentRegistry } from './agents/registry.js';
import { createProgram } from './cli/create-program.js';
import { ConfigRepository } from './config/config-repository.js';
import { getAppPaths } from './config/paths.js';
import { MigrationService } from './migration/migration-service.js';
import { ManagedSessionRepository } from './sessions/managed-session-repository.js';
import { SessionLauncher } from './sessions/session-launcher.js';
import { printError } from './ui/output.js';

async function main(): Promise<void> {
  const paths = getAppPaths();
  const managedSessions = new ManagedSessionRepository(paths.managedSessionsFile);
  const program = createProgram({
    repository: new ConfigRepository(paths.configFile),
    claudeSettingsFile: paths.claudeSettingsFile,
    environmentFile: paths.environmentFile,
    agents: new AgentRegistry(process.env.HOME || process.env.USERPROFILE || ''),
    managedSessions,
    sessionLauncher: new SessionLauncher(managedSessions, paths.zmaiDirectory),
    migrationService: new MigrationService(paths.migrationDirectory),
    migrationDirectory: paths.migrationDirectory,
  });
  await program.parseAsync();
}

main().catch((error: unknown) => {
  printError(error instanceof Error ? error.message : '发生未知错误。');
  process.exitCode = 1;
});
