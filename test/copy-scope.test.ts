import { describe, expect, it } from 'vitest';

import { copyScopeLabel, type CopyScope } from '../src/integrations/ui/copy-scope.js';

describe('资源复制范围', () => {
  it('区分当前目录和全局复制', () => {
    const scopes: CopyScope[] = ['project', 'user'];
    expect(scopes.map(copyScopeLabel)).toEqual(['当前目录', '全局']);
  });
});
