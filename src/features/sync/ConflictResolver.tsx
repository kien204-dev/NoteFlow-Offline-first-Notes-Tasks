import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../lib/db/schema'
import {
  keepLocalNoteConflict,
  keepServerNoteConflict,
  saveMergedNoteConflict,
} from '../../lib/sync/conflictActions'
import type { ServerNote } from '../../lib/sync/types'

type ConflictResolverProps = {
  onClose: () => void
}

const splitTags = (value: string) =>
  value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)

export function ConflictResolver({ onClose }: ConflictResolverProps) {
  const conflicts = useLiveQuery(
    () => db.conflicts.where('entity').equals('note').sortBy('detectedAt'),
    [],
    [],
  )
  const [editingConflictId, setEditingConflictId] = useState<string | null>(null)
  const editingConflict = conflicts.find((conflict) => conflict.id === editingConflictId)
  const localNote = editingConflict?.localVersion as ServerNote | undefined
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [tags, setTags] = useState('')

  useEffect(() => {
    if (!localNote) return
    setTitle(localNote.title)
    setContent(localNote.content)
    setTags(localNote.tags.join(', '))
  }, [localNote])

  if (!conflicts.length) {
    return (
      <section className="rounded-sm border border-stone-200 bg-paper p-5 shadow-paper dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-serif text-2xl font-semibold">Không còn ghi chú cần xem lại</h2>
          <button type="button" onClick={onClose} className="rounded-sm border px-3 py-2 text-sm">
            Đóng
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="rounded-sm border border-amber-300 bg-paper p-5 shadow-paper dark:border-amber-900 dark:bg-zinc-900">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-200">
            Cần bạn chọn
          </p>
          <h2 className="font-serif text-2xl font-semibold">Ghi chú đã được sửa ở nơi khác</h2>
        </div>
        <button type="button" onClick={onClose} className="rounded-sm border px-3 py-2 text-sm">
          Đóng
        </button>
      </div>

      <div className="grid gap-4">
        {conflicts.map((conflict) => {
          const localVersion = conflict.localVersion as ServerNote
          const serverVersion = conflict.serverVersion as ServerNote
          const isEditing = editingConflictId === conflict.id

          return (
            <article key={conflict.id} className="rounded-sm border border-stone-200 p-4 dark:border-zinc-700">
              <h3 className="font-serif text-xl font-semibold">{localVersion.title}</h3>
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                <VersionPanel title="Bản của bạn" note={localVersion} />
                <VersionPanel title="Bản trên server" note={serverVersion} />
              </div>

              {isEditing ? (
                <form
                  className="mt-4 grid gap-3 border-t border-stone-200 pt-4 dark:border-zinc-800"
                  onSubmit={async (event) => {
                    event.preventDefault()
                    await saveMergedNoteConflict(conflict.id, {
                      title,
                      content,
                      tags: splitTags(tags),
                    })
                    setEditingConflictId(null)
                  }}
                >
                  <label className="text-sm font-medium">
                    Tiêu đề
                    <input
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      className="mt-2 w-full rounded-sm border border-stone-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
                    />
                  </label>
                  <label className="text-sm font-medium">
                    Nội dung
                    <textarea
                      value={content}
                      onChange={(event) => setContent(event.target.value)}
                      className="mt-2 min-h-32 w-full rounded-sm border border-stone-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
                    />
                  </label>
                  <label className="text-sm font-medium">
                    Tags
                    <input
                      value={tags}
                      onChange={(event) => setTags(event.target.value)}
                      className="mt-2 w-full rounded-sm border border-stone-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
                    />
                  </label>
                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingConflictId(null)}
                      className="rounded-sm border px-3 py-2 text-sm"
                    >
                      Hủy
                    </button>
                    <button type="submit" className="rounded-sm bg-ink px-3 py-2 text-sm font-semibold text-paper dark:bg-amber-200 dark:text-zinc-950">
                      Lưu bản đã chỉnh
                    </button>
                  </div>
                </form>
              ) : (
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => keepLocalNoteConflict(conflict.id)}
                    className="rounded-sm bg-ink px-3 py-2 text-sm font-semibold text-paper dark:bg-amber-200 dark:text-zinc-950"
                  >
                    Giữ bản của tôi
                  </button>
                  <button
                    type="button"
                    onClick={() => keepServerNoteConflict(conflict.id)}
                    className="rounded-sm border border-stone-300 px-3 py-2 text-sm dark:border-zinc-700"
                  >
                    Giữ bản trên server
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingConflictId(conflict.id)}
                    className="rounded-sm border border-stone-300 px-3 py-2 text-sm dark:border-zinc-700"
                  >
                    Chỉnh sửa thủ công
                  </button>
                </div>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}

function VersionPanel({ title, note }: { title: string; note: ServerNote }) {
  return (
    <div className="rounded-sm border border-stone-200 bg-stone-50 p-3 dark:border-zinc-700 dark:bg-zinc-950">
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-zinc-400">
        {title}
      </p>
      <h4 className="mt-2 font-serif text-lg font-semibold">{note.title}</h4>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-stone-700 dark:text-zinc-300">
        {note.content || 'Không có nội dung.'}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {note.tags.map((tag) => (
          <span key={tag} className="rounded-sm border px-2 py-1 text-xs dark:border-zinc-700">
            {tag}
          </span>
        ))}
      </div>
    </div>
  )
}
