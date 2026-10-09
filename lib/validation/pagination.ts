import { z } from "zod";

export const MAX_PAGE_SIZE = 100;

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(20),
});

export type Pagination = z.infer<typeof paginationSchema>;

export type Paginated<T> = {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export function skipFor({ page, limit }: Pagination): number {
  return (page - 1) * limit;
}

export function paginated<T>(items: T[], total: number, { page, limit }: Pagination): Paginated<T> {
  return { items, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}
