import type { ReactNode } from 'react'
import { X } from 'lucide-react'

interface BulkActionBarProps {
  count: number
  onClear: () => void
  /** Action buttons (use <Button> instances). */
  children: ReactNode
}

/**
 * Sticky toolbar that floats above the page footer when items are selected.
 * Render unconditionally — it self-hides when `count === 0`.
 */
export function BulkActionBar({ count, onClear, children }: BulkActionBarProps) {
  if (count === 0) return null
  return (
    <div
      role="region"
      aria-label="إجراءات جماعية"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl shadow-xl animate-fade-in-up"
    >
      <button
        type="button"
        onClick={onClear}
        aria-label="إلغاء التحديد"
        className="text-gray-400 hover:text-gray-100 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
      <span className="text-sm text-gray-300">
        <span className="font-mono text-brand-400 font-semibold num">{count.toLocaleString('ar-EG')}</span>{' '}
        محدد
      </span>
      <div className="w-px h-5 bg-gray-700" />
      <div className="flex items-center gap-2">
        {children}
      </div>
    </div>
  )
}
