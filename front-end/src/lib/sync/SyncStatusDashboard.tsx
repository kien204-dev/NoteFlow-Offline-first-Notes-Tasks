import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/schema'
import { useSyncStatusStore } from './statusStore'
import type { SyncConnectionStatus, SyncStatus } from './types'

type SyncStatusDashboardViewProps = {
  status: SyncStatus
  connection: SyncConnectionStatus
  lastSyncedAt: string | null
  error: string | null
  dirtyCount: number
  conflictCount: number
  isOnline: boolean
  onOpenConflicts?: () => void
}

export const formatRelativeSyncTime = (iso: string | null, now = Date.now()) => {
  if (!iso) return 'Not synced yet'
  const minutes = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000))
  if (minutes === 0) return 'Just now'
  if (minutes === 1) return '1 minute ago'
  return `${minutes} minutes ago`
}

const connectionLabel = (connection: SyncConnectionStatus) => {
  if (connection === 'connected') return 'Live via SSE'
  if (connection === 'connecting') return 'Connecting SSE'
  if (connection === 'fallback') return '30s fallback'
  return 'Sync paused'
}

export function SyncStatusDashboardView({
  status,
  connection,
  lastSyncedAt,
  error,
  dirtyCount,
  conflictCount,
  isOnline,
  onOpenConflicts,
}: SyncStatusDashboardViewProps) {
  return (
    <section
      aria-label="Sync status"
      className="grid min-w-0 grid-cols-2 gap-x-5 gap-y-3 border-l-2 border-amber-500 pl-4 text-xs sm:grid-cols-4"
    >
      <div>
        <p className="font-semibold text-stone-500 dark:text-zinc-400">Last sync</p>
        <p className="mt-1 whitespace-nowrap font-medium text-ink dark:text-zinc-100">
          {status === 'syncing' ? 'Syncing now' : formatRelativeSyncTime(lastSyncedAt)}
        </p>
      </div>
      <div>
        <p className="font-semibold text-stone-500 dark:text-zinc-400">Pending</p>
        <p className="mt-1 whitespace-nowrap font-medium text-ink dark:text-zinc-100">
          {dirtyCount} record{dirtyCount === 1 ? '' : 's'}
        </p>
      </div>
      <div>
        <p className="font-semibold text-stone-500 dark:text-zinc-400">Network</p>
        <p className="mt-1 whitespace-nowrap font-medium text-ink dark:text-zinc-100">
          {isOnline ? 'Online' : 'Offline'}
        </p>
      </div>
      <div>
        <p className="font-semibold text-stone-500 dark:text-zinc-400">Connection</p>
        <p className="mt-1 whitespace-nowrap font-medium text-ink dark:text-zinc-100">
          {connectionLabel(connection)}
        </p>
      </div>

      {conflictCount > 0 ? (
        <button
          type="button"
          onClick={onOpenConflicts}
          className="col-span-2 justify-self-start font-semibold text-amber-800 underline decoration-amber-500 underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink dark:text-amber-200 dark:focus-visible:outline-amber-200 sm:col-span-4"
        >
          Review {conflictCount} item{conflictCount === 1 ? '' : 's'}
        </button>
      ) : null}

      {error ? (
        <p
          role="status"
          aria-live="polite"
          className="col-span-2 max-w-[52ch] text-red-700 dark:text-red-300 sm:col-span-4"
        >
          Last sync error: {error}
        </p>
      ) : null}
    </section>
  )
}

export function SyncStatusDashboard({ onOpenConflicts }: { onOpenConflicts?: () => void }) {
  const snapshot = useSyncStatusStore()
  const [isOnline, setIsOnline] = useState(() => navigator.onLine)
  const counts = useLiveQuery(
    async () => {
      const [notes, tasks, conflicts] = await Promise.all([
        db.notes.filter((note) => note.dirty && (!note.trashedAt || note.deletedAt !== null)).count(),
        db.tasks.filter((task) => task.dirty && (!task.trashedAt || task.deletedAt !== null)).count(),
        db.conflicts.count(),
      ])
      return { conflictCount: conflicts, dirtyCount: notes + tasks }
    },
    [],
    { conflictCount: 0, dirtyCount: 0 },
  )

  useEffect(() => {
    const updateNetworkStatus = () => setIsOnline(navigator.onLine)
    window.addEventListener('online', updateNetworkStatus)
    window.addEventListener('offline', updateNetworkStatus)
    return () => {
      window.removeEventListener('online', updateNetworkStatus)
      window.removeEventListener('offline', updateNetworkStatus)
    }
  }, [])

  return (
    <SyncStatusDashboardView
      {...snapshot}
      {...counts}
      isOnline={isOnline}
      onOpenConflicts={onOpenConflicts}
    />
  )
}
