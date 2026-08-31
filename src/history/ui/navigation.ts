export function getVerticalNavigation({
  selectedIndex,
  itemCount,
  page,
  totalPages,
  pageSize,
  direction,
}: {
  readonly selectedIndex: number;
  readonly itemCount: number;
  readonly page: number;
  readonly totalPages: number;
  readonly pageSize?: number;
  readonly direction: 'up' | 'down';
}): { readonly page: number; readonly selectedIndex: number } {
  const previousPageLastIndex = Math.max(0, (pageSize ?? itemCount) - 1);
  if (direction === 'up') {
    if (selectedIndex > 0) return { page, selectedIndex: selectedIndex - 1 };
    return page > 1 ? { page: page - 1, selectedIndex: previousPageLastIndex } : { page, selectedIndex };
  }
  if (selectedIndex < itemCount - 1) return { page, selectedIndex: selectedIndex + 1 };
  return page < totalPages ? { page: page + 1, selectedIndex: 0 } : { page, selectedIndex };
}
