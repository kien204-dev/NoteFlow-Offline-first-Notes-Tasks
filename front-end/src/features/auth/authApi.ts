export type AuthResponse = {
  accessToken: string
  user: {
    id: string
    email: string
  }
}

export type AuthInput = {
  email: string
  password: string
}

const defaultBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000'

const parseAuthResponse = async (response: Response): Promise<AuthResponse> => {
  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : 'authentication failed')
  }

  return data
}

export const createAuthApi = ({
  baseUrl = defaultBaseUrl,
  fetcher = fetch,
}: {
  baseUrl?: string
  fetcher?: typeof fetch
} = {}) => {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, '')

  const request = (path: string, input: AuthInput) =>
    fetcher(`${normalizedBaseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(input),
    }).then(parseAuthResponse)

  return {
    register: (input: AuthInput) => request('/api/auth/register', input),
    login: (input: AuthInput) => request('/api/auth/login', input),
  }
}
