import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type ConflictRecord, type NoteFlowDatabase } from '../../lib/db/schema'
import {
  keepLocalNoteConflict,
  keepServerNoteConflict,
  saveMergedNoteConflict,
} from '../../lib/sync/conflictActions'
import type { ServerNote } from '../../lib/sync/types'

type ConflictResolverProps = {
  onClose: () => void
  database?: NoteFlowDatabase
  conflictsOverride?: ConflictRecord[]
}

const splitTags = (value: string) =>
  value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)

export function ConflictResolver({
  onClose,
  database = db,
  conflictsOverride,
}: ConflictResolverProps) {
  const dialogRef = useRef<HTMLElement | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)
  const previouslyFocusedElement = useRef<HTMLElement | null>(null)
  const liveConflicts = useLiveQuery(
    () => database.conflicts.where('entity').equals('note').sortBy('detectedAt'),
    [database],
    [],
  )
  const conflicts = conflictsOverride ?? liveConflicts
  const [editingConflictId, setEditingConflictId] = useState<string | null>(null)
  const editingConflict = conflicts.find((conflict) => conflict.id === editingConflictId)
  const localNote = editingConflict?.localVersion as ServerNote | undefined
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [tags, setTags] = useState('')

  useEffect(() => {
    if (!localNote) return
    setTitle(localNote.title)
    setContent(localNote.content)
    setTags(localNote.tags.join(', '))
  }, [localNote])

  useEffect(() => {
    previouslyFocusedElement.current = document.activeElement as HTMLElement | null
    closeButtonRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
        return
      }

      if (event.key !== 'Tab' || !dialogRef.current) return

      const focusableElements = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute('disabled'))

      if (!focusableElements.length) return

      const firstElement = focusableElements[0]
      const lastElement = focusableElements[focusableElements.length - 1]

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault()
        lastElement.focus()
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault()
        firstElement.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      previouslyFocusedElement.current?.focus()
    }
  }, [onClose])

  if (!conflicts.length) {
    return (
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="conflict-resolver-title"
        className="rounded-sm border border-stone-200 bg-paper p-5 shadow-paper dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 id="conflict-resolver-title" className="font-serif text-2xl font-semibold">
            No notes need review
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="rounded-sm border px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            Close
          </button>
        </div>
      </section>
    )
  }

  return (
    <section
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="conflict-resolver-title"
      className="rounded-sm border border-amber-300 bg-paper p-5 shadow-paper dark:border-amber-900 dark:bg-zinc-900"
    >
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-200">
            Review needed
          </p>
          <h2 id="conflict-resolver-title" className="font-serif text-2xl font-semibold">
            This note changed somewhere else
          </h2>
        </div>
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          className="rounded-sm border px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          Close
        </button>
      </div>

      <div className="grid gap-4">
        {conflicts.map((conflict) => {
          const localVersion = conflict.localVersion as ServerNote
          const serverVersion = conflict.serverVersion as ServerNote
          const isEditing = editingConflictId === conflict.id

          return (
            <article
              key={conflict.id}
              className="rounded-sm border border-stone-200 p-4 dark:border-zinc-700"
            >
              <h3 className="font-serif text-xl font-semibold">{localVersion.title}</h3>
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                <VersionPanel title="Your version" note={localVersion} />
                <VersionPanel title="Server version" note={serverVersion} />
              </div>

              {isEditing ? (
                <form
                  className="mt-4 grid gap-3 border-t border-stone-200 pt-4 dark:border-zinc-800"
                  onSubmit={async (event) => {
                    event.preventDefault()
                    await saveMergedNoteConflict(conflict.id, {
                      title,
                      content,
                      tags: splitTags(tags),
                    })
                    setEditingConflictId(null)
                  }}
                >
                  <label className="text-sm font-medium">
                    Title
                    <input
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      className="mt-2 w-full rounded-sm border border-stone-300 bg-white px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink dark:border-zinc-700 dark:bg-zinc-950"
                    />
                  </label>
                  <label className="text-sm font-medium">
                    Content
                    <textarea
                      value={content}
                      onChange={(event) => setContent(event.target.value)}
                      className="mt-2 min-h-32 w-full rounded-sm border border-stone-300 bg-white px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink dark:border-zinc-700 dark:bg-zinc-950"
                    />
                  </label>
                  <label className="text-sm font-medium">
                    Tags
                    <input
                      value={tags}
                      onChange={(event) => setTags(event.target.value)}
                      className="mt-2 w-full rounded-sm border border-stone-300 bg-white px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink dark:border-zinc-700 dark:bg-zinc-950"
                    />
                  </label>
                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingConflictId(null)}
                      className="rounded-sm border px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="rounded-sm bg-ink px-3 py-2 text-sm font-semibold text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink dark:bg-amber-200 dark:text-zinc-950"
                    >
                      Save merged version
                    </button>
                  </div>
                </form>
              ) : (
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => keepLocalNoteConflict(conflict.id)}
                    className="rounded-sm bg-ink px-3 py-2 text-sm font-semibold text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink dark:bg-amber-200 dark:text-zinc-950"
                  >
                    Keep my version
                  </button>
                  <button
                    type="button"
                    onClick={() => keepServerNoteConflict(conflict.id)}
                    className="rounded-sm border border-stone-300 px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink dark:border-zinc-700"
                  >
                    Keep server version
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingConflictId(conflict.id)}
                    className="rounded-sm border border-stone-300 px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink dark:border-zinc-700"
                  >
                    Edit manually
                  </button>
                </div>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}

function VersionPanel({ title, note }: { title: string; note: ServerNote }) {
  return (
    <div className="rounded-sm border border-stone-200 bg-stone-50 p-3 dark:border-zinc-700 dark:bg-zinc-950">
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-zinc-400">
        {title}
      </p>
      <h4 className="mt-2 font-serif text-lg font-semibold">{note.title}</h4>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-stone-700 dark:text-zinc-300">
        {note.content || 'No content.'}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {note.tags.map((tag) => (
          <span key={tag} className="rounded-sm border px-2 py-1 text-xs dark:border-zinc-700">
            {tag}
          </span>
        ))}
      </div>
    </div>
  )
}
