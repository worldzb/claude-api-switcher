const CHROME_ROWS = 10;
const SESSION_ROWS = 2;

export function calculateVisibleSessionCount(rows: number): number {
  return Math.max(1, Math.floor((rows - CHROME_ROWS) / SESSION_ROWS));
}

export function getViewport({
  itemCount,
  selectedIndex,
  visibleCount,
}: {
  readonly itemCount: number;
  readonly selectedIndex: number;
  readonly visibleCount: number;
}): { readonly start: number; readonly end: number } {
  if (itemCount <= visibleCount) {
    return { start: 0, end: itemCount };
  }
  const maxStart = itemCount - visibleCount;
  const start = Math.max(0, Math.min(selectedIndex - Math.floor(visibleCount / 2), maxStart));
  return { start, end: start + visibleCount };
}
