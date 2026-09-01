export type CopyScope = 'project' | 'user';

export function copyScopeLabel(scope: CopyScope): string {
  return scope === 'project' ? '当前目录' : '全局';
}
