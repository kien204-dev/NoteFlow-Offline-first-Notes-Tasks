const toIso = (value) => (value ? new Date(value).toISOString() : null)
const toDate = (value) => (value == null ? null : new Date(value))
const sameVersion = (left, right) => toIso(left) === toIso(right)

const mapNoteFromDb = (row) => {
  const updatedAt = new Date(row.updated_at).toISOString()

  return {
    id: row.id,
    title: row.title,
    content: row.content,
    tags: row.tags ?? [],
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt,
    deletedAt: toIso(row.deleted_at),
    baseVersion: updatedAt,
  }
}

const mapTaskFromDb = (row) => {
  const updatedAt = new Date(row.updated_at).toISOString()

  return {
    id: row.id,
    title: row.title,
    notes: row.notes ?? '',
    dueDate: toIso(row.due_date),
    completed: row.completed,
    tags: row.tags ?? [],
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt,
    deletedAt: toIso(row.deleted_at),
    baseVersion: updatedAt,
  }
}

const normalizeArray = (value) => (Array.isArray(value) ? value : [])

const isNewer = (left, right) => new Date(left) > new Date(right)

const resolveTaskConflict = (existing, incoming) => {
  if (!existing || sameVersion(incoming.baseVersion, existing.updatedAt)) {
    return incoming
  }

  const newest = isNewer(existing.updatedAt, incoming.updatedAt) ? existing : incoming

  return {
    ...newest,
    completed: Boolean(existing.completed || incoming.completed),
    updatedAt: newest.updatedAt,
  }
}

export const createSyncRepository = (pool) => {
  const getNote = async (userId, id) => {
    // Legacy rows with user_id NULL are intentionally invisible to every user:
    // assigning them automatically would risk leaking data to the wrong account.
    const result = await pool.query('select * from notes where id = $1 and user_id = $2', [
      id,
      userId,
    ])
    return result.rows[0] ? mapNoteFromDb(result.rows[0]) : null
  }

  const getTask = async (userId, id) => {
    // Legacy rows with user_id NULL are intentionally invisible to every user:
    // assigning them automatically would risk leaking data to the wrong account.
    const result = await pool.query('select * from tasks where id = $1 and user_id = $2', [
      id,
      userId,
    ])
    return result.rows[0] ? mapTaskFromDb(result.rows[0]) : null
  }

  const upsertNote = async (userId, note) => {
    const existing = await getNote(userId, note.id)

    // Optimistic concurrency control: the client sends the server version it
    // edited from (`baseVersion`). If the server has moved since then, another
    // client changed this note and we must ask the user instead of overwriting.
    if (existing && !sameVersion(note.baseVersion, existing.updatedAt)) {
      return { status: 'conflict', record: existing }
    }

    await pool.query(
      `
        insert into notes (id, user_id, title, content, tags, created_at, updated_at, deleted_at)
        values ($1, $2, $3, $4, $5, $6, $7, $8)
        on conflict (id) do update set
          title = excluded.title,
          content = excluded.content,
          tags = excluded.tags,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at,
          deleted_at = excluded.deleted_at
        where notes.user_id = excluded.user_id
      `,
      [
        note.id,
        userId,
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

  const upsertTask = async (userId, task) => {
    const existing = await getTask(userId, task.id)
    // Tasks are intentionally simpler than notes: text loss is lower-risk, and
    // if either side completed a task we keep it completed. Other fields retain
    // the newest timestamp until step 6-style note conflicts are needed here.
    const taskToSave = resolveTaskConflict(existing, task)

    await pool.query(
      `
        insert into tasks (id, user_id, title, notes, due_date, completed, tags, created_at, updated_at, deleted_at)
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        on conflict (id) do update set
          title = excluded.title,
          notes = excluded.notes,
          due_date = excluded.due_date,
          completed = excluded.completed,
          tags = excluded.tags,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at,
          deleted_at = excluded.deleted_at
        where tasks.user_id = excluded.user_id
      `,
      [
        taskToSave.id,
        userId,
        taskToSave.title,
        taskToSave.notes ?? '',
        toDate(taskToSave.dueDate),
        Boolean(taskToSave.completed),
        normalizeArray(taskToSave.tags),
        toDate(taskToSave.createdAt),
        toDate(taskToSave.updatedAt),
        toDate(taskToSave.deletedAt),
      ],
    )

    return { status: 'saved', id: taskToSave.id }
  }

  const pullSince = async (userId, since) => {
    const sinceDate = toDate(since) ?? new Date(0)
    const [notes, tasks] = await Promise.all([
      pool.query(
        'select * from notes where user_id = $1 and updated_at > $2 order by updated_at asc',
        [userId, sinceDate],
      ),
      pool.query(
        'select * from tasks where user_id = $1 and updated_at > $2 order by updated_at asc',
        [userId, sinceDate],
      ),
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
