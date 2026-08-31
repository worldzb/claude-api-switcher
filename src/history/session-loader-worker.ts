import { parentPort } from 'node:worker_threads';

import { AgentRegistry } from '../agents/registry.js';

const port = parentPort;
if (!port) {
  throw new Error('历史扫描 Worker 必须在 worker_threads 中运行。');
}

const homeDirectory = process.env.HOME || process.env.USERPROFILE;
if (!homeDirectory) {
  throw new Error('无法确定用户主目录。');
}

try {
  const registry = new AgentRegistry(homeDirectory);
  const sessions = registry.all().flatMap((adapter) => {
    port.postMessage({ type: 'progress', message: `正在扫描 ${adapter.name} 的本地记录…` });
    const result = adapter.listSessions();
    port.postMessage({ type: 'progress', message: `${adapter.name} 扫描完成，找到 ${result.length} 条会话。` });
    return result;
  });
  port.postMessage({ type: 'complete', sessions });
} catch (error) {
  port.postMessage({ type: 'error', message: error instanceof Error ? error.message : '历史扫描失败。' });
}
