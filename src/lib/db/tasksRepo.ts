import { nanoid } from 'nanoid'
import { db, type NoteFlowDatabase, type TaskRecord } from './schema'

export type TaskStatusFilter = 'all' | 'active' | 'completed'

export type TaskFilter = {
  query?: string
  tags?: string[]
  status?: TaskStatusFilter
  includeDeleted?: boolean
}

export type CreateTaskInput = {
  title: string
  notes?: string
  dueDate?: string | null
  completed?: boolean
  tags?: string[]
}

export type UpdateTaskInput = Partial<
  Pick<TaskRecord, 'title' | 'notes' | 'dueDate' | 'completed' | 'tags'>
>

const normalizeTags = (tags: string[] = []) =>
  Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b),
  )

const matchesTags = (recordTags: string[], selectedTags: string[] = []) =>
  selectedTags.length === 0 || selectedTags.every((tag) => recordTags.includes(tag))

const matchesStatus = (task: TaskRecord, status: TaskStatusFilter = 'all') => {
  if (status === 'active') return !task.completed
  if (status === 'completed') return task.completed
  return true
}

const matchesQuery = (task: TaskRecord, query = '') => {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return true

  return `${task.title} ${task.notes ?? ''}`.toLowerCase().includes(normalizedQuery)
}

export const create = async (
  input: CreateTaskInput,
  database: NoteFlowDatabase = db,
): Promise<TaskRecord> => {
  const now = Date.now()
  const task: TaskRecord = {
    id: nanoid(),
    title: input.title.trim() || 'Untitled task',
    notes: input.notes?.trim() || '',
    dueDate: input.dueDate ?? null,
    completed: input.completed ?? false,
    tags: normalizeTags(input.tags),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    dirty: true,
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
  const next = { ...current, deletedAt: now, updatedAt: now, dirty: true }
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

export const getById = (id: string, database: NoteFlowDatabase = db) => database.tasks.get(id)

export const list = async (
  filter: TaskFilter = {},
  database: NoteFlowDatabase = db,
): Promise<TaskRecord[]> => {
  const tasks = await database.tasks.orderBy('updatedAt').reverse().toArray()

  return tasks.filter(
    (task) =>
      (filter.includeDeleted || task.deletedAt === null) &&
      matchesTags(task.tags, filter.tags) &&
      matchesStatus(task, filter.status) &&
      matchesQuery(task, filter.query),
  )
}

export const search = (query: string, database: NoteFlowDatabase = db) =>
  list({ query }, database)

export const getAllTags = async (database: NoteFlowDatabase = db) => {
  const tasks = await list({}, database)
  return Array.from(new Set(tasks.flatMap((task) => task.tags))).sort((a, b) =>
    a.localeCompare(b),
  )
}
