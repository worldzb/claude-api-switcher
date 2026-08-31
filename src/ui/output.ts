import chalk from 'chalk';

export function maskApiKey(key: string): string {
  if (key.length <= 8) {
    return '****';
  }
  return `${key.slice(0, 8)}...${key.slice(-4)}`;
}

export function printError(message: string): void {
  console.error(chalk.red(`错误: ${message}`));
}

export function printSuccess(message: string): void {
  console.log(chalk.green(`✓ ${message}`));
}
