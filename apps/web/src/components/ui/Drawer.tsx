import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
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

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function Drawer({ open, onClose, title, children, width = 'w-96', footer }: DrawerProps) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const prevFocusRef = useRef<HTMLElement | null>(null)

  // Save caller focus → move into drawer → restore on close
  useEffect(() => {
    if (!open) return
    prevFocusRef.current = document.activeElement as HTMLElement
    const panel = panelRef.current
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE)
    ;(first ?? panel)?.focus()
    return () => { prevFocusRef.current?.focus() }
  }, [open])

  // Escape + Tab trap
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key !== 'Tab') return
      const panel = panelRef.current
      if (!panel) return
      const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (nodes.length === 0) return
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      if (e.shiftKey ? document.activeElement === first : document.activeElement === last) {
        e.preventDefault()
        ;(e.shiftKey ? last : first).focus()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  // Portal to <body> so the drawer escapes any `transform`/`filter`/`perspective`
  // ancestor that would otherwise become its containing block. (AppShell's
  // <main> uses `animate-fade-in-up` which is transform-based — without this
  // portal the drawer renders constrained to the main content area.)
  if (typeof document === 'undefined') return null

  return createPortal(
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
        ref={panelRef}
        tabIndex={-1}
        className={cn(
          'fixed top-0 left-0 z-modal h-full bg-gray-800 border-r border-gray-700 shadow-xl',
          'flex flex-col transition-transform duration-slow focus:outline-none',
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
    </>,
    document.body,
  )
}
