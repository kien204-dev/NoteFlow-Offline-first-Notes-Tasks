import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../lib/db/schema'
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
})
