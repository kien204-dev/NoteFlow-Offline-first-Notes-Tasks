import { NoteCard } from './NoteCard'
import { useNotesUiStore, useNotesView } from './store'

export function NoteList() {
  const { notes, tags, query, selectedTags } = useNotesView()
  const setQuery = useNotesUiStore((state) => state.setQuery)
  const toggleTag = useNotesUiStore((state) => state.toggleTag)
  const clearTags = useNotesUiStore((state) => state.clearTags)
  const editingNoteId = useNotesUiStore((state) => state.editingNoteId)
  const openEditor = useNotesUiStore((state) => state.openEditor)

  return (
    <section className="flex h-full min-h-0 flex-col gap-4" aria-label="Notes">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-serif text-2xl font-semibold text-ink dark:text-stone-50">
            Notes
          </h2>
          <button
            type="button"
            onClick={() => openEditor(null)}
            className="rounded-sm bg-ink px-3 py-2 text-sm font-semibold text-paper transition hover:bg-stone-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink dark:bg-amber-200 dark:text-zinc-950"
          >
            New note
          </button>
        </div>

        <label className="text-sm font-medium text-stone-700 dark:text-zinc-300">
          Search notes
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="mt-2 w-full rounded-sm border border-stone-300 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-ink dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            placeholder="Title or content"
          />
        </label>

        {tags.length ? (
          <div className="flex flex-wrap gap-2" aria-label="Note tag filters">
            {tags.map((tag) => (
              <button
                type="button"
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`rounded-sm border px-2.5 py-1 text-xs font-medium ${
                  selectedTags.includes(tag)
                    ? 'border-ink bg-ink text-paper dark:border-amber-200 dark:bg-amber-200 dark:text-zinc-950'
                    : 'border-stone-300 bg-paper text-stone-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300'
                }`}
              >
                {tag}
              </button>
            ))}
            {selectedTags.length ? (
              <button type="button" onClick={clearTags} className="text-xs text-stone-500 underline">
                Clear
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="grid min-h-0 gap-3 overflow-y-auto pr-1">
        {notes.length ? (
          notes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              isSelected={editingNoteId === note.id}
              onSelect={openEditor}
            />
          ))
        ) : (
          <div className="rounded-sm border border-dashed border-stone-300 bg-paper/70 p-6 text-sm text-stone-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
            No notes match this view.
          </div>
        )}
      </div>
    </section>
  )
}
