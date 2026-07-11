import { useId, useState } from 'react'
import { createAuthApi, type AuthResponse } from './authApi'
import { validateAuthInput } from './validation'

type LoginFormProps = {
  onSuccess?: (response: AuthResponse) => void
  authApi?: ReturnType<typeof createAuthApi>
}

export function LoginForm({ onSuccess, authApi = createAuthApi() }: LoginFormProps) {
  const emailId = useId()
  const passwordId = useId()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const validationError = validateAuthInput({ email, password })

    setSuccess(null)
    setError(validationError)
    if (validationError) return

    try {
      setIsSubmitting(true)
      const response = await authApi.login({ email: email.trim(), password })
      setSuccess(`Signed in as ${response.user.email}`)
      onSuccess?.(response)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'authentication failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="rounded-sm border border-stone-200 bg-paper p-5 shadow-paper dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-200">
        Welcome back
      </p>
      <h2 className="mt-1 font-serif text-2xl font-semibold text-ink dark:text-stone-50">
        Login
      </h2>

      <form onSubmit={handleSubmit} className="mt-5 grid gap-4" noValidate>
        <label htmlFor={emailId} className="text-sm font-medium text-stone-700 dark:text-zinc-300">
          Email
        </label>
        <input
          id={emailId}
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="rounded-sm border border-stone-300 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus-visible:outline-amber-200"
          autoComplete="email"
        />

        <label htmlFor={passwordId} className="text-sm font-medium text-stone-700 dark:text-zinc-300">
          Password
        </label>
        <input
          id={passwordId}
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="rounded-sm border border-stone-300 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus-visible:outline-amber-200"
          autoComplete="current-password"
        />

        <div aria-live="polite" className="min-h-6 text-sm">
          {error ? <p className="text-red-700 dark:text-red-300">{error}</p> : null}
          {success ? <p className="text-emerald-800 dark:text-emerald-200">{success}</p> : null}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-paper transition hover:-translate-y-0.5 hover:bg-stone-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-amber-200 dark:text-zinc-950"
        >
          {isSubmitting ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </section>
  )
}
