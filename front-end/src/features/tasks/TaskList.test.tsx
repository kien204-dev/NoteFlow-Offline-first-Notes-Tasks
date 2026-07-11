import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../lib/db/schema'
import * as tasksRepo from '../../lib/db/tasksRepo'
import { TaskList } from './TaskList'
import { useTasksUiStore } from './store'

beforeEach(async () => {
  await db.tasks.clear()
  useTasksUiStore.setState({
    query: '',
    selectedTags: [],
    status: 'all',
    priority: 'all',
    sortBy: 'updated',
    editingTaskId: null,
    isEditorOpen: false,
  })
})

afterEach(async () => {
  vi.restoreAllMocks()
  await db.tasks.clear()
})

describe('TaskList filters and sorting', () => {
  it('filters visible tasks by priority', async () => {
    const user = userEvent.setup()
    await tasksRepo.create({ title: 'High priority task', priority: 'high' })
    await tasksRepo.create({ title: 'Low priority task', priority: 'low' })

    render(<TaskList />)

    await waitFor(() => {
      expect(screen.getByText('High priority task')).toBeInTheDocument()
      expect(screen.getByText('Low priority task')).toBeInTheDocument()
    })

    await user.selectOptions(screen.getByLabelText('Priority filter'), 'high')

    await waitFor(() => {
      expect(screen.getByText('High priority task')).toBeInTheDocument()
      expect(screen.queryByText('Low priority task')).not.toBeInTheDocument()
    })
  })

  it('sorts tasks by due date', async () => {
    const user = userEvent.setup()
    await tasksRepo.create({
      title: 'Later task',
      dueDate: '2026-07-30',
      priority: 'medium',
    })
    await tasksRepo.create({
      title: 'Soon task',
      dueDate: '2026-07-12',
      priority: 'low',
    })

    const { container } = render(<TaskList />)

    await user.selectOptions(await screen.findByLabelText('Sort tasks'), 'dueDate')

    await waitFor(() => {
      const text = container.textContent ?? ''
      expect(text.indexOf('Soon task')).toBeLessThan(text.indexOf('Later task'))
    })
  })
})
