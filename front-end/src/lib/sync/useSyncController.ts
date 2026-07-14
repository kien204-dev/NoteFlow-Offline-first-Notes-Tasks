import { useCallback, useEffect, useRef } from 'react'
import { useAuthStore } from '../../features/auth/authStore'
import { runSync } from './syncEngine'
import { createSyncEventStream } from './syncEventStream'
import { useSyncStatusStore } from './statusStore'

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
  const accessToken = useAuthStore((state) => state.accessToken)
  const clientIdRef = useRef(crypto.randomUUID())
  const syncPromiseRef = useRef<Promise<unknown> | null>(null)

  const triggerSync = useCallback(() => {
    if (syncPromiseRef.current) return syncPromiseRef.current

    const syncPromise = runSync({ clientId: clientIdRef.current }).finally(() => {
      if (syncPromiseRef.current === syncPromise) syncPromiseRef.current = null
    })
    syncPromiseRef.current = syncPromise
    return syncPromise
  }, [])

  useEffect(() => {
    const setStatus = useSyncStatusStore.getState().setStatus
    if (!accessToken) {
      setStatus({ connection: 'disconnected' })
      return undefined
    }

    setStatus({ connection: navigator.onLine ? 'connecting' : 'fallback' })
    void triggerSync()
    void registerBackgroundSync().catch(() => {
      // Safari/iOS and Firefox do not support Background Sync; online events
      // and the 30s interval below are the intentional fallback path.
    })

    const stream = createSyncEventStream({
      accessToken,
      clientId: clientIdRef.current,
      onChange: () => void triggerSync(),
      onConnected: () => setStatus({ connection: 'connected' }),
      onDisconnected: () => setStatus({ connection: 'fallback' }),
      onAuthError: () => {
        setStatus({ connection: 'fallback' })
        void triggerSync()
      },
    })

    const handleOnline = () => {
      setStatus({ connection: 'connecting' })
      stream.restart()
      void triggerSync()
    }
    const handleOffline = () => {
      setStatus({ connection: 'fallback' })
      void triggerSync()
    }
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return
      stream.restart()
      if (navigator.onLine) void triggerSync()
    }
    const handleServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type === 'noteflow-sync') {
        void triggerSync()
      }
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    navigator.serviceWorker?.addEventListener('message', handleServiceWorkerMessage)

    const intervalId = window.setInterval(() => {
      if (navigator.onLine) void triggerSync()
    }, 30_000)

    return () => {
      stream.close()
      setStatus({ connection: 'disconnected' })
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      navigator.serviceWorker?.removeEventListener('message', handleServiceWorkerMessage)
      window.clearInterval(intervalId)
    }
  }, [accessToken, triggerSync])
}
