import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../lib/db/schema'
import * as notesRepo from '../../lib/db/notesRepo'
import { UndoToast, UNDO_TOAST_MS } from './UndoToast'
import { useUndoToastStore } from './undoToastStore'

beforeEach(async () => {
  await db.notes.clear()
  useUndoToastStore.getState().clearUndo()
})

afterEach(async () => {
  vi.useRealTimers()
  await db.notes.clear()
  useUndoToastStore.getState().clearUndo()
})

describe('UndoToast', () => {
  it('restores a trashed note when Undo is clicked', async () => {
    const user = userEvent.setup()
    const note = await notesRepo.create({ title: 'Undo me', content: '' })
    await notesRepo.trash(note.id)

    render(<UndoToast />)
    act(() => {
      useUndoToastStore.getState().showUndo({ id: note.id, entity: 'note', title: note.title })
    })

    expect(await screen.findByRole('status')).toHaveTextContent('Moved note')
    await user.click(screen.getByRole('button', { name: 'Undo' }))

    await waitFor(async () => {
      expect((await notesRepo.getById(note.id))?.trashedAt).toBeNull()
    })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('clears itself after five seconds when not undone', async () => {
    vi.useFakeTimers()
    render(<UndoToast />)

    act(() => {
      useUndoToastStore.getState().showUndo({
        id: 'missing-note',
        entity: 'note',
        title: 'Timed toast',
      })
    })

    expect(screen.getByRole('status')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(UNDO_TOAST_MS)
    })

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
