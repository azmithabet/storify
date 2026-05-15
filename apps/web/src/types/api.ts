/**
 * Shared API response shapes used across multiple pages.
 *
 * Entity-specific types (Customer, Product, Invoice, …) intentionally stay
 * co-located with their pages because each list/detail view requests a
 * different subset of fields. This file is for shapes that are genuinely
 * uniform across consumers.
 */

/**
 * Cursor-less pagination envelope returned by every list endpoint.
 *
 * Server response shape:
 * `{ success: true, data: T[], meta: PaginationMeta }`
 */
export interface PaginationMeta {
  total: number
  page: number
  limit: number
  pages: number
}
