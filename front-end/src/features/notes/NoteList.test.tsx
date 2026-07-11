import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../lib/db/schema'
import * as notesRepo from '../../lib/db/notesRepo'
import { NoteEditor } from './NoteEditor'
import { NoteList } from './NoteList'
import { useNotesUiStore } from './store'

beforeEach(async () => {
  await db.notes.clear()
  await db.tasks.clear()
  useNotesUiStore.setState({
    query: '',
    selectedTags: [],
    editingNoteId: null,
    isEditorOpen: false,
  })
})

afterEach(async () => {
  vi.useRealTimers()
  await db.notes.clear()
  await db.tasks.clear()
})

describe('NoteList', () => {
  it('shows a newly created note through the live IndexedDB query', async () => {
    const user = userEvent.setup()
    render(
      <div>
        <NoteList />
        <NoteEditor />
      </div>,
    )

    await user.click(screen.getByRole('button', { name: 'New note' }))
    await user.type(screen.getByLabelText('Title'), 'Local-first draft')
    await user.type(screen.getByLabelText('Content'), 'This note is written to IndexedDB.')
    await user.type(screen.getByLabelText('Tags'), 'portfolio, dexie')
    await user.click(screen.getByRole('button', { name: 'Save note' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Open note Local-first draft' })).toBeInTheDocument()
    })
  })

  it('debounces search, combines with IndexedDB results, and highlights matches', async () => {
    await notesRepo.create({
      title: 'Dexie sync notes',
      content: 'Offline data is queried locally first.',
      tags: ['sync'],
    })
    await notesRepo.create({
      title: 'Grocery list',
      content: 'Coffee and rice',
      tags: ['home'],
    })
    const { container } = render(<NoteList />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Open note Dexie sync notes' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Open note Grocery list' })).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText('Search notes'), { target: { value: 'dexie' } })

    expect(screen.getByRole('button', { name: 'Open note Grocery list' })).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Open note Dexie sync notes' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Open note Grocery list' })).not.toBeInTheDocument()
    })
    expect(container.querySelector('mark')?.textContent?.toLowerCase()).toBe('dexie')
    expect(screen.getByText('1 note shown')).toBeInTheDocument()
  })

  it('shows a search-specific empty state when no note matches', async () => {
    await notesRepo.create({
      title: 'Planning',
      content: 'Weekly notes',
      tags: ['work'],
    })
    render(<NoteList />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Open note Planning' })).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText('Search notes'), { target: { value: 'missing' } })

    await waitFor(() => {
      expect(screen.getByText('No notes match your search')).toBeInTheDocument()
    })
  })
})
