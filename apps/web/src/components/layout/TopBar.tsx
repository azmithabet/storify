import { useAuthStore } from '@/stores/auth.store'
import { Badge } from '@/components/ui'

export function TopBar({ title }: { title?: string }) {
  const { tenantSubdomain } = useAuthStore()

  return (
    <header className="h-14 bg-gray-900 border-b border-gray-800 flex items-center px-6 gap-4">
      {title && (
        <h2 className="text-base font-semibold text-gray-100 flex-1">{title}</h2>
      )}
      {!title && <div className="flex-1" />}
      {tenantSubdomain && (
        <Badge variant="brand" dot>
          {tenantSubdomain}
        </Badge>
      )}
    </header>
  )
}
