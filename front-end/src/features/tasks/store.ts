import { useLiveQuery } from 'dexie-react-hooks'
import { create } from 'zustand'
import * as tasksRepo from '../../lib/db/tasksRepo'
import { useDebouncedValue } from '../../lib/useDebouncedValue'

type TasksUiState = {
  query: string
  selectedTags: string[]
  status: tasksRepo.TaskStatusFilter
  priority: tasksRepo.TaskPriorityFilter
  sortBy: tasksRepo.TaskSort
  editingTaskId: string | null
  isEditorOpen: boolean
  setQuery: (query: string) => void
  setStatus: (status: tasksRepo.TaskStatusFilter) => void
  setPriority: (priority: tasksRepo.TaskPriorityFilter) => void
  setSortBy: (sortBy: tasksRepo.TaskSort) => void
  toggleTag: (tag: string) => void
  clearTags: () => void
  openEditor: (taskId: string | null) => void
  closeEditor: () => void
}

// Dexie is the source of truth for data; Zustand only stores UI state.
export const useTasksUiStore = create<TasksUiState>((set) => ({
  query: '',
  selectedTags: [],
  status: 'all',
  priority: 'all',
  sortBy: 'updated',
  editingTaskId: null,
  isEditorOpen: false,
  setQuery: (query) => set({ query }),
  setStatus: (status) => set({ status }),
  setPriority: (priority) => set({ priority }),
  setSortBy: (sortBy) => set({ sortBy }),
  toggleTag: (tag) =>
    set((state) => ({
      selectedTags: state.selectedTags.includes(tag)
        ? state.selectedTags.filter((selectedTag) => selectedTag !== tag)
        : [...state.selectedTags, tag],
    })),
  clearTags: () => set({ selectedTags: [] }),
  openEditor: (taskId) => set({ editingTaskId: taskId, isEditorOpen: true }),
  closeEditor: () => set({ editingTaskId: null, isEditorOpen: false }),
}))

export const useTasksView = () => {
  const query = useTasksUiStore((state) => state.query)
  const selectedTags = useTasksUiStore((state) => state.selectedTags)
  const status = useTasksUiStore((state) => state.status)
  const priority = useTasksUiStore((state) => state.priority)
  const sortBy = useTasksUiStore((state) => state.sortBy)
  const debouncedQuery = useDebouncedValue(query, 250)
  const selectedTagKey = selectedTags.join('|')

  const tasks = useLiveQuery(
    () => tasksRepo.list({ query: debouncedQuery, tags: selectedTags, status, priority, sortBy }),
    [debouncedQuery, selectedTagKey, status, priority, sortBy],
  )

  const tags = useLiveQuery(() => tasksRepo.getAllTags(), [], [])

  return { tasks, tags, query, selectedTags, status, priority, sortBy }
}
