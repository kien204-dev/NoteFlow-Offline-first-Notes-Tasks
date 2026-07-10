import { useEffect, useState } from 'react'
import { NoteEditor } from './features/notes/NoteEditor'
import { NoteList } from './features/notes/NoteList'
import { useNotesUiStore } from './features/notes/store'
import { ConflictResolver } from './features/sync/ConflictResolver'
import { TaskForm } from './features/tasks/TaskForm'
import { TaskList } from './features/tasks/TaskList'
import { useTasksUiStore } from './features/tasks/store'
import { InstallPrompt } from './lib/pwa/InstallPrompt'
import { UpdatePrompt } from './lib/pwa/UpdatePrompt'
import { SyncStatusBadge } from './lib/sync/SyncStatusBadge'
import { useSyncController } from './lib/sync/useSyncController'

type WorkspaceTab = 'notes' | 'tasks'

function App() {
  useSyncController()
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('notes')
  const [isDark, setIsDark] = useState(false)
  const [isResolvingConflicts, setIsResolvingConflicts] = useState(false)
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
    setIsResolvingConflicts(false)
    closeNoteEditor()
    closeTaskEditor()
  }

  return (
    <main className="min-h-screen bg-stone-100 text-ink dark:bg-zinc-950 dark:text-zinc-50">
      <a
        href="#workspace"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-sm focus:bg-ink focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-paper dark:focus:bg-amber-200 dark:focus:text-zinc-950"
      >
        Skip to workspace
      </a>
      <section
        id="workspace"
        className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8"
      >
        <header className="flex flex-col gap-4 border-b border-stone-300 pb-5 dark:border-zinc-800 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-200">
              Offline-first ledger
            </p>
            <h1 className="mt-1 font-serif text-4xl font-semibold tracking-normal sm:text-5xl">
              NoteFlow
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600 dark:text-zinc-400">
              Notes and tasks write to IndexedDB first, then sync when the network is available.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SyncStatusBadge onOpenConflicts={() => setIsResolvingConflicts(true)} />
            <InstallPrompt />
            <div
              className="grid grid-cols-2 rounded-sm border border-stone-300 bg-paper p-1 dark:border-zinc-700 dark:bg-zinc-900"
              aria-label="Workspace tabs"
            >
              {(['notes', 'tasks'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => handleTabChange(tab)}
                  className={`rounded-sm px-4 py-2 text-sm font-semibold capitalize transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink active:translate-y-px dark:focus-visible:outline-amber-200 ${
                    activeTab === tab
                      ? 'bg-ink text-paper dark:bg-amber-200 dark:text-zinc-950'
                      : 'text-stone-600 hover:text-ink dark:text-zinc-300 dark:hover:text-stone-50'
                  }`}
                  aria-pressed={activeTab === tab}
                >
                  {tab}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setIsDark((value) => !value)}
              className="rounded-sm border border-stone-300 bg-paper px-4 py-2 text-sm font-semibold transition hover:-translate-y-0.5 hover:shadow-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink active:translate-y-0 dark:border-zinc-700 dark:bg-zinc-900 dark:focus-visible:outline-amber-200"
              aria-label="Toggle dark mode"
            >
              {isDark ? 'Light' : 'Dark'}
            </button>
          </div>
        </header>

        {isResolvingConflicts ? (
          <ConflictResolver onClose={() => setIsResolvingConflicts(false)} />
        ) : (
          <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(320px,420px)_1fr]">
            <div className={`${isEditorVisible ? 'hidden lg:block' : 'block'} min-h-0`}>
              {activeTab === 'notes' ? <NoteList /> : <TaskList />}
            </div>

            <div className={`${isEditorVisible ? 'block' : 'hidden lg:block'} min-h-0`}>
              {activeTab === 'notes' ? <NoteEditor /> : <TaskForm />}
            </div>
          </div>
        )}
      </section>
      <UpdatePrompt />
    </main>
  )
}

export default App
