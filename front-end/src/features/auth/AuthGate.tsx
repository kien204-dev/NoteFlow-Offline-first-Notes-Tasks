import { LoginForm } from './LoginForm'
import { RegisterForm } from './RegisterForm'
import type { AuthResponse } from './authApi'
import { useAuthStore } from './authStore'
import { navigateTo, type AppRoute } from './navigation'

type AuthGateProps = {
  route: AppRoute
}

export function AuthGate({ route }: AuthGateProps) {
  const setAuth = useAuthStore((state) => state.setAuth)
  const isRegister = route === '/register'
  const handleSuccess = (response: AuthResponse) => {
    setAuth(response)
    navigateTo('/')
  }

  return (
    <main className="min-h-screen bg-stone-100 px-4 py-8 text-ink dark:bg-zinc-950 dark:text-zinc-50">
      <section className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-5xl items-center gap-8 lg:grid-cols-[1fr_420px]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-200">
            Offline-first ledger
          </p>
          <h1 className="mt-2 font-serif text-4xl font-semibold sm:text-5xl">NoteFlow</h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-stone-600 dark:text-zinc-400">
            Work offline without worry - everything saves on your device first and syncs when you sign in.
          </p>
          <button
            type="button"
            onClick={() => navigateTo(isRegister ? '/login' : '/register')}
            className="mt-6 text-sm font-semibold text-amber-800 underline decoration-amber-300 underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink dark:text-amber-200"
          >
            {isRegister ? 'Already have an account? Sign in' : 'Need an account? Register'}
          </button>
        </div>

        {isRegister ? (
          <RegisterForm onSuccess={handleSuccess} />
        ) : (
          <LoginForm onSuccess={handleSuccess} />
        )}
      </section>
    </main>
  )
}
