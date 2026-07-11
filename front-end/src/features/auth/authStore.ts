import { create } from 'zustand'
import type { AuthResponse } from './authApi'

export type AuthUser = {
  id: string
  email: string
}

type AuthState = {
  user: AuthUser | null
  accessToken: string | null
  isAuthenticated: boolean
  isLoading: boolean
  setAuth: (response: AuthResponse) => void
  setLoading: (isLoading: boolean) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isLoading: false,
  setAuth: ({ accessToken, user }) =>
    set({
      accessToken,
      user,
      isAuthenticated: true,
      isLoading: false,
    }),
  setLoading: (isLoading) => set({ isLoading }),
  clearAuth: () =>
    set({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,
    }),
}))
