import Database, { type Database as DatabaseType } from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from '@como-voto-uy/shared'

export function crearConexion(rutaDb: string): { db: ReturnType<typeof drizzle>; sqlite: DatabaseType } {
  const sqlite = new Database(rutaDb)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  const db = drizzle(sqlite, { schema })
  return { db, sqlite }
}

export function crearConexionEnMemoria(): { db: ReturnType<typeof drizzle>; sqlite: DatabaseType } {
  const sqlite = new Database(':memory:')
  sqlite.pragma('foreign_keys = ON')
  const db = drizzle(sqlite, { schema })
  return { db, sqlite }
}

export type DB = ReturnType<typeof crearConexion>['db']
