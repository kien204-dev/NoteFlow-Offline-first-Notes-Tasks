import { useRegisterSW } from 'virtual:pwa-register/react'

export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
  })

  if (!needRefresh) return null

  return (
    <div
      className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-xl items-center justify-between gap-3 rounded-sm border border-stone-300 bg-paper px-4 py-3 text-sm shadow-paper dark:border-zinc-700 dark:bg-zinc-900"
      role="status"
      aria-live="polite"
    >
      <span className="font-medium text-ink dark:text-zinc-50">Có bản cập nhật mới</span>
      <button
        type="button"
        onClick={() => updateServiceWorker(true)}
        className="rounded-sm bg-ink px-3 py-2 text-sm font-semibold text-paper dark:bg-amber-200 dark:text-zinc-950"
      >
        Tải lại
      </button>
    </div>
  )
}
