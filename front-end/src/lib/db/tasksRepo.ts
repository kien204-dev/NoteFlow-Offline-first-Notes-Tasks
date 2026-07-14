import { db, type NoteFlowDatabase, type TaskRecord } from './schema'
import { matchesSearchText, matchesTags, normalizeTags, sortTags } from './filterUtils'

export type TaskStatusFilter = 'all' | 'active' | 'completed'
export type TaskPriority = TaskRecord['priority']
export type TaskSubtask = TaskRecord['subtasks'][number]
export type TaskPriorityFilter = 'all' | TaskPriority
export type TaskSort = 'updated' | 'dueDate' | 'priority'

export type TaskFilter = {
  query?: string
  tags?: string[]
  status?: TaskStatusFilter
  priority?: TaskPriorityFilter
  sortBy?: TaskSort
  includeDeleted?: boolean
  includeTrashed?: boolean
  onlyTrashed?: boolean
}

export type CreateTaskInput = {
  title: string
  notes?: string
  dueDate?: string | null
  priority?: TaskPriority
  completed?: boolean
  subtasks?: TaskRecord['subtasks']
  tags?: string[]
}

export type UpdateTaskInput = Partial<
  Pick<TaskRecord, 'title' | 'notes' | 'dueDate' | 'priority' | 'completed' | 'subtasks' | 'tags'>
>

const matchesStatus = (task: TaskRecord, status: TaskStatusFilter = 'all') => {
  if (status === 'active') return !task.completed
  if (status === 'completed') return task.completed
  return true
}

const matchesPriority = (task: TaskRecord, priority: TaskPriorityFilter = 'all') =>
  priority === 'all' || task.priority === priority

const priorityRank: Record<TaskPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
}

const sortTasks = (tasks: TaskRecord[], sortBy: TaskSort = 'updated') => {
  const sorted = [...tasks]

  if (sortBy === 'dueDate') {
    return sorted.sort((left, right) => {
      if (!left.dueDate && !right.dueDate) return right.updatedAt - left.updatedAt
      if (!left.dueDate) return 1
      if (!right.dueDate) return -1
      return left.dueDate.localeCompare(right.dueDate) || right.updatedAt - left.updatedAt
    })
  }

  if (sortBy === 'priority') {
    return sorted.sort(
      (left, right) =>
        priorityRank[left.priority] - priorityRank[right.priority] ||
        right.updatedAt - left.updatedAt,
    )
  }

  return sorted.sort((left, right) => right.updatedAt - left.updatedAt)
}

export const create = async (
  input: CreateTaskInput,
  database: NoteFlowDatabase = db,
): Promise<TaskRecord> => {
  const now = Date.now()
  const task: TaskRecord = {
    id: crypto.randomUUID(),
    title: input.title.trim() || 'Untitled task',
    notes: input.notes?.trim() || '',
    dueDate: input.dueDate ?? null,
    priority: input.priority ?? 'medium',
    completed: input.completed ?? false,
    subtasks: input.subtasks ?? [],
    tags: normalizeTags(input.tags),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    trashedAt: null,
    dirty: true,
    baseVersion: null,
  }

  await database.tasks.add(task)
  return task
}

export const update = async (
  id: string,
  input: UpdateTaskInput,
  database: NoteFlowDatabase = db,
): Promise<TaskRecord> => {
  const current = await database.tasks.get(id)
  if (!current) throw new Error(`Task not found: ${id}`)

  const next: TaskRecord = {
    ...current,
    ...input,
    title: input.title?.trim() || current.title,
    notes: input.notes?.trim() ?? current.notes,
    priority: input.priority ?? current.priority,
    subtasks: input.subtasks ?? current.subtasks,
    tags: input.tags ? normalizeTags(input.tags) : current.tags,
    updatedAt: Date.now(),
    dirty: true,
  }

  await database.tasks.put(next)
  return next
}

export const softDelete = async (
  id: string,
  database: NoteFlowDatabase = db,
): Promise<TaskRecord> => {
  const current = await database.tasks.get(id)
  if (!current) throw new Error(`Task not found: ${id}`)

  const now = Date.now()
  const next = { ...current, deletedAt: now, trashedAt: current.trashedAt ?? now, updatedAt: now, dirty: true }
  await database.tasks.put(next)
  return next
}

export const restore = async (
  id: string,
  database: NoteFlowDatabase = db,
): Promise<TaskRecord> => {
  const current = await database.tasks.get(id)
  if (!current) throw new Error(`Task not found: ${id}`)

  const next = { ...current, deletedAt: null, updatedAt: Date.now(), dirty: true }
  await database.tasks.put(next)
  return next
}

export const trash = async (
  id: string,
  database: NoteFlowDatabase = db,
): Promise<TaskRecord> => {
  const current = await database.tasks.get(id)
  if (!current) throw new Error(`Task not found: ${id}`)

  const next = { ...current, trashedAt: Date.now() }
  await database.tasks.put(next)
  return next
}

export const restoreFromTrash = async (
  id: string,
  database: NoteFlowDatabase = db,
): Promise<TaskRecord> => {
  const current = await database.tasks.get(id)
  if (!current) throw new Error(`Task not found: ${id}`)

  const next = { ...current, trashedAt: null }
  await database.tasks.put(next)
  return next
}

export const getById = (id: string, database: NoteFlowDatabase = db) => database.tasks.get(id)

export const list = async (
  filter: TaskFilter = {},
  database: NoteFlowDatabase = db,
): Promise<TaskRecord[]> => {
  const tasks = await database.tasks.toArray()
  const filteredTasks = tasks.filter(
    (task) =>
      (filter.includeDeleted || task.deletedAt === null) &&
      (filter.onlyTrashed ? task.trashedAt !== null : filter.includeTrashed || task.trashedAt === null) &&
      matchesTags(task.tags, filter.tags) &&
      matchesStatus(task, filter.status) &&
      matchesPriority(task, filter.priority) &&
      matchesSearchText(filter.query, [task.title, task.notes ?? '']),
  )

  return sortTasks(filteredTasks, filter.sortBy)
}

export const search = (query: string, database: NoteFlowDatabase = db) =>
  list({ query }, database)

export const listTrashed = (database: NoteFlowDatabase = db) =>
  list({ onlyTrashed: true, includeDeleted: false }, database)

export const getAllTags = async (database: NoteFlowDatabase = db) => {
  const tasks = await list({}, database)
  return sortTags(Array.from(new Set(tasks.flatMap((task) => task.tags))))
}
