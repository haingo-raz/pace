import 'server-only'
import postgres from 'postgres'

if (!process.env.TIGER_DATABASE_URL) {
  throw new Error('TIGER_DATABASE_URL is not set')
}

declare global {
  var _sql: ReturnType<typeof postgres> | undefined
}

export const sql =
  global._sql ??
  postgres(process.env.TIGER_DATABASE_URL, {
    ssl: 'require',
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
  })

if (process.env.NODE_ENV !== 'production') global._sql = sql
