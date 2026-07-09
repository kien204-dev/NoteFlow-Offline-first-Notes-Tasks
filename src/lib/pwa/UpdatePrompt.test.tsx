import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { UpdatePrompt } from './UpdatePrompt'

const pwaMock = vi.hoisted(() => ({
  updateServiceWorker: vi.fn(),
  needRefresh: true,
}))

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [pwaMock.needRefresh],
    updateServiceWorker: pwaMock.updateServiceWorker,
  }),
}))

describe('UpdatePrompt', () => {
  it('shows a refresh action and applies the waiting service worker', async () => {
    const user = userEvent.setup()
    render(<UpdatePrompt />)

    expect(screen.getByText('Có bản cập nhật mới')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Tải lại' }))

    expect(pwaMock.updateServiceWorker).toHaveBeenCalledWith(true)
  })
})
