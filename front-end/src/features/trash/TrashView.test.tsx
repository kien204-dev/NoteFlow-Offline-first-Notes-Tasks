import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../lib/db/schema'
import * as notesRepo from '../../lib/db/notesRepo'
import * as tasksRepo from '../../lib/db/tasksRepo'
import { TrashView } from './TrashView'

beforeEach(async () => {
  await db.notes.clear()
  await db.tasks.clear()
})

afterEach(async () => {
  await db.notes.clear()
  await db.tasks.clear()
})

describe('TrashView', () => {
  it('shows trashed notes and tasks and restores them', async () => {
    const user = userEvent.setup()
    const note = await notesRepo.create({ title: 'Trashed note', content: 'Draft' })
    const task = await tasksRepo.create({ title: 'Trashed task' })
    await notesRepo.trash(note.id)
    await tasksRepo.trash(task.id)

    render(<TrashView />)

    expect(await screen.findByText('Trashed note')).toBeInTheDocument()
    expect(await screen.findByText('Trashed task')).toBeInTheDocument()

    const restoreButtons = screen.getAllByRole('button', { name: 'Restore' })
    await user.click(restoreButtons[0])

    await waitFor(async () => {
      expect((await notesRepo.getById(note.id))?.trashedAt).toBeNull()
    })
  })

  it('permanently deletes trashed items using tombstones', async () => {
    const user = userEvent.setup()
    const note = await notesRepo.create({ title: 'Delete forever', content: '' })
    await notesRepo.trash(note.id)

    render(<TrashView />)

    await user.click(await screen.findByRole('button', { name: 'Delete permanently' }))

    await waitFor(async () => {
      const stored = await notesRepo.getById(note.id)
      expect(stored?.deletedAt).toEqual(expect.any(Number))
      expect(stored?.dirty).toBe(true)
    })
  })
})
