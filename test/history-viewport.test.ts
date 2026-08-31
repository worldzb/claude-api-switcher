import { describe, expect, it } from 'vitest';

import { calculateVisibleSessionCount, getViewport } from '../src/history/ui/viewport.js';

describe('历史记录视口', () => {
  it('根据终端高度限制可见会话数量', () => {
    expect(calculateVisibleSessionCount(24)).toBe(7);
    expect(calculateVisibleSessionCount(8)).toBe(1);
  });

  it('使选中项在可见范围内居中', () => {
    expect(getViewport({ itemCount: 30, selectedIndex: 15, visibleCount: 7 })).toEqual({ start: 12, end: 19 });
  });

  it('在列表边界保持有效范围', () => {
    expect(getViewport({ itemCount: 30, selectedIndex: 0, visibleCount: 7 })).toEqual({ start: 0, end: 7 });
    expect(getViewport({ itemCount: 30, selectedIndex: 29, visibleCount: 7 })).toEqual({ start: 23, end: 30 });
  });
});
