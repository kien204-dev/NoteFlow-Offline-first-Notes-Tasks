import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../lib/db/schema'
import type { ServerNote } from '../../lib/sync/types'
import { ConflictResolver } from './ConflictResolver'

const actionMocks = vi.hoisted(() => ({
  keepLocalNoteConflict: vi.fn(),
  keepServerNoteConflict: vi.fn(),
  saveMergedNoteConflict: vi.fn(),
}))

vi.mock('../../lib/sync/conflictActions', () => actionMocks)

const note = (overrides: Partial<ServerNote> = {}): ServerNote => ({
  id: '00000000-0000-4000-8000-000000000001',
  title: 'Local note',
  content: 'Local body',
  tags: ['draft'],
  createdAt: new Date(1_000).toISOString(),
  updatedAt: new Date(2_000).toISOString(),
  deletedAt: null,
  baseVersion: null,
  ...overrides,
})

beforeEach(async () => {
  await db.conflicts.clear()
  await db.conflicts.put({
    id: 'note:00000000-0000-4000-8000-000000000001',
    entity: 'note',
    localVersion: note(),
    serverVersion: note({ title: 'Server note', content: 'Server body' }),
    detectedAt: 3_000,
  })
})

afterEach(async () => {
  vi.clearAllMocks()
  await db.conflicts.clear()
})

describe('ConflictResolver', () => {
  it('lets the user keep the local note', async () => {
    const user = userEvent.setup()
    render(<ConflictResolver onClose={vi.fn()} />)

    await user.click(await screen.findByRole('button', { name: 'Giữ bản của tôi' }))

    expect(actionMocks.keepLocalNoteConflict).toHaveBeenCalledWith(
      'note:00000000-0000-4000-8000-000000000001',
    )
  })

  it('lets the user keep the server note', async () => {
    const user = userEvent.setup()
    render(<ConflictResolver onClose={vi.fn()} />)

    await user.click(await screen.findByRole('button', { name: 'Giữ bản trên server' }))

    expect(actionMocks.keepServerNoteConflict).toHaveBeenCalledWith(
      'note:00000000-0000-4000-8000-000000000001',
    )
  })

  it('lets the user save a manual merge', async () => {
    const user = userEvent.setup()
    render(<ConflictResolver onClose={vi.fn()} />)

    await user.click(await screen.findByRole('button', { name: 'Chỉnh sửa thủ công' }))
    await user.clear(screen.getByLabelText('Tiêu đề'))
    await user.type(screen.getByLabelText('Tiêu đề'), 'Merged note')
    await user.click(screen.getByRole('button', { name: 'Lưu bản đã chỉnh' }))

    expect(actionMocks.saveMergedNoteConflict).toHaveBeenCalledWith(
      'note:00000000-0000-4000-8000-000000000001',
      expect.objectContaining({ title: 'Merged note' }),
    )
  })
})
