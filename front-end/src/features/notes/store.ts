import { useLiveQuery } from 'dexie-react-hooks'
import { create } from 'zustand'
import * as notesRepo from '../../lib/db/notesRepo'
import { useDebouncedValue } from '../../lib/useDebouncedValue'

type NotesUiState = {
  query: string
  selectedTags: string[]
  editingNoteId: string | null
  isEditorOpen: boolean
  setQuery: (query: string) => void
  toggleTag: (tag: string) => void
  clearTags: () => void
  openEditor: (noteId: string | null) => void
  closeEditor: () => void
}

// Dexie is the source of truth for data; Zustand only stores UI state.
export const useNotesUiStore = create<NotesUiState>((set) => ({
  query: '',
  selectedTags: [],
  editingNoteId: null,
  isEditorOpen: false,
  setQuery: (query) => set({ query }),
  toggleTag: (tag) =>
    set((state) => ({
      selectedTags: state.selectedTags.includes(tag)
        ? state.selectedTags.filter((selectedTag) => selectedTag !== tag)
        : [...state.selectedTags, tag],
    })),
  clearTags: () => set({ selectedTags: [] }),
  openEditor: (noteId) => set({ editingNoteId: noteId, isEditorOpen: true }),
  closeEditor: () => set({ editingNoteId: null, isEditorOpen: false }),
}))

export const useNotesView = () => {
  const query = useNotesUiStore((state) => state.query)
  const selectedTags = useNotesUiStore((state) => state.selectedTags)
  const debouncedQuery = useDebouncedValue(query, 300)
  const selectedTagKey = selectedTags.join('|')

  const notes = useLiveQuery(
    () => notesRepo.list({ query: debouncedQuery, tags: selectedTags }),
    [debouncedQuery, selectedTagKey],
  )

  const tags = useLiveQuery(() => notesRepo.getAllTags(), [], [])

  return { notes, tags, query, selectedTags }
}
