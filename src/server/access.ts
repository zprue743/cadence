import { and, eq } from 'drizzle-orm'
import type { AppDatabase } from './db'
import { members, roadmaps } from './schema'

export function isEditorOfTeam(db: AppDatabase, email: string, teamId: number): boolean {
  const row = db
    .select({ id: members.id })
    .from(members)
    .where(and(eq(members.teamId, teamId), eq(members.email, email), eq(members.role, 'editor')))
    .get()
  return row != null
}

export function isEditorOfRoadmap(db: AppDatabase, email: string, roadmapId: number): boolean {
  const roadmap = db.select({ teamId: roadmaps.teamId }).from(roadmaps).where(eq(roadmaps.id, roadmapId)).get()
  if (!roadmap) return false
  return isEditorOfTeam(db, email, roadmap.teamId)
}

export function editorTeamIds(db: AppDatabase, email: string): Set<number> {
  const rows = db
    .select({ teamId: members.teamId })
    .from(members)
    .where(and(eq(members.email, email), eq(members.role, 'editor')))
    .all()
  return new Set(rows.map((row) => row.teamId))
}
