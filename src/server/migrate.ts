import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import type { AppDatabase } from './db'

export function runMigrations(db: AppDatabase) {
  migrate(db, { migrationsFolder: 'drizzle' })
}
