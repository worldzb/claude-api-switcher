import { describe, expect, it } from 'vitest';

import { pageResourceItems } from '../src/integrations/resource-pagination.js';

describe('资源分页', () => {
  it('按固定页大小返回资源并限制页码', () => {
    const items = Array.from({ length: 5 }, (_, index) => ({ name: String(index) }));
    expect(pageResourceItems(items, 2, 2)).toEqual({ items: [items[2], items[3]], page: 2, total: 5, totalPages: 3 });
    expect(pageResourceItems(items, 9, 2).page).toBe(3);
  });
});
