import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface Column<T> {
  key: string
  header: string
  render?: (row: T) => ReactNode
  className?: string
  headerClassName?: string
}

interface TableProps<T> {
  columns: Column<T>[]
  data: T[]
  keyExtractor: (row: T) => string
  onRowClick?: (row: T) => void
  emptyMessage?: string
  className?: string
}

export function Table<T>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  emptyMessage = 'لا توجد بيانات',
  className,
}: TableProps<T>) {
  return (
    <div className={cn('overflow-x-auto rounded-r-xl border border-gray-700', className)}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-700 bg-gray-900">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  'text-right px-4 py-3 text-xs uppercase tracking-wider text-gray-500 font-medium',
                  col.headerClassName,
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="text-center py-12 text-gray-500">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row) => (
              <tr
                key={keyExtractor(row)}
                onClick={() => onRowClick?.(row)}
                className={cn(
                  'border-b border-gray-700/50 bg-gray-800 hover:bg-gray-700/50 transition-colors duration-fast',
                  onRowClick && 'cursor-pointer',
                )}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn('px-4 py-3 text-gray-300', col.className)}
                  >
                    {col.render
                      ? col.render(row)
                      : String((row as Record<string, unknown>)[col.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
