import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { NoteRecord } from '../../lib/db/schema'
import { NoteCard } from './NoteCard'
import { NoteEditor } from './NoteEditor'

const note = (overrides: Partial<NoteRecord> = {}): NoteRecord => ({
  id: 'note-markdown',
  title: 'Markdown note',
  content: '**Bold idea**\n\n- first item\n\n```ts\nconst saved = true\n```',
  tags: ['markdown'],
  createdAt: Date.now(),
  updatedAt: Date.now(),
  deletedAt: null,
  trashedAt: null,
  dirty: true,
  baseVersion: null,
  ...overrides,
})

describe('Markdown note rendering', () => {
  it('renders markdown formatting in the editor preview mode', async () => {
    const user = userEvent.setup()
    const { container } = render(<NoteEditor />)

    await user.type(screen.getByLabelText('Title'), 'Markdown draft')
    await user.type(
      screen.getByLabelText('Content'),
      '**Bold idea**\n\n- first item\n\n```ts\nconst saved = true\n```',
    )
    await user.click(screen.getByRole('button', { name: 'Preview' }))

    expect(screen.getByText('Bold idea').tagName).toBe('STRONG')
    expect(screen.getByText('first item')).toBeInTheDocument()
    expect(container.querySelector('pre code')).toHaveTextContent('const saved = true')
  })

  it('renders markdown in the note card preview without showing raw markers', () => {
    render(<NoteCard note={note()} isSelected={false} onSelect={() => undefined} />)

    expect(screen.getByText('Bold idea').tagName).toBe('STRONG')
    expect(screen.queryByText('**Bold idea**')).not.toBeInTheDocument()
  })
})
