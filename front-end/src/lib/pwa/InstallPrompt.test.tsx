import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { InstallPrompt } from './InstallPrompt'

beforeEach(() => {
  window.localStorage.clear()
})

describe('InstallPrompt', () => {
  it('shows the install action after beforeinstallprompt and calls prompt', async () => {
    const user = userEvent.setup()
    const prompt = vi.fn().mockResolvedValue(undefined)
    const event = new Event('beforeinstallprompt') as Event & {
      prompt: () => Promise<void>
      userChoice: Promise<{ outcome: 'accepted'; platform: string }>
    }
    event.prompt = prompt
    event.userChoice = Promise.resolve({ outcome: 'accepted', platform: 'web' })
    event.preventDefault = vi.fn()

    render(<InstallPrompt />)
    window.dispatchEvent(event)

    await user.click(await screen.findByRole('button', { name: 'Cài đặt NoteFlow' }))

    expect(event.preventDefault).toHaveBeenCalled()
    expect(prompt).toHaveBeenCalled()
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Cài đặt NoteFlow' })).not.toBeInTheDocument()
    })
  })

  it('hides permanently after appinstalled', async () => {
    render(<InstallPrompt />)

    window.dispatchEvent(new Event('appinstalled'))

    await waitFor(() => {
      expect(window.localStorage.getItem('noteflow:pwa-installed')).toBe('true')
    })
  })
})
