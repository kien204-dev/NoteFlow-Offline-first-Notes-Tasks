import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { LoginForm } from './LoginForm'
import type { AuthApi } from './authApi'

const authResponse = {
  accessToken: 'access-token',
  user: { id: 'user-1', email: 'ada@example.com' },
}

const authApi = (login: ReturnType<typeof vi.fn>) => ({
  login,
  register: vi.fn(),
  refresh: vi.fn(),
  logout: vi.fn(),
}) as unknown as AuthApi

describe('LoginForm', () => {
  it('submits valid login credentials', async () => {
    const user = userEvent.setup()
    const login = vi.fn().mockResolvedValue(authResponse)
    const onSuccess = vi.fn()

    render(<LoginForm authApi={authApi(login)} onSuccess={onSuccess} />)

    await user.type(screen.getByLabelText('Email'), 'ada@example.com')
    await user.type(screen.getByLabelText('Password'), 'correct-password')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith({
        email: 'ada@example.com',
        password: 'correct-password',
      })
    })
    expect(onSuccess).toHaveBeenCalledWith(authResponse)
    expect(await screen.findByText('Signed in as ada@example.com')).toBeInTheDocument()
  })

  it('shows client-side validation errors', async () => {
    const user = userEvent.setup()
    const login = vi.fn()

    render(<LoginForm authApi={authApi(login)} />)

    await user.type(screen.getByLabelText('Email'), 'not-an-email')
    await user.type(screen.getByLabelText('Password'), 'short')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(screen.getByText('invalid email')).toBeInTheDocument()
    expect(login).not.toHaveBeenCalled()
  })

  it('shows API errors from the backend', async () => {
    const user = userEvent.setup()
    const login = vi.fn().mockRejectedValue(new Error('invalid credentials'))

    render(<LoginForm authApi={authApi(login)} />)

    await user.type(screen.getByLabelText('Email'), 'ada@example.com')
    await user.type(screen.getByLabelText('Password'), 'correct-password')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText('invalid credentials')).toBeInTheDocument()
  })
})
