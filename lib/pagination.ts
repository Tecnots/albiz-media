const ABSOLUTE_MAX = 100;

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
  take: number;
  cursor?: number;
}

export function parsePagination(
  searchParams: URLSearchParams,
  defaultLimit = 20,
  maxLimit = 50
): PaginationParams {
  const cap = Math.min(maxLimit, ABSOLUTE_MAX);
  const rawPage = parseInt(searchParams.get("page") ?? "1");
  const rawLimit = parseInt(searchParams.get("limit") ?? String(defaultLimit));
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, cap) : defaultLimit;
  const cursor = parseInt(searchParams.get("cursor") ?? "0") || 0;
  return { page, limit, skip: (page - 1) * limit, take: limit, cursor };
}

export function paginationHeaders(page: number, limit: number, total: number) {
  const totalPages = Math.ceil(total / limit);
  return {
    "X-Page": String(page),
    "X-Per-Page": String(limit),
    "X-Total": String(total),
    "X-Total-Pages": String(totalPages),
  };
}
