import { create } from 'zustand'
import type { SyncStatusSnapshot } from './types'

type SyncStatusStore = SyncStatusSnapshot & {
  setStatus: (status: Partial<SyncStatusSnapshot>) => void
}

export const useSyncStatusStore = create<SyncStatusStore>((set) => ({
  status: 'idle',
  lastSyncedAt: null,
  error: null,
  setStatus: (next) => set(next),
}))
