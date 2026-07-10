import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import * as notesRepo from '../../lib/db/notesRepo'
import { MarkdownPreview } from './MarkdownPreview'
import { useNotesUiStore } from './store'

const splitTags = (value: string) =>
  value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)

export function NoteEditor() {
  const editingNoteId = useNotesUiStore((state) => state.editingNoteId)
  const closeEditor = useNotesUiStore((state) => state.closeEditor)
  const openEditor = useNotesUiStore((state) => state.openEditor)
  const note = useLiveQuery(
    () => (editingNoteId ? notesRepo.getById(editingNoteId) : undefined),
    [editingNoteId],
  )
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [tags, setTags] = useState('')
  const [contentMode, setContentMode] = useState<'write' | 'preview'>('write')

  useEffect(() => {
    setTitle(note?.title ?? '')
    setContent(note?.content ?? '')
    setTags(note?.tags.join(', ') ?? '')
  }, [note])

  const isEditing = Boolean(editingNoteId)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (editingNoteId) {
      await notesRepo.update(editingNoteId, { title, content, tags: splitTags(tags) })
    } else {
      const created = await notesRepo.create({ title, content, tags: splitTags(tags) })
      openEditor(created.id)
    }
  }

  const handleDelete = async () => {
    if (!editingNoteId) return
    await notesRepo.softDelete(editingNoteId)
    closeEditor()
  }

  return (
    <section className="flex h-full min-h-0 flex-col rounded-sm border border-stone-200 bg-paper p-4 shadow-paper dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-200">
            {isEditing ? 'Edit entry' : 'New entry'}
          </p>
          <h2 className="font-serif text-2xl font-semibold text-ink dark:text-stone-50">
            Note editor
          </h2>
        </div>
        <button
          type="button"
          onClick={closeEditor}
          className="rounded-sm border border-stone-300 px-3 py-2 text-sm dark:border-zinc-700"
        >
          Back
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col gap-4">
        <label className="text-sm font-medium text-stone-700 dark:text-zinc-300">
          Title
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="mt-2 w-full rounded-sm border border-stone-300 bg-white px-3 py-2 text-base text-ink outline-none focus:border-ink dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
            placeholder="Meeting notes"
          />
        </label>

        <div className="flex min-h-0 flex-1 flex-col text-sm font-medium text-stone-700 dark:text-zinc-300">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="note-content">Content</label>
            <div
              className="inline-flex rounded-sm border border-stone-300 bg-stone-50 p-0.5 dark:border-zinc-700 dark:bg-zinc-950"
              aria-label="Content mode"
            >
              {(['write', 'preview'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setContentMode(mode)}
                  className={`rounded-sm px-3 py-1 text-xs font-semibold capitalize focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink dark:focus-visible:outline-amber-200 ${
                    contentMode === mode
                      ? 'bg-ink text-paper dark:bg-amber-200 dark:text-zinc-950'
                      : 'text-stone-600 hover:text-ink dark:text-zinc-300 dark:hover:text-stone-50'
                  }`}
                  aria-pressed={contentMode === mode}
                >
                  {mode === 'write' ? 'Write' : 'Preview'}
                </button>
              ))}
            </div>
          </div>
          {contentMode === 'write' ? (
            <textarea
              id="note-content"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              className="mt-2 min-h-52 flex-1 resize-none rounded-sm border border-stone-300 bg-white px-3 py-3 text-sm leading-6 text-ink outline-none focus:border-ink dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
              placeholder="Write freely. Markdown is saved as plain text."
            />
          ) : (
            <div
              className="mt-2 min-h-52 flex-1 overflow-auto rounded-sm border border-stone-300 bg-white px-3 py-3 dark:border-zinc-700 dark:bg-zinc-950"
              aria-label="Content preview"
            >
              <MarkdownPreview content={content} />
            </div>
          )}
        </div>

        <label className="text-sm font-medium text-stone-700 dark:text-zinc-300">
          Tags
          <input
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            className="mt-2 w-full rounded-sm border border-stone-300 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-ink dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
            placeholder="work, ideas"
          />
        </label>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 pt-4 dark:border-zinc-800">
          {isEditing ? (
            <button
              type="button"
              onClick={handleDelete}
              className="rounded-sm border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950"
            >
              Delete
            </button>
          ) : (
            <span />
          )}
          <button
            type="submit"
            className="rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-paper hover:bg-stone-700 dark:bg-amber-200 dark:text-zinc-950"
          >
            Save note
          </button>
        </div>
      </form>
    </section>
  )
}
