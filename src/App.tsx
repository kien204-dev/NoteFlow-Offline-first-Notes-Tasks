import { useEffect, useState } from 'react'
import { NoteEditor } from './features/notes/NoteEditor'
import { NoteList } from './features/notes/NoteList'
import { useNotesUiStore } from './features/notes/store'
import { TaskForm } from './features/tasks/TaskForm'
import { TaskList } from './features/tasks/TaskList'
import { useTasksUiStore } from './features/tasks/store'

type WorkspaceTab = 'notes' | 'tasks'

function App() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('notes')
  const [isDark, setIsDark] = useState(false)
  const isNoteEditorOpen = useNotesUiStore((state) => state.isEditorOpen)
  const isTaskEditorOpen = useTasksUiStore((state) => state.isEditorOpen)
  const closeNoteEditor = useNotesUiStore((state) => state.closeEditor)
  const closeTaskEditor = useTasksUiStore((state) => state.closeEditor)
  const isNotesEditorVisible = activeTab === 'notes' && isNoteEditorOpen
  const isTasksEditorVisible = activeTab === 'tasks' && isTaskEditorOpen
  const isEditorVisible = isNotesEditorVisible || isTasksEditorVisible

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark)
  }, [isDark])

  const handleTabChange = (tab: WorkspaceTab) => {
    setActiveTab(tab)
    closeNoteEditor()
    closeTaskEditor()
  }

  return (
    <main className="min-h-screen bg-stone-100 text-ink dark:bg-zinc-950 dark:text-zinc-50">
      <section className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-stone-300 pb-5 dark:border-zinc-800 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-200">
              Offline-first ledger
            </p>
            <h1 className="mt-1 font-serif text-4xl font-semibold tracking-normal sm:text-5xl">
              NoteFlow
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600 dark:text-zinc-400">
              Notes and tasks write to IndexedDB first. Server sync stays out of this step.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div
              className="grid grid-cols-2 rounded-sm border border-stone-300 bg-paper p-1 dark:border-zinc-700 dark:bg-zinc-900"
              aria-label="Workspace tabs"
            >
              {(['notes', 'tasks'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => handleTabChange(tab)}
                  className={`rounded-sm px-4 py-2 text-sm font-semibold capitalize ${
                    activeTab === tab
                      ? 'bg-ink text-paper dark:bg-amber-200 dark:text-zinc-950'
                      : 'text-stone-600 dark:text-zinc-300'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setIsDark((value) => !value)}
              className="rounded-sm border border-stone-300 bg-paper px-4 py-2 text-sm font-semibold dark:border-zinc-700 dark:bg-zinc-900"
              aria-label="Toggle dark mode"
            >
              {isDark ? 'Light' : 'Dark'}
            </button>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(320px,420px)_1fr]">
          <div className={`${isEditorVisible ? 'hidden lg:block' : 'block'} min-h-0`}>
            {activeTab === 'notes' ? <NoteList /> : <TaskList />}
          </div>

          <div className={`${isEditorVisible ? 'block' : 'hidden lg:block'} min-h-0`}>
            {activeTab === 'notes' ? <NoteEditor /> : <TaskForm />}
          </div>
        </div>
      </section>
    </main>
  )
}

export default App
