import { useEffect, useState } from 'react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

const installedStorageKey = 'noteflow:pwa-installed'
const dismissedStorageKey = 'noteflow:pwa-install-dismissed'

const isIos = () =>
  /iphone|ipad|ipod/i.test(window.navigator.userAgent) &&
  !('MSStream' in window) &&
  !(window.matchMedia?.('(display-mode: standalone)').matches ?? false)

export function InstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(
    () =>
      window.localStorage.getItem(installedStorageKey) === 'true' ||
      (window.matchMedia?.('(display-mode: standalone)').matches ?? false),
  )
  const [isDismissed, setIsDismissed] = useState(
    () => window.localStorage.getItem(dismissedStorageKey) === 'true',
  )
  const [showIosHint, setShowIosHint] = useState(false)

  useEffect(() => {
    setShowIosHint(isIos())

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setInstallEvent(event as BeforeInstallPromptEvent)
      setIsDismissed(false)
    }

    const handleAppInstalled = () => {
      window.localStorage.setItem(installedStorageKey, 'true')
      setInstallEvent(null)
      setIsInstalled(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  const installApp = async () => {
    if (!installEvent) return

    await installEvent.prompt()
    const choice = await installEvent.userChoice
    if (choice.outcome === 'accepted') {
      window.localStorage.setItem(installedStorageKey, 'true')
      setIsInstalled(true)
    }
    setInstallEvent(null)
  }

  const dismiss = () => {
    window.localStorage.setItem(dismissedStorageKey, 'true')
    setIsDismissed(true)
  }

  if (isInstalled || isDismissed) return null

  if (installEvent) {
    return (
      <div className="flex items-center gap-2 rounded-sm border border-stone-300 bg-paper px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900">
        <button
          type="button"
          onClick={installApp}
          className="font-semibold text-ink underline underline-offset-4 dark:text-amber-200"
        >
          Cài đặt NoteFlow
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Ẩn lời mời cài đặt"
          className="text-stone-500 dark:text-zinc-400"
        >
          ×
        </button>
      </div>
    )
  }

  if (showIosHint) {
    return (
      <div className="rounded-sm border border-stone-300 bg-paper px-3 py-2 text-xs text-stone-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
        iOS: Chia sẻ → Thêm vào MH chính
      </div>
    )
  }

  return null
}
