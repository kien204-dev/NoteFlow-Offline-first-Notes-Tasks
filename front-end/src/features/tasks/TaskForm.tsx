import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import * as tasksRepo from '../../lib/db/tasksRepo'
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
  const task = useLiveQuery(
    () => (editingTaskId ? tasksRepo.getById(editingTaskId) : undefined),
    [editingTaskId],
  )
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [completed, setCompleted] = useState(false)
  const [tags, setTags] = useState('')

  useEffect(() => {
    setTitle(task?.title ?? '')
    setNotes(task?.notes ?? '')
    setDueDate(task?.dueDate ?? '')
    setCompleted(task?.completed ?? false)
    setTags(task?.tags.join(', ') ?? '')
  }, [task])

  const isEditing = Boolean(editingTaskId)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const payload = {
      title,
      notes,
      dueDate: dueDate || null,
      completed,
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
    if (!editingTaskId) return
    await tasksRepo.softDelete(editingTaskId)
    closeEditor()
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
