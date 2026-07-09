import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/schema'
import { useSyncStatusStore } from './statusStore'

const minutesAgo = (iso: string | null) => {
  if (!iso) return null
  const diff = Math.max(0, Date.now() - new Date(iso).getTime())
  const minutes = Math.max(0, Math.floor(diff / 60_000))
  return minutes
}

export function SyncStatusBadge({ onOpenConflicts }: { onOpenConflicts?: () => void }) {
  const status = useSyncStatusStore((state) => state.status)
  const lastSyncedAt = useSyncStatusStore((state) => state.lastSyncedAt)
  const conflictCount = useLiveQuery(() => db.conflicts.count(), [], 0)

  if (conflictCount > 0) {
    return (
      <button
        type="button"
        onClick={onOpenConflicts}
        className="rounded-sm border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
      >
        Có {conflictCount} xung đột cần xử lý
      </button>
    )
  }

  if (status === 'syncing') {
    return (
      <div className="flex items-center gap-2 rounded-sm border border-stone-300 bg-paper px-3 py-2 text-xs font-medium text-stone-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
        <span className="stitch-line is-syncing" aria-hidden="true" />
        Đang đồng bộ...
      </div>
    )
  }

  if (status === 'error') {
    return (
      <p className="rounded-sm border border-red-300 bg-red-50 px-3 py-2 text-xs font-medium text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
        Lỗi đồng bộ — sẽ thử lại
      </p>
    )
  }

  if (status === 'offline') {
    return (
      <p className="rounded-sm border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
        Offline — thay đổi đang lưu tạm trên máy
      </p>
    )
  }

  const minutes = minutesAgo(lastSyncedAt)

  return (
    <p className="rounded-sm border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
      {minutes === null ? 'Sẵn sàng đồng bộ' : `Đã đồng bộ · ${minutes} phút trước`}
    </p>
  )
}
