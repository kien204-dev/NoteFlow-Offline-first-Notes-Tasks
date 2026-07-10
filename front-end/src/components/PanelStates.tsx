type EmptyStateProps = {
  title: string
  description: string
  actionLabel: string
  onAction: () => void
}

export function EmptyState({ title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="rounded-sm border border-dashed border-stone-300 bg-paper/80 p-6 text-sm text-stone-600 shadow-paper dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
      <p className="font-serif text-xl font-semibold text-ink dark:text-stone-50">{title}</p>
      <p className="mt-2 max-w-prose leading-6">{description}</p>
      <button
        type="button"
        onClick={onAction}
        className="mt-4 rounded-sm bg-ink px-3 py-2 text-sm font-semibold text-paper transition hover:-translate-y-0.5 hover:bg-stone-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink active:translate-y-0 dark:bg-amber-200 dark:text-zinc-950"
      >
        {actionLabel}
      </button>
    </div>
  )
}

export function ListSkeleton({ label }: { label: string }) {
  return (
    <div
      className="grid gap-3 rounded-sm border border-stone-200 bg-paper/70 p-3 dark:border-zinc-800 dark:bg-zinc-900"
      role="status"
      aria-label={label}
    >
      {[0, 1, 2].map((item) => (
        <div key={item} className="rounded-sm border border-stone-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="h-4 w-2/3 animate-pulse rounded-sm bg-stone-200 dark:bg-zinc-800" />
          <div className="mt-3 h-3 w-full animate-pulse rounded-sm bg-stone-200 dark:bg-zinc-800" />
          <div className="mt-2 h-3 w-4/5 animate-pulse rounded-sm bg-stone-200 dark:bg-zinc-800" />
        </div>
      ))}
    </div>
  )
}
