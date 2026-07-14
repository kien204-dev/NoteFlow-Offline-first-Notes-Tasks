import { create } from 'zustand'

type UndoToastEntity = 'note' | 'task'

export type UndoToastItem = {
  id: string
  entity: UndoToastEntity
  title: string
}

type UndoToastState = {
  item: UndoToastItem | null
  showUndo: (item: UndoToastItem) => void
  clearUndo: () => void
}

export const useUndoToastStore = create<UndoToastState>((set) => ({
  item: null,
  showUndo: (item) => set({ item }),
  clearUndo: () => set({ item: null }),
}))
