import { useEffect, useId, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button } from './Button'

interface DrawerProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  width?: string
  footer?: ReactNode
}

export function Drawer({ open, onClose, title, children, width = 'w-96', footer }: DrawerProps) {
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 z-modal bg-gray-900/70 backdrop-blur-sm transition-opacity duration-slow',
          open ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={cn(
          'fixed top-0 left-0 z-modal h-full bg-gray-800 border-r border-gray-700 shadow-xl',
          'flex flex-col transition-transform duration-slow',
          width,
          open ? 'translate-x-0' : '-translate-x-full',
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-hidden={!open}
      >
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
            <h2 id={titleId} className="text-lg font-semibold text-gray-100">{title}</h2>
            <Button variant="ghost" size="sm" onClick={onClose} aria-label="إغلاق">
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
        {footer && (
          <div className="px-6 py-4 border-t border-gray-700 flex gap-3">{footer}</div>
        )}
      </div>
    </>
  )
}
