import type { NoteRecord } from '../../lib/db/schema'
import { MarkdownPreview } from './MarkdownPreview'

type NoteCardProps = {
  note: NoteRecord
  isSelected: boolean
  onSelect: (id: string) => void
  searchQuery?: string
}

const formatDate = (timestamp: number) =>
  new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(timestamp)

const splitForHighlight = (text: string, query = '') => {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return [{ text, matches: false }]

  const parts: Array<{ text: string; matches: boolean }> = []
  let cursor = 0
  const lowerText = text.toLowerCase()
  let matchIndex = lowerText.indexOf(normalizedQuery)

  while (matchIndex >= 0) {
    if (matchIndex > cursor) {
      parts.push({ text: text.slice(cursor, matchIndex), matches: false })
    }
    parts.push({
      text: text.slice(matchIndex, matchIndex + normalizedQuery.length),
      matches: true,
    })
    cursor = matchIndex + normalizedQuery.length
    matchIndex = lowerText.indexOf(normalizedQuery, cursor)
  }

  if (cursor < text.length) {
    parts.push({ text: text.slice(cursor), matches: false })
  }

  return parts.length ? parts : [{ text, matches: false }]
}

function HighlightedText({ text, query }: { text: string; query?: string }) {
  return (
    <>
      {splitForHighlight(text, query).map((part, index) =>
        part.matches ? (
          <mark
            key={`${part.text}-${index}`}
            className="bg-amber-200 px-0.5 font-semibold text-ink dark:bg-amber-300 dark:text-zinc-950"
          >
            {part.text}
          </mark>
        ) : (
          <span key={`${part.text}-${index}`}>{part.text}</span>
        ),
      )}
    </>
  )
}

const createContentSnippet = (content: string, query = '') => {
  const normalizedQuery = query.trim().toLowerCase()
  const compactContent = content.replace(/\s+/g, ' ').trim()
  if (!normalizedQuery) return compactContent

  const matchIndex = compactContent.toLowerCase().indexOf(normalizedQuery)
  if (matchIndex < 0) return compactContent.slice(0, 160)

  const start = Math.max(0, matchIndex - 48)
  const end = Math.min(compactContent.length, matchIndex + normalizedQuery.length + 96)
  return `${start > 0 ? '...' : ''}${compactContent.slice(start, end)}${
    end < compactContent.length ? '...' : ''
  }`
}

export function NoteCard({ note, isSelected, onSelect, searchQuery = '' }: NoteCardProps) {
  const isSearching = searchQuery.trim().length > 0
  const contentSnippet = createContentSnippet(note.content, searchQuery)

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
          <HighlightedText text={note.title} query={searchQuery} />
        </h3>
        <div className="mt-2 max-h-[4.5rem] overflow-hidden">
          {isSearching ? (
            <p className="text-sm leading-6 text-stone-600 dark:text-zinc-300">
              <HighlightedText text={contentSnippet || 'No content yet.'} query={searchQuery} />
            </p>
          ) : (
            <MarkdownPreview content={note.content} compact />
          )}
        </div>
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
