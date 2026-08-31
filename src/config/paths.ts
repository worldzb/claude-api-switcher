import path from 'node:path';

export interface AppPaths {
  readonly configFile: string;
  readonly environmentFile: string;
  readonly claudeSettingsFile: string;
  readonly zmaiDirectory: string;
  readonly managedSessionsFile: string;
  readonly migrationDirectory: string;
}

export function getAppPaths(homeDirectory = process.env.HOME || process.env.USERPROFILE): AppPaths {
  if (!homeDirectory) {
    throw new Error('无法确定用户主目录。');
  }

  const configDirectory = path.join(homeDirectory, '.claude-switch-config');
  const zmaiDirectory = path.join(homeDirectory, '.zmai');
  return {
    configFile: path.join(configDirectory, 'claude-configs.json'),
    environmentFile: path.join(configDirectory, '.claude-env'),
    claudeSettingsFile: path.join(homeDirectory, '.claude', 'settings.json'),
    zmaiDirectory,
    managedSessionsFile: path.join(zmaiDirectory, 'sessions.json'),
    migrationDirectory: path.join(zmaiDirectory, 'migrations'),
  };
}
