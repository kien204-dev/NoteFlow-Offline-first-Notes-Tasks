import { render, screen } from '@testing-library/react'
import App from './App'
import { useAuthStore } from './features/auth/authStore'

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [false],
    updateServiceWorker: vi.fn(),
  }),
}))

vi.mock('./lib/sync/useSyncController', () => ({
  useSyncController: vi.fn(),
}))

describe('App', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/')
    useAuthStore.getState().clearAuth()
  })

  it('redirects unauthenticated users to login', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: 'NoteFlow' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Login' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/login')
  })

  it('renders the workspace for authenticated users', () => {
    useAuthStore.getState().setAuth({
      accessToken: 'access-token',
      user: { id: 'user-1', email: 'ada@example.com' },
    })

    render(<App />)

    expect(screen.getByRole('button', { name: 'New note' })).toBeInTheDocument()
  })

  it('redirects authenticated users away from login', () => {
    window.history.replaceState({}, '', '/login')
    useAuthStore.getState().setAuth({
      accessToken: 'access-token',
      user: { id: 'user-1', email: 'ada@example.com' },
    })

    render(<App />)

    expect(screen.getByRole('button', { name: 'New note' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/')
  })
})
