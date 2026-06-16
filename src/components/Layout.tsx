import type { ReactNode } from 'react'
import { Outlet } from 'react-router-dom'
import { SyncStatus } from './SyncStatus'
import { BottomNav } from './BottomNav'

export function Layout({ children }: { children?: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-full max-w-xl flex-col">
      <header
        className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface)]/95 px-4 py-3 backdrop-blur"
        style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
      >
        <span className="text-base font-semibold tracking-tight">
          <span className="text-[var(--color-brand)]">●</span> Macros
        </span>
        <SyncStatus />
      </header>

      <main className="flex-1 px-4 py-4">{children ?? <Outlet />}</main>

      <BottomNav />
    </div>
  )
}
