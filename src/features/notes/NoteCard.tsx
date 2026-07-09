import type { NoteRecord } from '../../lib/db/schema'

type NoteCardProps = {
  note: NoteRecord
  isSelected: boolean
  onSelect: (id: string) => void
}

const formatDate = (timestamp: number) =>
  new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(timestamp)

export function NoteCard({ note, isSelected, onSelect }: NoteCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(note.id)}
      className={`paper-stack relative w-full rounded-sm border bg-paper p-4 text-left shadow-paper transition hover:-translate-y-0.5 hover:shadow-paperHover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink dark:border-zinc-700 dark:bg-zinc-900 ${
        isSelected ? 'border-ink dark:border-amber-200' : 'border-stone-200'
      }`}
      aria-label={`Open note ${note.title}`}
    >
      {note.dirty ? (
        <span
          className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full bg-amber-500"
          aria-label="Pending sync"
          title="Pending sync"
        />
      ) : null}
      <div className="pr-5">
        <h3 className="font-serif text-xl font-semibold leading-tight text-ink dark:text-stone-50">
          {note.title}
        </h3>
        <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-stone-600 dark:text-zinc-300">
          {note.content || 'No content yet.'}
        </p>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-stone-500 dark:text-zinc-400">
        <span>{formatDate(note.updatedAt)}</span>
        {note.tags.map((tag) => (
          <span
            key={tag}
            className="rounded-sm border border-stone-200 bg-stone-50 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-800"
          >
            {tag}
          </span>
        ))}
      </div>
    </button>
  )
}
