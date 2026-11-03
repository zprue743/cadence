import { and, eq } from 'drizzle-orm'
import type { AppDatabase } from './db'
import { members, teams } from './schema'

export function ensureLocalAccess(db: AppDatabase) {
  if (process.env.NODE_ENV === 'production') return
  if (process.env.PROXY_IDENTITY_SECRET?.trim()) return
  const email = process.env.DEV_EMAIL?.trim().toLowerCase()
  if (!email) return
  const teamRows = db.select().from(teams).all()
  for (const team of teamRows) {
    const existing = db
      .select({ id: members.id })
      .from(members)
      .where(and(eq(members.teamId, team.id), eq(members.email, email)))
      .get()
    if (existing) continue
    db.insert(members).values({ teamId: team.id, email, role: 'editor' }).run()
  }
}
