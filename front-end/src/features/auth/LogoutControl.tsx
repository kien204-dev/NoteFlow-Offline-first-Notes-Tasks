import { useEffect, useRef, useState } from 'react'
import { createAuthApi, type AuthApi } from './authApi'
import { useAuthStore } from './authStore'
import { clearLocalData, hasDirtyLocalData } from './localData'
import { navigateTo } from './navigation'
import { db, type NoteFlowDatabase } from '../../lib/db/schema'

type LogoutControlProps = {
  database?: NoteFlowDatabase
  authApi?: AuthApi
}

export function LogoutControl({
  database = db,
  authApi = createAuthApi(),
}: LogoutControlProps) {
  const clearAuth = useAuthStore((state) => state.clearAuth)
  const [isConfirming, setIsConfirming] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null)
  const previouslyFocusedElement = useRef<HTMLElement | null>(null)

  const finishLogout = async () => {
    setIsLoggingOut(true)
    try {
      await authApi.logout()
    } finally {
      await clearLocalData(database)
      clearAuth()
      navigateTo('/login')
      setIsLoggingOut(false)
      setIsConfirming(false)
    }
  }

  const handleLogoutClick = async () => {
    if (await hasDirtyLocalData(database)) {
      setIsConfirming(true)
      return
    }

    await finishLogout()
  }

  useEffect(() => {
    if (!isConfirming) return undefined

    previouslyFocusedElement.current = document.activeElement as HTMLElement | null
    cancelButtonRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsConfirming(false)
        return
      }

      if (event.key !== 'Tab' || !dialogRef.current) return

      const focusableElements = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute('disabled'))

      if (!focusableElements.length) return

      const firstElement = focusableElements[0]
      const lastElement = focusableElements[focusableElements.length - 1]

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault()
        lastElement.focus()
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault()
        firstElement.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      previouslyFocusedElement.current?.focus()
    }
  }, [isConfirming])

  return (
    <>
      <button
        type="button"
        onClick={() => void handleLogoutClick()}
        disabled={isLoggingOut}
        className="rounded-sm border border-stone-300 bg-paper px-4 py-2 text-sm font-semibold transition hover:-translate-y-0.5 hover:shadow-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:focus-visible:outline-amber-200"
      >
        {isLoggingOut ? 'Logging out...' : 'Logout'}
      </button>

      {isConfirming ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-stone-950/40 px-4"
          role="presentation"
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-confirm-title"
            aria-describedby="logout-confirm-description"
            className="w-full max-w-md rounded-sm border border-amber-300 bg-paper p-5 shadow-paper dark:border-amber-900 dark:bg-zinc-900"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-200">
              Unsynced changes
            </p>
            <h2 id="logout-confirm-title" className="mt-1 font-serif text-2xl font-semibold">
              Confirm logout
            </h2>
            <p
              id="logout-confirm-description"
              aria-live="polite"
              className="mt-3 text-sm leading-6 text-stone-700 dark:text-zinc-300"
            >
              Bạn có thay đổi chưa đồng bộ. Đăng xuất sẽ mất dữ liệu này trên thiết bị này.
              Tiếp tục?
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                ref={cancelButtonRef}
                type="button"
                onClick={() => setIsConfirming(false)}
                className="rounded-sm border border-stone-300 px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink dark:border-zinc-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void finishLogout()}
                className="rounded-sm bg-red-700 px-3 py-2 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
              >
                Logout and delete local data
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
