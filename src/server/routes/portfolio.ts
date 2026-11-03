import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import type { AppDatabase } from '../db'
import { emailFromHeaders } from '../identity'
import { roadmaps, tasks, teams } from '../schema'
import type { LoadResponse, TaskRow } from '../../shared/types'

export function portfolioRoutes(db: AppDatabase) {
  const app = new Hono()

  app.get('/load', (c) => {
    const email = emailFromHeaders({
      get(name) {
        return c.req.header(name)
      },
    })
    if (!email) return c.json({ message: 'Sign-in required' }, 401)
    const rows = db
      .select({
        task: tasks,
        teamName: teams.name,
        roadmapName: roadmaps.name,
      })
      .from(tasks)
      .innerJoin(roadmaps, eq(tasks.roadmapId, roadmaps.id))
      .innerJoin(teams, eq(roadmaps.teamId, teams.id))
      .all()
      .filter((row) => row.task.parentId == null)
    const payload: LoadResponse = {
      success: true,
      revision: 0,
      tasks: {
        rows: rows.map((row): TaskRow => ({
          id: row.task.id,
          parentId: null,
          parentIndex: row.task.parentIndex,
          name: row.task.name,
          startDate: row.task.startDate,
          endDate: row.task.endDate,
          duration: row.task.duration,
          percentDone: row.task.percentDone,
          note: row.task.note,
          manuallyScheduled: row.task.manuallyScheduled,
          status: row.task.status,
          owner: row.task.owner,
          outcome: row.task.outcome,
          successCriteria: row.task.successCriteria,
          gitlabUrl: row.task.gitlabUrl,
          expanded: false,
          teamName: row.teamName,
          roadmapName: row.roadmapName,
        })),
      },
      dependencies: { rows: [] },
    }
    return c.json(payload)
  })

  return app
}
