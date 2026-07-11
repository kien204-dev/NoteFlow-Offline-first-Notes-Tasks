import { describe, expect, it } from 'vitest'
import { matchesSearchText, matchesTags, normalizeTags } from './filterUtils'

type SearchableNote = {
  title: string
  content: string
  tags: string[]
}

const matchesNote = (note: SearchableNote, query: string, tags: string[] = []) =>
  matchesSearchText(query, [note.title, note.content]) && matchesTags(note.tags, tags)

describe('filterUtils search and tags', () => {
  const notes: SearchableNote[] = [
    {
      title: 'Interview prep',
      content: 'Explain IndexedDB and sync conflicts',
      tags: ['career', 'sync'],
    },
    {
      title: 'Home ledger',
      content: 'Coffee, rice, and weekly groceries',
      tags: ['home'],
    },
  ]

  it('matches note titles', () => {
    expect(notes.filter((note) => matchesNote(note, 'interview'))).toEqual([notes[0]])
  })

  it('matches note content', () => {
    expect(notes.filter((note) => matchesNote(note, 'groceries'))).toEqual([notes[1]])
  })

  it('combines search and tag filters', () => {
    expect(notes.filter((note) => matchesNote(note, 'sync', ['career']))).toEqual([notes[0]])
    expect(notes.filter((note) => matchesNote(note, 'sync', ['home']))).toEqual([])
  })

  it('returns no matches when the query is absent from title and content', () => {
    expect(notes.filter((note) => matchesNote(note, 'calendar'))).toEqual([])
  })

  it('normalizes duplicate and blank tags before filtering', () => {
    expect(normalizeTags([' sync ', '', 'career', 'sync'])).toEqual(['career', 'sync'])
  })
})
