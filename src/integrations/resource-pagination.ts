export interface ResourcePage<T> {
  readonly items: readonly T[];
  readonly page: number;
  readonly total: number;
  readonly totalPages: number;
}

export function pageResourceItems<T>(items: readonly T[], requestedPage: number, pageSize: number): ResourcePage<T> {
  const safePageSize = Math.max(1, pageSize);
  const totalPages = Math.max(1, Math.ceil(items.length / safePageSize));
  const page = Math.max(1, Math.min(Math.floor(requestedPage) || 1, totalPages));
  return { items: items.slice((page - 1) * safePageSize, page * safePageSize), page, total: items.length, totalPages };
}
