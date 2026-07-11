import * as tasksRepo from '../../lib/db/tasksRepo'
import type { TaskRecord } from '../../lib/db/schema'

type TaskItemProps = {
  task: TaskRecord
  isSelected: boolean
  onSelect: (id: string) => void
}

const formatDueDate = (dueDate: string | null) => {
  if (!dueDate) return 'No due date'
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(
    new Date(`${dueDate}T00:00:00`),
  )
}

const isOverdue = (dueDate: string | null, completed: boolean) => {
  if (!dueDate || completed) return false

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return new Date(`${dueDate}T00:00:00`).getTime() < today.getTime()
}

const priorityLabels: Record<TaskRecord['priority'], string> = {
  low: 'Low priority',
  medium: 'Medium priority',
  high: 'High priority',
}

const priorityClasses: Record<TaskRecord['priority'], string> = {
  low: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
  medium: 'border-stone-200 bg-stone-50 text-stone-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  high: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200',
}

export function TaskItem({ task, isSelected, onSelect }: TaskItemProps) {
  const toggleCompleted = async (event: React.ChangeEvent<HTMLInputElement>) => {
    await tasksRepo.update(task.id, { completed: event.target.checked })
  }
  const overdue = isOverdue(task.dueDate, task.completed)

  return (
    <article
      className={`relative rounded-sm border bg-paper p-4 shadow-paper transition dark:bg-zinc-900 ${
        isSelected ? 'border-ink dark:border-amber-200' : 'border-stone-200 dark:border-zinc-800'
      }`}
    >
      {task.dirty ? (
        <span
          className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full bg-amber-500"
          aria-label="Pending sync"
          title="Pending sync"
        />
      ) : null}
      <div className="flex gap-3 pr-5">
        <input
          type="checkbox"
          checked={task.completed}
          onChange={toggleCompleted}
          className="mt-1 h-4 w-4 accent-stone-900"
          aria-label={`Mark ${task.title} as ${task.completed ? 'active' : 'completed'}`}
        />
        <button
          type="button"
          onClick={() => onSelect(task.id)}
          className="min-w-0 flex-1 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          <h3
            className={`font-serif text-lg font-semibold text-ink dark:text-stone-50 ${
              task.completed ? 'line-through decoration-stone-400' : ''
            }`}
          >
            {task.title}
          </h3>
          <p className="mt-1 line-clamp-2 text-sm leading-6 text-stone-600 dark:text-zinc-300">
            {task.notes || 'No notes attached.'}
          </p>
        </button>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-stone-500 dark:text-zinc-400">
        <span
          className={`rounded-sm border px-2 py-1 ${
            overdue
              ? 'border-orange-300 bg-orange-50 font-semibold text-orange-800 dark:border-orange-900 dark:bg-orange-950 dark:text-orange-200'
              : 'border-stone-200 bg-stone-50 dark:border-zinc-700 dark:bg-zinc-800'
          }`}
        >
          {overdue ? `Overdue · ${formatDueDate(task.dueDate)}` : formatDueDate(task.dueDate)}
        </span>
        <span className={`rounded-sm border px-2 py-1 ${priorityClasses[task.priority]}`}>
          {priorityLabels[task.priority]}
        </span>
        {task.tags.map((tag) => (
          <span
            key={tag}
            className="rounded-sm border border-stone-200 bg-stone-50 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-800"
          >
            {tag}
          </span>
        ))}
      </div>
    </article>
  )
}
