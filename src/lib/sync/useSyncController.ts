import { useEffect } from 'react'
import { runSync } from './syncEngine'

type SyncRegistration = ServiceWorkerRegistration & {
  sync?: {
    register: (tag: string) => Promise<void>
  }
}

const registerBackgroundSync = async () => {
  if (!('serviceWorker' in navigator)) return

  const registration = (await navigator.serviceWorker.ready) as SyncRegistration
  if (!registration.sync) return

  await registration.sync.register('noteflow-sync')
}

export const useSyncController = () => {
  useEffect(() => {
    void runSync()
    void registerBackgroundSync().catch(() => {
      // Safari/iOS and Firefox do not support Background Sync; online events
      // and the 30s interval below are the intentional fallback path.
    })

    const handleOnline = () => void runSync()
    const handleServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type === 'noteflow-sync') {
        void runSync()
      }
    }

    window.addEventListener('online', handleOnline)
    navigator.serviceWorker?.addEventListener('message', handleServiceWorkerMessage)

    const intervalId = window.setInterval(() => {
      if (navigator.onLine) void runSync()
    }, 30_000)

    return () => {
      window.removeEventListener('online', handleOnline)
      navigator.serviceWorker?.removeEventListener('message', handleServiceWorkerMessage)
      window.clearInterval(intervalId)
    }
  }, [])
}
