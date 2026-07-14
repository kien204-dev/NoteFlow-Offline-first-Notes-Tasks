import type { PullResponse, PushPayload, PushResponse } from './types'
import type { AuthResponse } from '../../features/auth/authApi'

export type SyncApiOptions = {
  baseUrl?: string
  fetcher?: typeof fetch
  accessToken?: string
  clientId?: string
  refreshAccessToken?: () => Promise<AuthResponse>
  onTokenRefresh?: (response: AuthResponse) => void
  onAuthLost?: () => void
  isOnline?: () => boolean
}

export class SyncAuthError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'SyncAuthError'
    this.code = code
  }
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
      if (response.status === 401) return response
      lastError = new Error(`Sync request failed with ${response.status}`)
    } catch (error) {
      if (error instanceof SyncAuthError) {
        throw error
      }
      lastError = error
    }

    if (attempt < retries.length) {
      await wait(retries[attempt])
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Sync request failed')
}

export const createSyncApi = (options: SyncApiOptions = {}) => {
  const { baseUrl = defaultBaseUrl, fetcher = fetch } = options
  const normalizedBaseUrl = baseUrl.replace(/\/$/, '')
  const handleAuthResponse = async (
    response: Response,
    retry: (accessToken: string) => Promise<Response>,
    options: Pick<
      SyncApiOptions,
      'accessToken' | 'refreshAccessToken' | 'onTokenRefresh' | 'onAuthLost' | 'isOnline'
    >,
  ) => {
    if (response.status !== 401) return response

    const body = await response.json().catch(() => ({}))
    const code = typeof body.code === 'string' ? body.code : 'invalid_token'

    if (code === 'token_expired') {
      if (options.isOnline?.() === false) {
        throw new SyncAuthError(code, 'access token expired while offline')
      }

      if (options.refreshAccessToken) {
        try {
          const refreshResponse = await options.refreshAccessToken()
          options.onTokenRefresh?.(refreshResponse)
          return retry(refreshResponse.accessToken)
        } catch {
          options.onAuthLost?.()
          throw new SyncAuthError('refresh_failed', 'refresh token failed')
        }
      }
    }

    options.onAuthLost?.()
    throw new SyncAuthError(code, typeof body.error === 'string' ? body.error : 'authentication failed')
  }

  const authHeaders = (accessToken?: string) => ({
    'Content-Type': 'application/json',
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...(options.clientId ? { 'X-NoteFlow-Client-Id': options.clientId } : {}),
  })

  return {
    async push(payload: PushPayload): Promise<PushResponse> {
      const request = (accessToken = options.accessToken) =>
        fetcher(`${normalizedBaseUrl}/api/sync/push`, {
          method: 'POST',
          headers: authHeaders(accessToken),
          body: JSON.stringify(payload),
        })
      const response = await requestWithRetry(() =>
        request().then((response) => handleAuthResponse(response, request, options)),
      )

      return response.json()
    },

    async pull(since: string): Promise<PullResponse> {
      const request = (accessToken = options.accessToken) =>
        fetcher(`${normalizedBaseUrl}/api/sync/pull?since=${encodeURIComponent(since)}`, {
          headers: authHeaders(accessToken),
        })
      const response = await requestWithRetry(() =>
        request().then((response) => handleAuthResponse(response, request, options)),
      )

      return response.json()
    },
  }
}
