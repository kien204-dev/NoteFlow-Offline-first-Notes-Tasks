import { render, screen } from '@testing-library/react'
import App from './App'

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
  it('renders the NoteFlow scaffold', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: 'NoteFlow' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'New note' })).toBeInTheDocument()
  })
})
