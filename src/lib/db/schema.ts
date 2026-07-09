import Dexie, { type Table } from 'dexie'

export type NoteRecord = {
  id: string
  title: string
  content: string
  tags: string[]
  createdAt: number
  updatedAt: number
  deletedAt: number | null
  dirty: boolean
}

export type TaskRecord = {
  id: string
  title: string
  notes?: string
  dueDate: string | null
  completed: boolean
  tags: string[]
  createdAt: number
  updatedAt: number
  deletedAt: number | null
  dirty: boolean
}

export type SyncMetaRecord = {
  key: 'lastSyncedAt'
  value: string
}

export class NoteFlowDatabase extends Dexie {
  notes!: Table<NoteRecord, string>
  tasks!: Table<TaskRecord, string>
  syncMeta!: Table<SyncMetaRecord, string>

  constructor(name = 'noteflow') {
    super(name)

    this.version(1).stores({
      // Client-generated IDs stay stable while offline and later become the
      // shared identity between IndexedDB records and server rows.
      // `deletedAt` enables soft delete so sync can send tombstones later.
      // `dirty` marks local changes that have not been acknowledged by server sync.
      // `*tags` is a Dexie multi-entry index for fast tag filters.
      notes: '&id, updatedAt, deletedAt, *tags',
      tasks: '&id, updatedAt, deletedAt, completed, dueDate, *tags',
    })

    this.version(2).stores({
      notes: '&id, updatedAt, deletedAt, dirty, *tags',
      tasks: '&id, updatedAt, deletedAt, dirty, completed, dueDate, *tags',
      syncMeta: '&key',
    })
  }
}

export const db = new NoteFlowDatabase()

export const createDatabase = (name: string) => new NoteFlowDatabase(name)
