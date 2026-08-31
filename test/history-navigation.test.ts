import { describe, expect, it } from 'vitest';

import { getVerticalNavigation } from '../src/history/ui/navigation.js';

describe('历史记录跨页导航', () => {
  it('在当前页第一条向上时跳转上一页末尾', () => {
    expect(getVerticalNavigation({ selectedIndex: 0, itemCount: 20, page: 2, totalPages: 3, direction: 'up' })).toEqual({ page: 1, selectedIndex: 19 });
  });

  it('从不完整末页向上时跳转上一页的实际末尾', () => {
    expect(getVerticalNavigation({ selectedIndex: 0, itemCount: 6, page: 3, totalPages: 3, pageSize: 20, direction: 'up' })).toEqual({ page: 2, selectedIndex: 19 });
  });

  it('在当前页末尾向下时跳转下一页第一条', () => {
    expect(getVerticalNavigation({ selectedIndex: 19, itemCount: 20, page: 2, totalPages: 3, direction: 'down' })).toEqual({ page: 3, selectedIndex: 0 });
  });

  it('在首尾页面保持当前位置', () => {
    expect(getVerticalNavigation({ selectedIndex: 0, itemCount: 20, page: 1, totalPages: 3, direction: 'up' })).toEqual({ page: 1, selectedIndex: 0 });
    expect(getVerticalNavigation({ selectedIndex: 19, itemCount: 20, page: 3, totalPages: 3, direction: 'down' })).toEqual({ page: 3, selectedIndex: 19 });
  });
});
