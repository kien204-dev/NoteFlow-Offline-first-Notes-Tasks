export type SyncEventConnection = {
  restart: () => void
  close: () => void
}

export type SyncEventStreamOptions = {
  accessToken: string
  clientId: string
  baseUrl?: string
  fetcher?: typeof fetch
  onChange: () => void
  onConnected?: () => void
  onDisconnected?: () => void
  onAuthError?: () => void
  reconnectDelays?: number[]
}

const defaultBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000'

const parseEventBlock = (block: string) => {
  let event = 'message'
  const data: string[] = []

  for (const line of block.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim()
    if (line.startsWith('data:')) data.push(line.slice(5).trimStart())
  }

  return { event, data: data.join('\n') }
}

export const createSyncEventStream = ({
  accessToken,
  clientId,
  baseUrl = defaultBaseUrl,
  fetcher = fetch,
  onChange,
  onConnected,
  onDisconnected,
  onAuthError,
  reconnectDelays = [1_000, 2_000, 5_000, 10_000, 30_000],
}: SyncEventStreamOptions): SyncEventConnection => {
  let controller: AbortController | null = null
  let reconnectTimer: number | null = null
  let reconnectAttempt = 0
  let closed = false

  const clearReconnectTimer = () => {
    if (reconnectTimer !== null) window.clearTimeout(reconnectTimer)
    reconnectTimer = null
  }

  const scheduleReconnect = () => {
    if (closed || reconnectTimer !== null || !navigator.onLine) return
    const delay = reconnectDelays[Math.min(reconnectAttempt, reconnectDelays.length - 1)]
    reconnectAttempt += 1
    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = null
      void connect()
    }, delay)
  }

  const connect = async () => {
    if (closed || !navigator.onLine) return
    controller?.abort()
    controller = new AbortController()

    try {
      const response = await fetcher(`${baseUrl.replace(/\/$/, '')}/api/sync/events`, {
        headers: {
          Accept: 'text/event-stream',
          Authorization: `Bearer ${accessToken}`,
          'X-NoteFlow-Client-Id': clientId,
        },
        signal: controller.signal,
      })

      if (response.status === 401) {
        onAuthError?.()
        throw new Error('SSE authentication failed')
      }
      if (!response.ok || !response.body) {
        throw new Error(`SSE connection failed with ${response.status}`)
      }

      reconnectAttempt = 0
      onConnected?.()
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (!closed) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n')

        let boundary = buffer.indexOf('\n\n')
        while (boundary >= 0) {
          const block = buffer.slice(0, boundary)
          buffer = buffer.slice(boundary + 2)
          if (parseEventBlock(block).event === 'sync-update') onChange()
          boundary = buffer.indexOf('\n\n')
        }
      }
    } catch (error) {
      if (closed || (error instanceof DOMException && error.name === 'AbortError')) return
    } finally {
      controller = null
      if (!closed) {
        onDisconnected?.()
        scheduleReconnect()
      }
    }
  }

  const restart = () => {
    if (closed) return
    clearReconnectTimer()
    controller?.abort()
    void connect()
  }

  const close = () => {
    closed = true
    clearReconnectTimer()
    controller?.abort()
    controller = null
  }

  void connect()
  return { restart, close }
}
