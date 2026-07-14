import { useEffect } from 'react'
import { purgeExpiredTrash } from '../../lib/db/trashRepo'

const AUTO_PURGE_INTERVAL_MS = 60 * 60 * 1_000

export function useTrashAutoPurge() {
  useEffect(() => {
    void purgeExpiredTrash()
    const intervalId = window.setInterval(() => {
      void purgeExpiredTrash()
    }, AUTO_PURGE_INTERVAL_MS)

    return () => window.clearInterval(intervalId)
  }, [])
}
