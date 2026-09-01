import { parentPort, workerData } from 'node:worker_threads';

import { AgentRegistry } from '../agents/registry.js';
import type { AgentId, IntegrationItem } from '../agents/types.js';

interface ResourceWorkerData {
  readonly homeDirectory: string;
  readonly kind: IntegrationItem['kind'];
  readonly project?: string;
  readonly agent?: AgentId;
}

const port = parentPort;
if (!port) throw new Error('资源扫描 Worker 必须在 worker_threads 中运行。');

try {
  const data = workerData as ResourceWorkerData;
  const registry = new AgentRegistry(data.homeDirectory);
  const adapters = data.agent ? [registry.get(data.agent)] : registry.all();
  const items = adapters.flatMap((adapter) => {
    port.postMessage({ type: 'progress', message: `正在扫描 ${adapter.name} 的 ${data.kind}…` });
    const result = adapter.listIntegrations(data.project).filter((item) => item.kind === data.kind);
    port.postMessage({ type: 'progress', message: `${adapter.name} 扫描完成，找到 ${result.length} 项。` });
    return result;
  });
  port.postMessage({ type: 'complete', items });
} catch (error) {
  port.postMessage({ type: 'error', message: error instanceof Error ? error.message : '资源扫描失败。' });
}
