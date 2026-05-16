import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export type BadgeVariant = 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'gray'

interface BadgeProps {
  variant?: BadgeVariant
  children: ReactNode
  dot?: boolean
  icon?: ReactNode
  className?: string
}

const variantClasses: Record<BadgeVariant, string> = {
  brand: 'bg-brand-900/40 text-brand-300',
  success: 'bg-success-700/20 text-success-500',
  warning: 'bg-warning-700/20 text-warning-500',
  danger: 'bg-danger-700/20 text-danger-500',
  info: 'bg-info-700/20 text-info-500',
  gray: 'bg-gray-700/50 text-gray-300',
}

const dotClasses: Record<BadgeVariant, string> = {
  brand: 'bg-brand-500',
  success: 'bg-success-500',
  warning: 'bg-warning-500',
  danger: 'bg-danger-500',
  info: 'bg-info-500',
  gray: 'bg-gray-500',
}

export function Badge({ variant = 'gray', children, dot, icon, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-r-sm px-2 py-0.5 text-xs font-medium',
        variantClasses[variant],
        className,
      )}
    >
      {dot && !icon && (
        <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', dotClasses[variant])} aria-hidden="true" />
      )}
      {icon && <span className="w-3 h-3 shrink-0">{icon}</span>}
      {children}
    </span>
  )
}
