import { useLiveQuery } from 'dexie-react-hooks'
import { ListSkeleton } from '../../components/PanelStates'
import * as notesRepo from '../../lib/db/notesRepo'
import * as tasksRepo from '../../lib/db/tasksRepo'

const formatDate = (timestamp: number | null) =>
  timestamp
    ? new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(timestamp)
    : 'Recently'

export function TrashView() {
  const notes = useLiveQuery(() => notesRepo.listTrashed(), [], undefined)
  const tasks = useLiveQuery(() => tasksRepo.listTrashed(), [], undefined)
  const isLoading = notes === undefined || tasks === undefined
  const trashedNotes = notes ?? []
  const trashedTasks = tasks ?? []
  const hasTrash = trashedNotes.length > 0 || trashedTasks.length > 0

  return (
    <section className="flex h-full min-h-0 flex-col gap-4" aria-label="Trash">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-200">
          Local trash
        </p>
        <h2 className="font-serif text-2xl font-semibold text-ink dark:text-stone-50">
          Trash
        </h2>
        <p className="mt-1 text-sm leading-6 text-stone-600 dark:text-zinc-400">
          Items stay here until you restore them or delete them permanently.
        </p>
      </div>

      <div className="grid min-h-0 gap-3 overflow-y-auto pr-1">
        {isLoading ? (
          <ListSkeleton label="Loading trash" />
        ) : hasTrash ? (
          <>
            {trashedNotes.map((note) => (
              <article
                key={`note-${note.id}`}
                className="rounded-sm border border-stone-200 bg-paper p-4 shadow-paper dark:border-zinc-800 dark:bg-zinc-900"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-zinc-400">
                  Note · Trashed {formatDate(note.trashedAt)}
                </p>
                <h3 className="mt-1 font-serif text-xl font-semibold text-ink dark:text-stone-50">
                  {note.title}
                </h3>
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-stone-600 dark:text-zinc-300">
                  {note.content || 'No content.'}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void notesRepo.restoreFromTrash(note.id)}
                    className="rounded-sm border border-stone-300 px-3 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink dark:border-zinc-700"
                  >
                    Restore
                  </button>
                  <button
                    type="button"
                    onClick={() => void notesRepo.softDelete(note.id)}
                    className="rounded-sm border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 dark:border-red-900 dark:text-red-300"
                  >
                    Delete permanently
                  </button>
                </div>
              </article>
            ))}

            {trashedTasks.map((task) => (
              <article
                key={`task-${task.id}`}
                className="rounded-sm border border-stone-200 bg-paper p-4 shadow-paper dark:border-zinc-800 dark:bg-zinc-900"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-zinc-400">
                  Task · Trashed {formatDate(task.trashedAt)}
                </p>
                <h3 className="mt-1 font-serif text-xl font-semibold text-ink dark:text-stone-50">
                  {task.title}
                </h3>
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-stone-600 dark:text-zinc-300">
                  {task.notes || 'No notes attached.'}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void tasksRepo.restoreFromTrash(task.id)}
                    className="rounded-sm border border-stone-300 px-3 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink dark:border-zinc-700"
                  >
                    Restore
                  </button>
                  <button
                    type="button"
                    onClick={() => void tasksRepo.softDelete(task.id)}
                    className="rounded-sm border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 dark:border-red-900 dark:text-red-300"
                  >
                    Delete permanently
                  </button>
                </div>
              </article>
            ))}
          </>
        ) : (
          <div className="rounded-sm border border-dashed border-stone-300 bg-paper/80 p-6 text-sm text-stone-600 shadow-paper dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
            <p className="font-serif text-xl font-semibold text-ink dark:text-stone-50">
              Trash is empty
            </p>
            <p className="mt-2 max-w-prose leading-6">
              Deleted notes and tasks will appear here before permanent deletion.
            </p>
          </div>
        )}
      </div>
    </section>
  )
}
