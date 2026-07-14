import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '../../features/auth/authStore'
import { useSyncController } from './useSyncController'

const { close, createSyncEventStream, restart, runSync } = vi.hoisted(() => ({
  close: vi.fn(),
  createSyncEventStream: vi.fn(),
  restart: vi.fn(),
  runSync: vi.fn(async () => ({ pushed: { notes: 0, tasks: 0 } })),
}))

vi.mock('./syncEngine', () => ({ runSync }))
vi.mock('./syncEventStream', () => ({ createSyncEventStream }))

describe('useSyncController', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createSyncEventStream.mockReturnValue({ close, restart })
    useAuthStore.getState().setAuth({
      accessToken: 'access-token',
      user: { id: 'user-1', email: 'user@example.com' },
    })
  })

  it('triggers an immediate pull when the SSE stream reports a change', async () => {
    const { unmount } = renderHook(() => useSyncController())

    await vi.waitFor(() => expect(createSyncEventStream).toHaveBeenCalledTimes(1))
    await vi.waitFor(() => expect(runSync).toHaveBeenCalledTimes(1))
    const options = createSyncEventStream.mock.calls[0][0]
    options.onChange()
    await vi.waitFor(() => expect(runSync).toHaveBeenCalledTimes(2))

    unmount()
    expect(close).toHaveBeenCalledTimes(1)
  })

  it('does not open an SSE stream before authentication', () => {
    useAuthStore.getState().clearAuth()
    renderHook(() => useSyncController())

    expect(createSyncEventStream).not.toHaveBeenCalled()
  })
})
