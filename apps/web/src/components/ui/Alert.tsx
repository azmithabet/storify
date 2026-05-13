import type { ReactNode } from 'react'
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from 'lucide-react'
import { cn } from '@/lib/cn'

type AlertVariant = 'success' | 'warning' | 'danger' | 'info'

interface AlertProps {
  variant: AlertVariant
  title?: string
  children: ReactNode
  onDismiss?: () => void
  className?: string
}

const config: Record<AlertVariant, { icon: typeof Info; classes: string }> = {
  success: { icon: CheckCircle2, classes: 'bg-success-50 border-success-500 text-success-700' },
  warning: { icon: AlertTriangle, classes: 'bg-warning-50 border-warning-500 text-warning-700' },
  danger: { icon: AlertCircle, classes: 'bg-danger-50 border-danger-500 text-danger-700' },
  info: { icon: Info, classes: 'bg-info-50 border-info-500 text-info-700' },
}

export function Alert({ variant, title, children, onDismiss, className }: AlertProps) {
  const { icon: Icon, classes } = config[variant]
  return (
    <div className={cn('flex gap-3 rounded-r-lg border p-4', classes, className)} role="alert">
      <Icon className="w-5 h-5 shrink-0 mt-0.5" />
      <div className="flex-1 text-sm">
        {title && <p className="font-semibold mb-1">{title}</p>}
        <div>{children}</div>
      </div>
      {onDismiss && (
        <button onClick={onDismiss} className="shrink-0 opacity-60 hover:opacity-100" aria-label="إغلاق">
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}
