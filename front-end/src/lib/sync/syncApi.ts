import type { PullResponse, PushPayload, PushResponse } from './types'

export type SyncApiOptions = {
  baseUrl?: string
  fetcher?: typeof fetch
}

const defaultBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000'

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms))

export const requestWithRetry = async (
  request: () => Promise<Response>,
  retries = [2_000, 4_000, 8_000],
): Promise<Response> => {
  let lastError: unknown

  for (let attempt = 0; attempt <= retries.length; attempt += 1) {
    try {
      const response = await request()
      if (response.ok) return response
      lastError = new Error(`Sync request failed with ${response.status}`)
    } catch (error) {
      lastError = error
    }

    if (attempt < retries.length) {
      await wait(retries[attempt])
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Sync request failed')
}

export const createSyncApi = ({ baseUrl = defaultBaseUrl, fetcher = fetch }: SyncApiOptions = {}) => {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, '')

  return {
    async push(payload: PushPayload): Promise<PushResponse> {
      const response = await requestWithRetry(() =>
        fetcher(`${normalizedBaseUrl}/api/sync/push`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }),
      )

      return response.json()
    },

    async pull(since: string): Promise<PullResponse> {
      const response = await requestWithRetry(() =>
        fetcher(`${normalizedBaseUrl}/api/sync/pull?since=${encodeURIComponent(since)}`),
      )

      return response.json()
    },
  }
}
