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
  } else if (lastError && pending > 0) {
    // Stuck: items queued AND the last flush errored. Surface it (tap to see why).
    icon = <AlertTriangle size={14} />
    label = `${pending} stuck`
    tone = 'text-[var(--color-warn)]'
  } else if (pending > 0) {
    icon = <RefreshCw size={14} />
    label = `${pending} to sync`
    tone = 'text-[var(--color-carbs)]'
  } else if (lastError) {
    icon = <AlertTriangle size={14} />
    label = 'Sync error'
    tone = 'text-[var(--color-warn)]'
  }

  function onTap() {
    // On mobile there's no hover — tapping a stuck/errored chip shows the reason.
    if (lastError && (pending > 0 || !syncing)) {
      // eslint-disable-next-line no-alert
      alert(`Sync issue:\n${lastError}\n\nTap OK to retry.`)
    }
    void syncNow()
  }

  return (
    <button
      onClick={onTap}
      title={lastError ?? 'Tap to sync now'}
      className={`inline-flex items-center gap-1.5 text-xs ${tone} hover:opacity-80`}
      aria-label={`Sync status: ${label}. Tap to sync now.`}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}
