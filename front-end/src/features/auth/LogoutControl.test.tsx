import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as notesRepo from '../../lib/db/notesRepo'
import { createDatabase, type NoteFlowDatabase } from '../../lib/db/schema'
import { LogoutControl } from './LogoutControl'
import { useAuthStore } from './authStore'

let database: NoteFlowDatabase

const authApi = () => ({
  register: vi.fn(),
  login: vi.fn(),
  refresh: vi.fn(),
  logout: vi.fn().mockResolvedValue(new Response(null, { status: 204 })),
})

beforeEach(() => {
  window.history.replaceState({}, '', '/')
  database = createDatabase(`noteflow-logout-test-${crypto.randomUUID()}`)
  useAuthStore.getState().setAuth({
    accessToken: 'access-token',
    user: { id: 'user-1', email: 'ada@example.com' },
  })
})

afterEach(async () => {
  vi.restoreAllMocks()
  useAuthStore.getState().clearAuth()
  database.close()
  await database.delete()
})

describe('LogoutControl', () => {
  it('logs out immediately and clears Dexie when there is no dirty data', async () => {
    const api = authApi()
    const note = await notesRepo.create({ title: 'Synced note', content: '' }, database)
    await database.notes.update(note.id, { dirty: false })

    render(<LogoutControl database={database} authApi={api} />)

    await userEvent.click(screen.getByRole('button', { name: 'Logout' }))

    await waitFor(() => {
      expect(api.logout).toHaveBeenCalled()
      expect(useAuthStore.getState().isAuthenticated).toBe(false)
    })
    expect(await database.notes.count()).toBe(0)
    expect(window.location.pathname).toBe('/login')
  })

  it('asks for confirmation before deleting dirty local data', async () => {
    const api = authApi()
    await notesRepo.create({ title: 'Unsynced note', content: '' }, database)

    render(<LogoutControl database={database} authApi={api} />)

    await userEvent.click(screen.getByRole('button', { name: 'Logout' }))

    expect(await screen.findByRole('dialog', { name: 'Confirm logout' })).toBeInTheDocument()
    expect(api.logout).not.toHaveBeenCalled()
    expect(await database.notes.count()).toBe(1)

    await userEvent.keyboard('{Escape}')

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Confirm logout' })).not.toBeInTheDocument()
    })
    expect(api.logout).not.toHaveBeenCalled()
    expect(await database.notes.count()).toBe(1)

    await userEvent.click(screen.getByRole('button', { name: 'Logout' }))
    expect(await screen.findByRole('dialog', { name: 'Confirm logout' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Logout and delete local data' }))

    await waitFor(() => {
      expect(api.logout).toHaveBeenCalled()
      expect(useAuthStore.getState().isAuthenticated).toBe(false)
    })
    expect(await database.notes.count()).toBe(0)
  })
})
