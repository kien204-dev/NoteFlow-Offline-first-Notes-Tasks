import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { RegisterForm } from './RegisterForm'

const authResponse = {
  accessToken: 'access-token',
  user: { id: 'user-1', email: 'ada@example.com' },
}

describe('RegisterForm', () => {
  it('submits valid register credentials', async () => {
    const user = userEvent.setup()
    const register = vi.fn().mockResolvedValue(authResponse)
    const onSuccess = vi.fn()

    render(<RegisterForm authApi={{ register, login: vi.fn() }} onSuccess={onSuccess} />)

    await user.type(screen.getByLabelText('Email'), 'ada@example.com')
    await user.type(screen.getByLabelText('Password'), 'correct-password')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    await waitFor(() => {
      expect(register).toHaveBeenCalledWith({
        email: 'ada@example.com',
        password: 'correct-password',
      })
    })
    expect(onSuccess).toHaveBeenCalledWith(authResponse)
    expect(await screen.findByText('Registered ada@example.com')).toBeInTheDocument()
  })

  it('shows client-side validation errors', async () => {
    const user = userEvent.setup()
    const register = vi.fn()

    render(<RegisterForm authApi={{ register, login: vi.fn() }} />)

    await user.type(screen.getByLabelText('Email'), 'not-an-email')
    await user.type(screen.getByLabelText('Password'), 'short')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(screen.getByText('invalid email')).toBeInTheDocument()
    expect(register).not.toHaveBeenCalled()
  })

  it('shows API errors from the backend', async () => {
    const user = userEvent.setup()
    const register = vi.fn().mockRejectedValue(new Error('email already registered'))

    render(<RegisterForm authApi={{ register, login: vi.fn() }} />)

    await user.type(screen.getByLabelText('Email'), 'ada@example.com')
    await user.type(screen.getByLabelText('Password'), 'correct-password')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByText('email already registered')).toBeInTheDocument()
  })
})
