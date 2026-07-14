import { db, type NoteFlowDatabase } from './schema'

export const TRASH_RETENTION_DAYS = 30
export const TRASH_RETENTION_MS = TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1_000

export const purgeExpiredTrash = async (
  database: NoteFlowDatabase = db,
  now = Date.now(),
) => {
  const cutoff = now - TRASH_RETENTION_MS
  const [expiredNotes, expiredTasks] = await Promise.all([
    database.notes
      .filter((note) => note.deletedAt === null && note.trashedAt !== null && note.trashedAt <= cutoff)
      .toArray(),
    database.tasks
      .filter((task) => task.deletedAt === null && task.trashedAt !== null && task.trashedAt <= cutoff)
      .toArray(),
  ])

  await database.transaction('rw', database.notes, database.tasks, async () => {
    await Promise.all([
      ...expiredNotes.map((note) =>
        database.notes.put({
          ...note,
          deletedAt: now,
          updatedAt: now,
          dirty: true,
        }),
      ),
      ...expiredTasks.map((task) =>
        database.tasks.put({
          ...task,
          deletedAt: now,
          updatedAt: now,
          dirty: true,
        }),
      ),
    ])
  })

  return { notes: expiredNotes.length, tasks: expiredTasks.length }
}
