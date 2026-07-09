import { useEffect, useState } from 'react'

export function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(() => !window.navigator.onLine)

  useEffect(() => {
    const updateStatus = () => setIsOffline(!window.navigator.onLine)

    window.addEventListener('online', updateStatus)
    window.addEventListener('offline', updateStatus)

    return () => {
      window.removeEventListener('online', updateStatus)
      window.removeEventListener('offline', updateStatus)
    }
  }, [])

  if (!isOffline) return null

  return (
    <p className="rounded-sm border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
      Đang offline — thay đổi sẽ lưu tạm trên máy
    </p>
  )
}
