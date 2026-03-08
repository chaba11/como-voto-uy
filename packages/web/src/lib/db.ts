import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from '@como-voto-uy/shared'

const rutaDb = process.env.DB_PATH || '../../como-voto.db'

let db: ReturnType<typeof drizzle<typeof schema>> | null = null
try {
  const sqlite = new Database(rutaDb, { readonly: true })
  db = drizzle(sqlite, { schema })
} catch {
  // DB not available — pages will show empty state
}

export { db }
