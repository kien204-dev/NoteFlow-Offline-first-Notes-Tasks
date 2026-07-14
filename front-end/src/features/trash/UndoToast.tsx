import { useEffect } from 'react'
import * as notesRepo from '../../lib/db/notesRepo'
import * as tasksRepo from '../../lib/db/tasksRepo'
import { useUndoToastStore } from './undoToastStore'

export const UNDO_TOAST_MS = 5_000

export function UndoToast() {
  const item = useUndoToastStore((state) => state.item)
  const clearUndo = useUndoToastStore((state) => state.clearUndo)

  useEffect(() => {
    if (!item) return undefined

    const timeoutId = window.setTimeout(clearUndo, UNDO_TOAST_MS)
    return () => window.clearTimeout(timeoutId)
  }, [clearUndo, item])

  if (!item) return null

  const handleUndo = async () => {
    if (item.entity === 'note') {
      await notesRepo.restoreFromTrash(item.id)
    } else {
      await tasksRepo.restoreFromTrash(item.id)
    }
    clearUndo()
  }

  return (
    <div
      role="status"
      aria-live="assertive"
      className="fixed bottom-4 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center justify-between gap-3 rounded-sm border border-stone-300 bg-ink px-4 py-3 text-sm text-paper shadow-paper dark:border-zinc-700 dark:bg-amber-200 dark:text-zinc-950"
    >
      <span className="min-w-0">
        Moved {item.entity} <span className="font-semibold">{item.title}</span> to Trash.
      </span>
      <button
        type="button"
        onClick={() => void handleUndo()}
        className="shrink-0 rounded-sm border border-paper/50 px-3 py-1.5 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-paper dark:border-zinc-950/40 dark:focus-visible:outline-zinc-950"
      >
        Undo
      </button>
    </div>
  )
}
