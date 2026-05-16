import { ChevronRight, ChevronLeft } from 'lucide-react'
import { Button } from './Button'
import { formatNumber } from '@/lib/format'

interface PaginationProps {
  page: number
  pages: number
  total: number
  limit: number
  onPage: (p: number) => void
}

export function Pagination({ page, pages, total, limit, onPage }: PaginationProps) {
  if (pages <= 1) return null
  const from = (page - 1) * limit + 1
  const to = Math.min(page * limit, total)

  return (
    <nav className="flex items-center justify-between pt-2" aria-label="تصفح الصفحات">
      <span className="text-xs text-gray-500">
        {from}–{to} من {formatNumber(total)}
      </span>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="الصفحة السابقة" className="min-w-[44px] min-h-[44px]">
          <ChevronRight className="w-4 h-4" />
        </Button>
        {Array.from({ length: Math.min(pages, 7) }, (_, i) => {
          let p: number
          if (pages <= 7) {
            p = i + 1
          } else if (page <= 4) {
            p = i + 1
          } else if (page >= pages - 3) {
            p = pages - 6 + i
          } else {
            p = page - 3 + i
          }
          return (
            <Button
              key={p}
              variant={p === page ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => onPage(p)}
              className="min-w-[44px] min-h-[44px]"
              aria-label={`الصفحة ${p}`}
              aria-current={p === page ? 'page' : undefined}
            >
              {p}
            </Button>
          )
        })}
        <Button variant="ghost" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="الصفحة التالية" className="min-w-[44px] min-h-[44px]">
          <ChevronLeft className="w-4 h-4" />
        </Button>
      </div>
    </nav>
  )
}
