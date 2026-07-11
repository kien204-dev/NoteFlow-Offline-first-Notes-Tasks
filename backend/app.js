import cors from 'cors'
import express from 'express'
import { requireAuth } from './auth/requireAuth.js'
import { createAuthRouter } from './auth/routes.js'
import { logger } from './logger.js'
import { createSyncRepository } from './syncRepository.js'

const readSyncItems = (body, key) => (Array.isArray(body?.[key]) ? body[key] : [])

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

  app.use('/api/auth', createAuthRouter({ pool }))

  app.get('/api/health', (_request, response) => {
    response.json({ ok: true })
  })

  app.post('/api/sync/push', requireAuth, async (request, response, next) => {
    try {
      const notes = readSyncItems(request.body, 'notes')
      const tasks = readSyncItems(request.body, 'tasks')
      const saved = { notes: [], tasks: [] }
      const conflicts = { notes: [], tasks: [] }

      for (const note of notes) {
        const result = await syncRepository.upsertNote(request.userId, note)
        if (result.status === 'conflict') {
          conflicts.notes.push({ id: note.id, serverVersion: result.record })
          continue
        }
        saved.notes.push(result.id)
      }

      for (const task of tasks) {
        const result = await syncRepository.upsertTask(request.userId, task)
        if (result.status === 'saved') saved.tasks.push(result.id)
      }

      response.json({ saved, conflicts })
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/sync/pull', requireAuth, async (request, response, next) => {
    try {
      const since = typeof request.query.since === 'string' ? request.query.since : null
      response.json(await syncRepository.pullSince(request.userId, since))
    } catch (error) {
      next(error)
    }
  })

  app.use((error, _request, response, _next) => {
    logger.error(error)
    response.status(500).json({ error: 'Internal server error' })
  })

  return app
}
