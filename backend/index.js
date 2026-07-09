import { createApp } from './app.js'
import { createPool } from './db.js'

const port = Number(process.env.PORT ?? 4000)
const pool = createPool()
const app = createApp({ pool })

app.listen(port, () => {
  console.log(`NoteFlow API listening on http://localhost:${port}`)
})
