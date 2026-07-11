import { EmptyState, ListSkeleton } from '../../components/PanelStates'
import { TaskItem } from './TaskItem'
import { useTasksUiStore, useTasksView } from './store'

const statuses = [
  { label: 'All', value: 'all' },
  { label: 'Open', value: 'active' },
  { label: 'Done', value: 'completed' },
] as const

const priorities = [
  { label: 'Any priority', value: 'all' },
  { label: 'High', value: 'high' },
  { label: 'Medium', value: 'medium' },
  { label: 'Low', value: 'low' },
] as const

const sortOptions = [
  { label: 'Updated', value: 'updated' },
  { label: 'Due date', value: 'dueDate' },
  { label: 'Priority', value: 'priority' },
] as const

export function TaskList() {
  const { tasks, tags, query, selectedTags, status, priority, sortBy } = useTasksView()
  const setQuery = useTasksUiStore((state) => state.setQuery)
  const setStatus = useTasksUiStore((state) => state.setStatus)
  const setPriority = useTasksUiStore((state) => state.setPriority)
  const setSortBy = useTasksUiStore((state) => state.setSortBy)
  const toggleTag = useTasksUiStore((state) => state.toggleTag)
  const clearTags = useTasksUiStore((state) => state.clearTags)
  const editingTaskId = useTasksUiStore((state) => state.editingTaskId)
  const openEditor = useTasksUiStore((state) => state.openEditor)
  const isLoading = tasks === undefined
  const visibleTasks = tasks ?? []

  return (
    <section className="flex h-full min-h-0 flex-col gap-4" aria-label="Tasks">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-serif text-2xl font-semibold text-ink dark:text-stone-50">
            Tasks
          </h2>
          <button
            type="button"
            onClick={() => openEditor(null)}
            className="rounded-sm bg-ink px-3 py-2 text-sm font-semibold text-paper transition hover:bg-stone-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink dark:bg-amber-200 dark:text-zinc-950"
          >
            New task
          </button>
        </div>

        <label className="text-sm font-medium text-stone-700 dark:text-zinc-300">
          Search tasks
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="mt-2 w-full rounded-sm border border-stone-300 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-ink dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            placeholder="Title or notes"
          />
        </label>

        <div className="grid grid-cols-3 rounded-sm border border-stone-300 p-1 dark:border-zinc-700">
          {statuses.map((statusOption) => (
            <button
              key={statusOption.value}
              type="button"
              onClick={() => setStatus(statusOption.value)}
              className={`rounded-sm px-2 py-1.5 text-xs font-semibold ${
                status === statusOption.value
                  ? 'bg-ink text-paper dark:bg-amber-200 dark:text-zinc-950'
                  : 'text-stone-600 dark:text-zinc-300'
              }`}
            >
              {statusOption.label}
            </button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium text-stone-700 dark:text-zinc-300">
            Priority filter
            <select
              value={priority}
              onChange={(event) =>
                setPriority(event.target.value as (typeof priorities)[number]['value'])
              }
              className="mt-2 w-full rounded-sm border border-stone-300 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-ink dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            >
              {priorities.map((priorityOption) => (
                <option key={priorityOption.value} value={priorityOption.value}>
                  {priorityOption.label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium text-stone-700 dark:text-zinc-300">
            Sort tasks
            <select
              value={sortBy}
              onChange={(event) =>
                setSortBy(event.target.value as (typeof sortOptions)[number]['value'])
              }
              className="mt-2 w-full rounded-sm border border-stone-300 bg-white px-3 py-2 text-sm text-ink outline-none focus:border-ink dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            >
              {sortOptions.map((sortOption) => (
                <option key={sortOption.value} value={sortOption.value}>
                  {sortOption.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {tags.length ? (
          <div className="flex flex-wrap gap-2" aria-label="Task tag filters">
            {tags.map((tag) => (
              <button
                type="button"
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`rounded-sm border px-2.5 py-1 text-xs font-medium ${
                  selectedTags.includes(tag)
                    ? 'border-ink bg-ink text-paper dark:border-amber-200 dark:bg-amber-200 dark:text-zinc-950'
                    : 'border-stone-300 bg-paper text-stone-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300'
                }`}
              >
                {tag}
              </button>
            ))}
            {selectedTags.length ? (
              <button type="button" onClick={clearTags} className="text-xs text-stone-500 underline">
                Clear
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="grid min-h-0 gap-3 overflow-y-auto pr-1">
        {isLoading ? (
          <ListSkeleton label="Loading local tasks" />
        ) : visibleTasks.length ? (
          visibleTasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              isSelected={editingTaskId === task.id}
              onSelect={openEditor}
            />
          ))
        ) : (
          <EmptyState
            title={
              query || selectedTags.length || status !== 'all' || priority !== 'all'
                ? 'No tasks match this view'
                : 'No tasks yet'
            }
            description={
              query || selectedTags.length || status !== 'all' || priority !== 'all'
                ? 'Adjust the search, tags, status, or priority filter to widen the list.'
                : 'Add the next concrete step and it will save locally first.'
            }
            actionLabel="Create first task"
            onAction={() => openEditor(null)}
          />
        )}
      </div>
    </section>
  )
}
