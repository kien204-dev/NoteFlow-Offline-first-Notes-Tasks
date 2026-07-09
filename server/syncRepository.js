const toIso = (value) => (value ? new Date(value).toISOString() : null)
const toDate = (value) => (value == null ? null : new Date(value))

const mapNoteFromDb = (row) => ({
  id: row.id,
  title: row.title,
  content: row.content,
  tags: row.tags ?? [],
  createdAt: new Date(row.created_at).toISOString(),
  updatedAt: new Date(row.updated_at).toISOString(),
  deletedAt: toIso(row.deleted_at),
})

const mapTaskFromDb = (row) => ({
  id: row.id,
  title: row.title,
  notes: row.notes ?? '',
  dueDate: toIso(row.due_date),
  completed: row.completed,
  tags: row.tags ?? [],
  createdAt: new Date(row.created_at).toISOString(),
  updatedAt: new Date(row.updated_at).toISOString(),
  deletedAt: toIso(row.deleted_at),
})

const normalizeArray = (value) => (Array.isArray(value) ? value : [])

export const createSyncRepository = (pool) => {
  const getNote = async (id) => {
    const result = await pool.query('select * from notes where id = $1', [id])
    return result.rows[0] ? mapNoteFromDb(result.rows[0]) : null
  }

  const getTask = async (id) => {
    const result = await pool.query('select * from tasks where id = $1', [id])
    return result.rows[0] ? mapTaskFromDb(result.rows[0]) : null
  }

  const upsertNote = async (note) => {
    const existing = await getNote(note.id)

    // Temporary step-5 last-write-wins: the row with the newest updatedAt wins.
    // Step 6 can replace this decision point with explicit conflict records.
    if (existing && new Date(existing.updatedAt) > new Date(note.updatedAt)) {
      return { status: 'server-won', record: existing }
    }

    await pool.query(
      `
        insert into notes (id, title, content, tags, created_at, updated_at, deleted_at)
        values ($1, $2, $3, $4, $5, $6, $7)
        on conflict (id) do update set
          title = excluded.title,
          content = excluded.content,
          tags = excluded.tags,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at,
          deleted_at = excluded.deleted_at
      `,
      [
        note.id,
        note.title,
        note.content ?? '',
        normalizeArray(note.tags),
        toDate(note.createdAt),
        toDate(note.updatedAt),
        toDate(note.deletedAt),
      ],
    )

    return { status: 'saved', id: note.id }
  }

  const upsertTask = async (task) => {
    const existing = await getTask(task.id)

    if (existing && new Date(existing.updatedAt) > new Date(task.updatedAt)) {
      return { status: 'server-won', record: existing }
    }

    await pool.query(
      `
        insert into tasks (id, title, notes, due_date, completed, tags, created_at, updated_at, deleted_at)
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        on conflict (id) do update set
          title = excluded.title,
          notes = excluded.notes,
          due_date = excluded.due_date,
          completed = excluded.completed,
          tags = excluded.tags,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at,
          deleted_at = excluded.deleted_at
      `,
      [
        task.id,
        task.title,
        task.notes ?? '',
        toDate(task.dueDate),
        Boolean(task.completed),
        normalizeArray(task.tags),
        toDate(task.createdAt),
        toDate(task.updatedAt),
        toDate(task.deletedAt),
      ],
    )

    return { status: 'saved', id: task.id }
  }

  const pullSince = async (since) => {
    const sinceDate = toDate(since) ?? new Date(0)
    const [notes, tasks] = await Promise.all([
      pool.query('select * from notes where updated_at > $1 order by updated_at asc', [sinceDate]),
      pool.query('select * from tasks where updated_at > $1 order by updated_at asc', [sinceDate]),
    ])

    return {
      notes: notes.rows.map(mapNoteFromDb),
      tasks: tasks.rows.map(mapTaskFromDb),
    }
  }

  return {
    upsertNote,
    upsertTask,
    pullSince,
  }
}
