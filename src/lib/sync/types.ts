import type { NoteRecord, TaskRecord } from '../db/schema'

export type SyncStatus = 'idle' | 'offline' | 'syncing' | 'synced' | 'error'

export type SyncStatusSnapshot = {
  status: SyncStatus
  lastSyncedAt: string | null
  error: string | null
}

export type ServerNote = Omit<NoteRecord, 'createdAt' | 'updatedAt' | 'deletedAt' | 'dirty'> & {
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export type ServerTask = Omit<TaskRecord, 'createdAt' | 'updatedAt' | 'deletedAt' | 'dirty'> & {
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export type PushPayload = {
  notes: ServerNote[]
  tasks: ServerTask[]
}

export type PushResponse = {
  saved: {
    notes: string[]
    tasks: string[]
  }
  serverWins: {
    notes: ServerNote[]
    tasks: ServerTask[]
  }
}

export type PullResponse = {
  notes: ServerNote[]
  tasks: ServerTask[]
}
