import { beforeEach, describe, expect, it } from 'vitest'
import { useAuthStore } from './authStore'

const authResponse = {
  accessToken: 'access-token',
  user: { id: 'user-1', email: 'ada@example.com' },
}

describe('useAuthStore', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    useAuthStore.getState().clearAuth()
  })

  it('sets and clears in-memory auth state', () => {
    useAuthStore.getState().setAuth(authResponse)

    expect(useAuthStore.getState()).toMatchObject({
      accessToken: 'access-token',
      user: authResponse.user,
      isAuthenticated: true,
    })

    useAuthStore.getState().clearAuth()

    expect(useAuthStore.getState()).toMatchObject({
      accessToken: null,
      user: null,
      isAuthenticated: false,
    })
  })

  it('does not persist the access token to browser storage', () => {
    useAuthStore.getState().setAuth(authResponse)

    expect(localStorage.getItem('accessToken')).toBeNull()
    expect(sessionStorage.getItem('accessToken')).toBeNull()
    expect(JSON.stringify(localStorage)).not.toContain('access-token')
    expect(JSON.stringify(sessionStorage)).not.toContain('access-token')
  })
})
