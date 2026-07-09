import { nanoid } from 'nanoid'
import { db, type NoteFlowDatabase, type NoteRecord } from './schema'

export type NoteFilter = {
  query?: string
  tags?: string[]
  includeDeleted?: boolean
}

export type CreateNoteInput = {
  title: string
  content: string
  tags?: string[]
}

export type UpdateNoteInput = Partial<Pick<NoteRecord, 'title' | 'content' | 'tags'>>

const normalizeTags = (tags: string[] = []) =>
  Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b),
  )

const matchesTags = (recordTags: string[], selectedTags: string[] = []) =>
  selectedTags.length === 0 || selectedTags.every((tag) => recordTags.includes(tag))

const matchesQuery = (note: NoteRecord, query = '') => {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return true

  return `${note.title} ${note.content}`.toLowerCase().includes(normalizedQuery)
}

export const create = async (
  input: CreateNoteInput,
  database: NoteFlowDatabase = db,
): Promise<NoteRecord> => {
  const now = Date.now()
  const note: NoteRecord = {
    id: nanoid(),
    title: input.title.trim() || 'Untitled note',
    content: input.content,
    tags: normalizeTags(input.tags),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    dirty: true,
  }

  await database.notes.add(note)
  return note
}

export const update = async (
  id: string,
  input: UpdateNoteInput,
  database: NoteFlowDatabase = db,
): Promise<NoteRecord> => {
  const current = await database.notes.get(id)
  if (!current) throw new Error(`Note not found: ${id}`)

  const next: NoteRecord = {
    ...current,
    ...input,
    title: input.title?.trim() || current.title,
    tags: input.tags ? normalizeTags(input.tags) : current.tags,
    updatedAt: Date.now(),
    dirty: true,
  }

  await database.notes.put(next)
  return next
}

export const softDelete = async (
  id: string,
  database: NoteFlowDatabase = db,
): Promise<NoteRecord> => {
  const current = await database.notes.get(id)
  if (!current) throw new Error(`Note not found: ${id}`)

  const now = Date.now()
  const next = { ...current, deletedAt: now, updatedAt: now, dirty: true }
  await database.notes.put(next)
  return next
}

export const restore = async (
  id: string,
  database: NoteFlowDatabase = db,
): Promise<NoteRecord> => {
  const current = await database.notes.get(id)
  if (!current) throw new Error(`Note not found: ${id}`)

  const next = { ...current, deletedAt: null, updatedAt: Date.now(), dirty: true }
  await database.notes.put(next)
  return next
}

export const getById = (id: string, database: NoteFlowDatabase = db) => database.notes.get(id)

export const list = async (
  filter: NoteFilter = {},
  database: NoteFlowDatabase = db,
): Promise<NoteRecord[]> => {
  const notes = await database.notes.orderBy('updatedAt').reverse().toArray()

  return notes.filter(
    (note) =>
      (filter.includeDeleted || note.deletedAt === null) &&
      matchesTags(note.tags, filter.tags) &&
      matchesQuery(note, filter.query),
  )
}

export const search = (query: string, database: NoteFlowDatabase = db) =>
  list({ query }, database)

export const getAllTags = async (database: NoteFlowDatabase = db) => {
  const notes = await list({}, database)
  return Array.from(new Set(notes.flatMap((note) => note.tags))).sort((a, b) =>
    a.localeCompare(b),
  )
}
