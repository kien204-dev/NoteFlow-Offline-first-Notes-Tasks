import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Dexie from 'dexie'
import { createDatabase, type NoteFlowDatabase } from './schema'
import * as notesRepo from './notesRepo'
import * as tasksRepo from './tasksRepo'
import { purgeExpiredTrash, TRASH_RETENTION_MS } from './trashRepo'

let database: NoteFlowDatabase

beforeEach(() => {
  database = createDatabase(`noteflow-test-${crypto.randomUUID()}`)
})

afterEach(async () => {
  vi.restoreAllMocks()
  database.close()
  await database.delete()
})

describe('notesRepo', () => {
  it('sets timestamps and dirty flag on create and update', async () => {
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1_000)

    const note = await notesRepo.create(
      { title: 'Daily ledger', content: 'Paper-first thinking', tags: ['work'] },
      database,
    )

    expect(note.createdAt).toBe(1_000)
    expect(note.updatedAt).toBe(1_000)
    expect(note.dirty).toBe(true)

    nowSpy.mockReturnValue(2_000)
    const updated = await notesRepo.update(note.id, { content: 'Revised' }, database)

    expect(updated.updatedAt).toBe(2_000)
    expect(updated.dirty).toBe(true)
    expect(updated.createdAt).toBe(1_000)

  })

  it('soft-deletes without removing the row', async () => {
    const note = await notesRepo.create({ title: 'Archive me', content: '' }, database)

    await notesRepo.softDelete(note.id, database)

    expect(await notesRepo.list({}, database)).toEqual([])
    const stored = await notesRepo.getById(note.id, database)
    expect(stored?.deletedAt).toEqual(expect.any(Number))
    expect(stored?.dirty).toBe(true)
  })

  it('moves notes to trash without creating a sync tombstone', async () => {
    const note = await notesRepo.create({ title: 'Trash me', content: '' }, database)

    await notesRepo.trash(note.id, database)

    expect(await notesRepo.list({}, database)).toEqual([])
    expect(await notesRepo.listTrashed(database)).toHaveLength(1)
    const stored = await notesRepo.getById(note.id, database)
    expect(stored?.trashedAt).toEqual(expect.any(Number))
    expect(stored?.deletedAt).toBeNull()
  })

  it('restores notes from trash and permanently deletes with the existing tombstone', async () => {
    const note = await notesRepo.create({ title: 'Restore me', content: '' }, database)

    await notesRepo.trash(note.id, database)
    await notesRepo.restoreFromTrash(note.id, database)

    expect(await notesRepo.list({}, database)).toHaveLength(1)
    expect((await notesRepo.getById(note.id, database))?.trashedAt).toBeNull()

    await notesRepo.trash(note.id, database)
    await notesRepo.softDelete(note.id, database)

    const stored = await notesRepo.getById(note.id, database)
    expect(stored?.deletedAt).toEqual(expect.any(Number))
    expect(stored?.dirty).toBe(true)
  })

  it('searches and filters by tags on active notes', async () => {
    await notesRepo.create(
      { title: 'Interview prep', content: 'Explain Dexie', tags: ['career', 'sync'] },
      database,
    )
    await notesRepo.create(
      { title: 'Groceries', content: 'Coffee and rice', tags: ['home'] },
      database,
    )

    expect(await notesRepo.search('dexie', database)).toHaveLength(1)
    expect(await notesRepo.list({ tags: ['career'] }, database)).toHaveLength(1)
    expect(await notesRepo.list({ query: 'rice', tags: ['career'] }, database)).toHaveLength(0)
  })
})

describe('tasksRepo', () => {
  it('sets updatedAt and dirty when completing a task', async () => {
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(5_000)
    const task = await tasksRepo.create({ title: 'Ship local CRUD' }, database)

    nowSpy.mockReturnValue(6_000)
    const updated = await tasksRepo.update(task.id, { completed: true }, database)

    expect(updated.completed).toBe(true)
    expect(updated.updatedAt).toBe(6_000)
    expect(updated.dirty).toBe(true)
  })

  it('moves tasks to trash and restores them without tombstone deletion', async () => {
    const task = await tasksRepo.create({ title: 'Trash task' }, database)

    await tasksRepo.trash(task.id, database)

    expect(await tasksRepo.list({}, database)).toEqual([])
    expect(await tasksRepo.listTrashed(database)).toHaveLength(1)
    expect((await tasksRepo.getById(task.id, database))?.deletedAt).toBeNull()

    await tasksRepo.restoreFromTrash(task.id, database)
    expect(await tasksRepo.list({}, database)).toHaveLength(1)
    expect((await tasksRepo.getById(task.id, database))?.trashedAt).toBeNull()
  })

  it('auto-purges trashed notes and tasks after the retention window', async () => {
    const now = new Date('2026-07-14T00:00:00.000Z').getTime()
    const oldTrashTime = now - TRASH_RETENTION_MS - 1
    const recentTrashTime = now - TRASH_RETENTION_MS + 1
    const oldNote = await notesRepo.create({ title: 'Old trash note', content: '' }, database)
    const recentTask = await tasksRepo.create({ title: 'Recent trash task' }, database)
    const oldTask = await tasksRepo.create({ title: 'Old trash task' }, database)

    await database.notes.update(oldNote.id, { trashedAt: oldTrashTime })
    await database.tasks.update(recentTask.id, { trashedAt: recentTrashTime })
    await database.tasks.update(oldTask.id, { trashedAt: oldTrashTime })

    const result = await purgeExpiredTrash(database, now)

    expect(result).toEqual({ notes: 1, tasks: 1 })
    expect((await notesRepo.getById(oldNote.id, database))?.deletedAt).toBe(now)
    expect((await tasksRepo.getById(oldTask.id, database))?.deletedAt).toBe(now)
    expect((await tasksRepo.getById(recentTask.id, database))?.deletedAt).toBeNull()
  })

  it('creates tasks with due date and priority defaults', async () => {
    const task = await tasksRepo.create({
      title: 'Prepare release',
      dueDate: '2026-07-20',
      priority: 'high',
    }, database)

    expect(task.dueDate).toBe('2026-07-20')
    expect(task.priority).toBe('high')
    expect(task.subtasks).toEqual([])

    const defaultTask = await tasksRepo.create({ title: 'Default priority' }, database)
    expect(defaultTask.priority).toBe('medium')
    expect(defaultTask.subtasks).toEqual([])
  })

  it('creates and updates task subtasks', async () => {
    const task = await tasksRepo.create({
      title: 'Checklist task',
      subtasks: [{ id: 'subtask-1', title: 'Draft', completed: false }],
    }, database)

    expect(task.subtasks).toEqual([{ id: 'subtask-1', title: 'Draft', completed: false }])

    const updated = await tasksRepo.update(task.id, {
      subtasks: [{ id: 'subtask-1', title: 'Draft', completed: true }],
    }, database)

    expect(updated.subtasks).toEqual([{ id: 'subtask-1', title: 'Draft', completed: true }])
    expect(updated.dirty).toBe(true)
  })

  it('filters tasks by status, tags, and search text', async () => {
    await tasksRepo.create({
      title: 'Write sync tests',
      notes: 'Later step',
      tags: ['testing'],
      completed: false,
    }, database)
    await tasksRepo.create({
      title: 'Polish README',
      notes: 'Architecture notes',
      tags: ['docs'],
      completed: true,
    }, database)

    expect(await tasksRepo.list({ status: 'active' }, database)).toHaveLength(1)
    expect(await tasksRepo.list({ status: 'completed' }, database)).toHaveLength(1)
    expect(await tasksRepo.list({ tags: ['docs'], query: 'architecture' }, database)).toHaveLength(1)
  })

  it('filters by priority and sorts by due date or priority', async () => {
    const nowSpy = vi.spyOn(Date, 'now')
    nowSpy.mockReturnValueOnce(1_000)
    await tasksRepo.create({
      title: 'Low later',
      dueDate: '2026-07-30',
      priority: 'low',
    }, database)
    nowSpy.mockReturnValueOnce(2_000)
    await tasksRepo.create({
      title: 'High sooner',
      dueDate: '2026-07-12',
      priority: 'high',
    }, database)
    nowSpy.mockReturnValueOnce(3_000)
    await tasksRepo.create({
      title: 'Medium no date',
      priority: 'medium',
    }, database)

    expect((await tasksRepo.list({ priority: 'high' }, database)).map((task) => task.title)).toEqual([
      'High sooner',
    ])
    expect((await tasksRepo.list({ sortBy: 'dueDate' }, database)).map((task) => task.title)).toEqual([
      'High sooner',
      'Low later',
      'Medium no date',
    ])
    expect((await tasksRepo.list({ sortBy: 'priority' }, database)).map((task) => task.title)).toEqual([
      'High sooner',
      'Medium no date',
      'Low later',
    ])
  })

  it('upgrades old task records without losing data', async () => {
    const databaseName = `noteflow-upgrade-${crypto.randomUUID()}`
    const oldDatabase = new Dexie(databaseName)
    oldDatabase.version(3).stores({
      notes: '&id, updatedAt, deletedAt, dirty, baseVersion, *tags',
      tasks: '&id, updatedAt, deletedAt, dirty, baseVersion, completed, dueDate, *tags',
      syncMeta: '&key',
      conflicts: '&id, entity, detectedAt',
    })
    await oldDatabase.table('tasks').add({
      id: 'legacy-task',
      title: 'Legacy task',
      notes: 'kept',
      dueDate: null,
      completed: false,
      tags: ['old'],
      createdAt: 1_000,
      updatedAt: 1_000,
      deletedAt: null,
      dirty: false,
      baseVersion: null,
    })
    oldDatabase.close()

    const upgraded = createDatabase(databaseName)
    try {
      const task = await upgraded.tasks.get('legacy-task')
      expect(task).toMatchObject({
        title: 'Legacy task',
        notes: 'kept',
        priority: 'medium',
        subtasks: [],
      })
    } finally {
      upgraded.close()
      await upgraded.delete()
    }
  })
})
