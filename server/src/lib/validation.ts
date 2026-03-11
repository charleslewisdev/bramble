import { z } from "zod";

const positiveIntString = (label: string) =>
  z.string().refine((v) => !isNaN(Number(v)) && Number(v) > 0 && Number.isInteger(Number(v)), {
    message: `Invalid ${label}`,
  });

export const idParamSchema = z.object({
  id: positiveIntString("ID"),
});

export const locationIdParamSchema = z.object({
  locationId: positiveIntString("location ID"),
});

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function parsePagination(query: { page?: string; limit?: string }): {
  page: number;
  limit: number;
  offset: number;
} | null {
  if (!query.page && !query.limit) return null;
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 50));
  return { page, limit, offset: (page - 1) * limit };
}

export function paginatedResult<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedResponse<T> {
  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}
