import { cn } from '@/lib/cn'

interface MoneyProps {
  value: number | string
  currency?: string
  className?: string
  size?: 'sm' | 'base' | 'lg' | 'xl'
}

const sizeClasses = {
  sm: 'text-sm',
  base: 'text-base',
  lg: 'text-lg',
  xl: 'text-xl',
}

export function Money({ value, currency = 'ج.م', className, size = 'base' }: MoneyProps) {
  const formatted = typeof value === 'number'
    ? value.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : value

  return (
    <span
      dir="ltr"
      className={cn(
        'inline-block font-mono text-brand-700 tabular-nums',
        sizeClasses[size],
        className,
      )}
    >
      {formatted} {currency}
    </span>
  )
}
