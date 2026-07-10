import { createApp } from './app.js'
import { createPool } from './db.js'
import { logger } from './logger.js'

const port = Number(process.env.PORT ?? 4000)
const pool = createPool()
const app = createApp({ pool })

app.listen(port, () => {
  logger.info(`NoteFlow API listening on http://localhost:${port}`)
})
