import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db, type TaskRecord } from '../../lib/db/schema'
import { TaskForm } from './TaskForm'
import { TaskItem } from './TaskItem'
import { useTasksUiStore } from './store'

beforeEach(async () => {
  await db.tasks.clear()
  useTasksUiStore.setState({
    query: '',
    selectedTags: [],
    status: 'all',
    editingTaskId: null,
    isEditorOpen: false,
  })
})

afterEach(async () => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  await db.tasks.clear()
})

const taskRecord = (overrides: Partial<TaskRecord> = {}): TaskRecord => ({
  id: 'task-1',
  title: 'Review release',
  notes: '',
  dueDate: '2026-07-01',
  priority: 'high',
  completed: false,
  subtasks: [],
  tags: [],
  createdAt: 1_000,
  updatedAt: 1_000,
  deletedAt: null,
  dirty: true,
  baseVersion: null,
  ...overrides,
})

describe('TaskForm and TaskItem task metadata', () => {
  it('creates a task with due date and selected priority', async () => {
    const user = userEvent.setup()
    render(<TaskForm />)

    await user.type(screen.getByLabelText('Title'), 'Ship task metadata')
    await user.type(screen.getByLabelText('Due date'), '2026-07-20')
    await user.selectOptions(screen.getByLabelText('Priority'), 'high')
    await user.click(screen.getByRole('button', { name: 'Save task' }))

    await waitFor(async () => {
      const tasks = await db.tasks.toArray()
      expect(tasks).toMatchObject([
        {
          title: 'Ship task metadata',
          dueDate: '2026-07-20',
          priority: 'high',
        },
      ])
    })
  })

  it('adds, toggles, removes, and saves subtasks', async () => {
    const user = userEvent.setup()
    render(<TaskForm />)

    await user.type(screen.getByLabelText('Title'), 'Ship checklist')
    await user.type(screen.getByLabelText('New subtask title'), 'Write tests')
    await user.click(screen.getByRole('button', { name: 'Add' }))
    await user.type(screen.getByLabelText('New subtask title'), 'Update docs')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    await user.click(screen.getByLabelText('Write tests'))
    await user.click(screen.getByRole('button', { name: 'Remove subtask Update docs' }))
    await user.click(screen.getByRole('button', { name: 'Save task' }))

    await waitFor(async () => {
      const tasks = await db.tasks.toArray()
      expect(tasks[0].subtasks).toEqual([
        expect.objectContaining({ title: 'Write tests', completed: true }),
      ])
    })
  })

  it('shows due date, priority, and overdue badge on task items', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-11T12:00:00.000Z'))

    render(
      <TaskItem
        task={taskRecord({
          subtasks: [
            { id: 'subtask-1', title: 'Draft', completed: true },
            { id: 'subtask-2', title: 'Review', completed: false },
          ],
        })}
        isSelected={false}
        onSelect={vi.fn()}
      />,
    )

    expect(screen.getByText('Overdue · Jul 1')).toBeInTheDocument()
    expect(screen.getByText('High priority')).toBeInTheDocument()
    expect(screen.getByText('1/2 completed')).toBeInTheDocument()
  })
})
