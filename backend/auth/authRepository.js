import { randomUUID } from 'node:crypto'

const mapUser = (row) => ({
  id: row.id,
  email: row.email,
  passwordHash: row.password_hash,
  createdAt: new Date(row.created_at).toISOString(),
  updatedAt: new Date(row.updated_at).toISOString(),
})

export const createAuthRepository = (pool) => ({
  async findUserByEmail(email) {
    const result = await pool.query('select * from users where email = $1', [email])
    return result.rows[0] ? mapUser(result.rows[0]) : null
  },

  async createUser({ email, passwordHash }) {
    const id = randomUUID()
    const now = new Date()
    const result = await pool.query(
      `
        insert into users (id, email, password_hash, created_at, updated_at)
        values ($1, $2, $3, $4, $4)
        returning *
      `,
      [id, email, passwordHash, now],
    )

    return mapUser(result.rows[0])
  },
})
