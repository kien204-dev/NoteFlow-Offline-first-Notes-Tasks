import cors from 'cors'
import express from 'express'
import { createSyncRepository } from './syncRepository.js'

export const createApp = ({ pool, allowedOrigins } = {}) => {
  const app = express()
  const syncRepository = createSyncRepository(pool)

  app.use(
    cors({
      origin: allowedOrigins ?? [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        process.env.FRONTEND_ORIGIN,
      ].filter(Boolean),
    }),
  )
  app.use(express.json({ limit: '1mb' }))

  app.get('/api/health', (_request, response) => {
    response.json({ ok: true })
  })

  app.post('/api/sync/push', async (request, response, next) => {
    try {
      const notes = Array.isArray(request.body?.notes) ? request.body.notes : []
      const tasks = Array.isArray(request.body?.tasks) ? request.body.tasks : []
      const saved = { notes: [], tasks: [] }
      const conflicts = { notes: [], tasks: [] }

      for (const note of notes) {
        const result = await syncRepository.upsertNote(note)
        if (result.status === 'saved') saved.notes.push(result.id)
        if (result.status === 'conflict') {
          conflicts.notes.push({ id: note.id, serverVersion: result.record })
        }
      }

      for (const task of tasks) {
        const result = await syncRepository.upsertTask(task)
        if (result.status === 'saved') saved.tasks.push(result.id)
      }

      response.json({ saved, conflicts })
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/sync/pull', async (request, response, next) => {
    try {
      const since = typeof request.query.since === 'string' ? request.query.since : null
      response.json(await syncRepository.pullSince(since))
    } catch (error) {
      next(error)
    }
  })

  app.use((error, _request, response, _next) => {
    console.error(error)
    response.status(500).json({ error: 'Internal server error' })
  })

  return app
}
