#!/usr/bin/env node

import { AgentRegistry } from './agents/registry.js';
import { createProgram } from './cli/create-program.js';
import { ConfigRepository } from './config/config-repository.js';
import { getAppPaths } from './config/paths.js';
import { resolveCodexConfigFile } from './codex/config.js';
import { MigrationService } from './migration/migration-service.js';
import { resolveOpenCodeConfigFile } from './opencode/config.js';
import { ManagedSessionRepository } from './sessions/managed-session-repository.js';
import { SessionLauncher } from './sessions/session-launcher.js';
import { printError } from './ui/output.js';

async function main(): Promise<void> {
  const paths = getAppPaths();
  const homeDirectory = process.env.HOME || process.env.USERPROFILE || '';
  const managedSessions = new ManagedSessionRepository(paths.managedSessionsFile);
  const program = createProgram({
    repository: new ConfigRepository(paths.configFile),
    claudeSettingsFile: paths.claudeSettingsFile,
    environmentFile: paths.environmentFile,
    opencodeConfigFile: resolveOpenCodeConfigFile(homeDirectory),
    codexConfigFile: resolveCodexConfigFile(homeDirectory),
    agents: new AgentRegistry(homeDirectory),
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
