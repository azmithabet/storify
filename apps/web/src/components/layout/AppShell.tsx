import type { ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'

interface AppShellProps {
  children: ReactNode
  title?: string
}

export function AppShell({ children, title }: AppShellProps) {
  return (
    <div className="min-h-screen bg-app">
      <Sidebar />
      <div className="mr-60 flex flex-col min-h-screen">
        <TopBar title={title} />
        <main className="flex-1 p-8 animate-fade-in-up">{children}</main>
      </div>
    </div>
  )
}
