import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export type CardVariant = 'default' | 'elevated' | 'flat' | 'brand'

interface CardProps {
  variant?: CardVariant
  children: ReactNode
  className?: string
}

const variantClasses: Record<CardVariant, string> = {
  default: 'bg-gray-800 shadow-sm border border-gray-700',
  elevated: 'bg-gray-800 shadow-md border border-gray-700',
  flat: 'bg-gray-800 border border-gray-700',
  brand: 'bg-brand-50 border border-brand-200',
}

export function Card({ variant = 'default', children, className }: CardProps) {
  return (
    <div className={cn('rounded-r-xl p-sp-4', variantClasses[variant], className)}>
      {children}
    </div>
  )
}

interface StatCardProps {
  label: string
  value: string | number
  change?: { value: string; positive: boolean }
  accentColor?: string
  icon?: ReactNode
}

export function StatCard({ label, value, change, accentColor = 'bg-brand-500', icon }: StatCardProps) {
  return (
    <div className="bg-gray-800 rounded-r-xl p-4 shadow-sm border border-gray-700 flex flex-col gap-3 relative overflow-hidden">
      <div className={cn('absolute top-0 right-0 w-1 h-full', accentColor)} />
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-gray-500 font-medium">{label}</span>
        {icon && <span className="text-gray-500">{icon}</span>}
      </div>
      <span className="font-mono text-2xl font-bold text-gray-100 num">{value}</span>
      {change && (
        <span className={cn('text-xs', change.positive ? 'text-success-500' : 'text-danger-500')}>
          {change.positive ? '▲' : '▼'} {change.value}
        </span>
      )}
    </div>
  )
}
