import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import * as tasksRepo from '../../lib/db/tasksRepo'
import { useUndoToastStore } from '../trash/undoToastStore'
import { useTasksUiStore } from './store'

const splitTags = (value: string) =>
  value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)

export function TaskForm() {
  const editingTaskId = useTasksUiStore((state) => state.editingTaskId)
  const closeEditor = useTasksUiStore((state) => state.closeEditor)
  const openEditor = useTasksUiStore((state) => state.openEditor)
  const showUndo = useUndoToastStore((state) => state.showUndo)
  const task = useLiveQuery(
    () => (editingTaskId ? tasksRepo.getById(editingTaskId) : undefined),
    [editingTaskId],
  )
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [priority, setPriority] = useState<tasksRepo.TaskPriority>('medium')
  const [completed, setCompleted] = useState(false)
  const [subtasks, setSubtasks] = useState<tasksRepo.TaskSubtask[]>([])
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('')
  const [tags, setTags] = useState('')

  useEffect(() => {
    setTitle(task?.title ?? '')
    setNotes(task?.notes ?? '')
    setDueDate(task?.dueDate ?? '')
    setPriority(task?.priority ?? 'medium')
    setCompleted(task?.completed ?? false)
    setSubtasks(task?.subtasks ?? [])
    setNewSubtaskTitle('')
    setTags(task?.tags.join(', ') ?? '')
  }, [task])

  const isEditing = Boolean(editingTaskId)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const payload = {
      title,
      notes,
      dueDate: dueDate || null,
      priority,
      completed,
      subtasks,
      tags: splitTags(tags),
    }

    if (editingTaskId) {
      await tasksRepo.update(editingTaskId, payload)
    } else {
      const created = await tasksRepo.create(payload)
      openEditor(created.id)
    }
  }

  const handleDelete = async () => {
    if (!editingTaskId || !task) return
    await tasksRepo.trash(editingTaskId)
    showUndo({ id: editingTaskId, entity: 'task', title: task.title })
    closeEditor()
  }

  const addSubtask = () => {
    const title = newSubtaskTitle.trim()
    if (!title) return

    setSubtasks((currentSubtasks) => [
      ...currentSubtasks,
      { id: crypto.randomUUID(), title, completed: false },
    ])
    setNewSubtaskTitle('')
  }

  const toggleSubtask = (id: string, completed: boolean) => {
    setSubtasks((currentSubtasks) =>
      currentSubtasks.map((subtask) =>
        subtask.id === id ? { ...subtask, completed } : subtask,
      ),
    )
  }

  const removeSubtask = (id: string) => {
    setSubtasks((currentSubtasks) => currentSubtasks.filter((subtask) => subtask.id !== id))
  }

  return (
    <section className="flex h-full min-h-0 flex-col rounded-sm border border-stone-200 bg-paper p-4 shadow-paper dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-200">
            {isEditing ? 'Edit task' : 'New task'}
          </p>
          <h2 className="font-serif text-2xl font-semibold text-ink dark:text-stone-50">
            Task form
          </h2>
        </div>
        <button
          type="button"
          onClick={closeEditor}
          className="rounded-sm border border-stone-300 px-3 py-2 text-sm dark:border-zinc-700"
        >
          Back
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col gap-4">
        <label className="text-sm font-medium text-stone-700 dark:text-zinc-300">
          Title
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="mt-2 w-full rounded-sm border border-stone-300 bg-white px-3 py-2 text-base text-ink outline-none focus:border-ink dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
            placeholder="Ship local CRUD"
          />
        </label>

        <label className="text-sm font-medium text-stone-700 dark:text-zinc-300">
          Due date
          <input
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
            className="mt-2 w-full rounded-sm border border-stone-300 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-ink dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          />
        </label>

        <label className="text-sm font-medium text-stone-700 dark:text-zinc-300">
          Priority
          <select
            value={priority}
            onChange={(event) => setPriority(event.target.value as tasksRepo.TaskPriority)}
            className="mt-2 w-full rounded-sm border border-stone-300 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-ink dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </label>

        <label className="flex min-h-0 flex-1 flex-col text-sm font-medium text-stone-700 dark:text-zinc-300">
          Notes
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="mt-2 min-h-36 flex-1 resize-none rounded-sm border border-stone-300 bg-white px-3 py-3 text-sm leading-6 text-ink outline-none focus:border-ink dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
            placeholder="Details, context, or acceptance criteria"
          />
        </label>

        <label className="text-sm font-medium text-stone-700 dark:text-zinc-300">
          Tags
          <input
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            className="mt-2 w-full rounded-sm border border-stone-300 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-ink dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
            placeholder="portfolio, frontend"
          />
        </label>

        <fieldset className="rounded-sm border border-stone-200 p-3 dark:border-zinc-800">
          <legend className="px-1 text-sm font-medium text-stone-700 dark:text-zinc-300">
            Subtasks
          </legend>
          <div className="mt-2 flex gap-2">
            <label className="sr-only" htmlFor="new-subtask-title">
              New subtask title
            </label>
            <input
              id="new-subtask-title"
              value={newSubtaskTitle}
              onChange={(event) => setNewSubtaskTitle(event.target.value)}
              className="min-w-0 flex-1 rounded-sm border border-stone-300 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-ink dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
              placeholder="Add checklist item"
            />
            <button
              type="button"
              onClick={addSubtask}
              className="rounded-sm border border-stone-300 px-3 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink dark:border-zinc-700"
            >
              Add
            </button>
          </div>

          {subtasks.length ? (
            <div className="mt-3 grid gap-2">
              {subtasks.map((subtask) => (
                <div
                  key={subtask.id}
                  className="flex items-center gap-2 rounded-sm border border-stone-200 bg-stone-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950"
                >
                  <input
                    id={`subtask-${subtask.id}`}
                    type="checkbox"
                    checked={subtask.completed}
                    onChange={(event) => toggleSubtask(subtask.id, event.target.checked)}
                    className="h-4 w-4 accent-stone-900"
                  />
                  <label
                    htmlFor={`subtask-${subtask.id}`}
                    className={`min-w-0 flex-1 text-sm ${
                      subtask.completed ? 'line-through decoration-stone-400' : ''
                    }`}
                  >
                    {subtask.title}
                  </label>
                  <button
                    type="button"
                    onClick={() => removeSubtask(subtask.id)}
                    className="rounded-sm border border-red-200 px-2 py-1 text-xs font-medium text-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 dark:border-red-900 dark:text-red-300"
                    aria-label={`Remove subtask ${subtask.title}`}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-stone-500 dark:text-zinc-400">
              No subtasks yet.
            </p>
          )}
        </fieldset>

        <label className="flex items-center gap-2 text-sm font-medium text-stone-700 dark:text-zinc-300">
          <input
            type="checkbox"
            checked={completed}
            onChange={(event) => setCompleted(event.target.checked)}
            className="h-4 w-4 accent-stone-900"
          />
          Completed
        </label>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 pt-4 dark:border-zinc-800">
          {isEditing ? (
            <button
              type="button"
              onClick={handleDelete}
              className="rounded-sm border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950"
            >
              Delete
            </button>
          ) : (
            <span />
          )}
          <button
            type="submit"
            className="rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-paper hover:bg-stone-700 dark:bg-amber-200 dark:text-zinc-950"
          >
            Save task
          </button>
        </div>
      </form>
    </section>
  )
}
