import { Cloud, CloudOff, RefreshCw, AlertTriangle } from 'lucide-react'
import { useSyncStore } from '@/lib/sync'
import { syncNow } from '@/lib/sync'

export function SyncStatus() {
  const { online, syncing, pending, lastError } = useSyncStore()

  let icon = <Cloud size={14} />
  let label = 'Synced'
  let tone = 'text-muted'

  if (!online) {
    icon = <CloudOff size={14} />
    label = pending > 0 ? `Offline · ${pending} queued` : 'Offline'
    tone = 'text-[var(--color-warn)]'
  } else if (syncing) {
    icon = <RefreshCw size={14} className="animate-spin" />
    label = 'Syncing…'
  } else if (pending > 0) {
    icon = <RefreshCw size={14} />
    label = `${pending} to sync`
    tone = 'text-[var(--color-carbs)]'
  } else if (lastError) {
    icon = <AlertTriangle size={14} />
    label = 'Sync error'
    tone = 'text-[var(--color-warn)]'
  }

  return (
    <button
      onClick={() => void syncNow()}
      title={lastError ?? 'Tap to sync now'}
      className={`inline-flex items-center gap-1.5 text-xs ${tone} hover:opacity-80`}
      aria-label={`Sync status: ${label}. Tap to sync now.`}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}
