import { and, eq } from 'drizzle-orm'
import type { Context } from 'hono'
import type { Hono } from 'hono'
import type Database from 'better-sqlite3'
import type { AppDatabase } from './db'
import { isEditorOfRoadmap } from './access'
import { emailFromHeaders } from './identity'
import { snapshotDependencies, snapshots, snapshotTasks, tasks } from './schema'

type TaskCopy = {
  sourceTaskId: number
  name: string
  startDate: string | null
  endDate: string | null
  status: string
  owner: string
  outcome: string
  successCriteria: string
}

export type ChangeRow = {
  kind: 'added' | 'removed' | 'date' | 'status' | 'owner' | 'outcome' | 'success'
  sourceTaskId: number
  name: string
  before: string
  after: string
}

function caller(c: Context): string | null {
  return emailFromHeaders({
    get(name) {
      return c.req.header(name)
    },
  })
}

export function diffTasks(before: TaskCopy[], after: TaskCopy[]): ChangeRow[] {
  const previous = new Map(before.map((task) => [task.sourceTaskId, task]))
  const next = new Map(after.map((task) => [task.sourceTaskId, task]))
  const changes: ChangeRow[] = []
  for (const task of after) {
    const prior = previous.get(task.sourceTaskId)
    if (!prior) {
      changes.push({ kind: 'added', sourceTaskId: task.sourceTaskId, name: task.name, before: '', after: task.name })
      continue
    }
    if (prior.startDate !== task.startDate || prior.endDate !== task.endDate) {
      changes.push({
        kind: 'date',
        sourceTaskId: task.sourceTaskId,
        name: task.name,
        before: `${prior.startDate ?? ''} → ${prior.endDate ?? ''}`,
        after: `${task.startDate ?? ''} → ${task.endDate ?? ''}`,
      })
    }
    if (prior.status !== task.status) {
      changes.push({ kind: 'status', sourceTaskId: task.sourceTaskId, name: task.name, before: prior.status, after: task.status })
    }
    if (prior.owner !== task.owner) {
      changes.push({ kind: 'owner', sourceTaskId: task.sourceTaskId, name: task.name, before: prior.owner, after: task.owner })
    }
    if (prior.outcome !== task.outcome) {
      changes.push({ kind: 'outcome', sourceTaskId: task.sourceTaskId, name: task.name, before: prior.outcome, after: task.outcome })
    }
    if (prior.successCriteria !== task.successCriteria) {
      changes.push({
        kind: 'success',
        sourceTaskId: task.sourceTaskId,
        name: task.name,
        before: prior.successCriteria,
        after: task.successCriteria,
      })
    }
  }
  for (const task of before) {
    if (next.has(task.sourceTaskId)) continue
    changes.push({ kind: 'removed', sourceTaskId: task.sourceTaskId, name: task.name, before: task.name, after: '' })
  }
  return changes
}

export function captureSnapshot(
  sqlite: Database.Database,
  roadmapId: number,
  name: string,
  authorEmail: string,
): { id: number; sourceRevision: number } | { error: 'missing' } {
  return sqlite.transaction(() => {
    const roadmap = sqlite.prepare('select revision from roadmaps where id = ?').get(roadmapId) as { revision: number } | undefined
    if (!roadmap) return { error: 'missing' as const }
    const createdAt = new Date().toISOString()
    const inserted = sqlite
      .prepare(
        'insert into snapshots (roadmap_id, name, created_at, author_email, source_revision) values (?, ?, ?, ?, ?)',
      )
      .run(roadmapId, name, createdAt, authorEmail, roadmap.revision)
    const snapshotId = Number(inserted.lastInsertRowid)
    sqlite
      .prepare(
        `insert into snapshot_tasks (
          snapshot_id, source_task_id, parent_source_task_id, parent_index, name, start_date, end_date,
          duration, percent_done, note, manually_scheduled, status, owner, outcome, success_criteria, gitlab_url
        )
        select ?, id, parent_id, parent_index, name, start_date, end_date, duration, percent_done, note,
          manually_scheduled, status, owner, outcome, success_criteria, gitlab_url
        from tasks where roadmap_id = ?`,
      )
      .run(snapshotId, roadmapId)
    sqlite
      .prepare(
        `insert into snapshot_dependencies (
          snapshot_id, source_dependency_id, from_source_task_id, to_source_task_id, type, lag
        )
        select ?, id, from_event, to_event, type, lag from dependencies where roadmap_id = ?`,
      )
      .run(snapshotId, roadmapId)
    return { id: snapshotId, sourceRevision: roadmap.revision }
  }).immediate()
}

function liveTasks(db: AppDatabase, roadmapId: number): TaskCopy[] {
  return db
    .select()
    .from(tasks)
    .where(eq(tasks.roadmapId, roadmapId))
    .all()
    .map((row) => ({
      sourceTaskId: row.id,
      name: row.name,
      startDate: row.startDate,
      endDate: row.endDate,
      status: row.status,
      owner: row.owner,
      outcome: row.outcome,
      successCriteria: row.successCriteria,
    }))
}

function frozenTasks(db: AppDatabase, snapshotId: number): TaskCopy[] {
  return db
    .select()
    .from(snapshotTasks)
    .where(eq(snapshotTasks.snapshotId, snapshotId))
    .all()
    .map((row) => ({
      sourceTaskId: row.sourceTaskId,
      name: row.name,
      startDate: row.startDate,
      endDate: row.endDate,
      status: row.status,
      owner: row.owner,
      outcome: row.outcome,
      successCriteria: row.successCriteria,
    }))
}

function sideTasks(db: AppDatabase, roadmapId: number, token: string): TaskCopy[] | null {
  if (token === 'live') return liveTasks(db, roadmapId)
  if (!/^\d+$/.test(token)) return null
  const snapshotId = Number(token)
  const snapshot = db
    .select({ id: snapshots.id })
    .from(snapshots)
    .where(and(eq(snapshots.id, snapshotId), eq(snapshots.roadmapId, roadmapId)))
    .get()
  if (!snapshot) return null
  return frozenTasks(db, snapshotId)
}

function idParam(value: string): number | null {
  if (!/^\d+$/.test(value)) return null
  return Number(value)
}

export function registerSnapshotRoutes(app: Hono, db: AppDatabase, sqlite: Database.Database) {
  app.get('/:id/snapshots', (c) => {
    const email = caller(c)
    if (!email) return c.json({ message: 'Sign-in required' }, 401)
    const roadmapId = idParam(c.req.param('id'))
    if (roadmapId == null) return c.json({ message: 'Not found' }, 404)
    const rows = db.select().from(snapshots).where(eq(snapshots.roadmapId, roadmapId)).all()
    return c.json(
      rows
        .map((row) => ({
          id: row.id,
          name: row.name,
          createdAt: row.createdAt,
          authorEmail: row.authorEmail,
          sourceRevision: row.sourceRevision,
        }))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    )
  })

  app.post('/:id/snapshots', async (c) => {
    const email = caller(c)
    if (!email) return c.json({ message: 'Sign-in required' }, 401)
    const roadmapId = idParam(c.req.param('id'))
    if (roadmapId == null) return c.json({ message: 'Not found' }, 404)
    if (!isEditorOfRoadmap(db, email, roadmapId)) return c.json({ message: 'Only an editor can change this roadmap' }, 403)
    const incoming: unknown = await c.req.json().catch(() => null)
    const name =
      incoming && typeof incoming === 'object' && !Array.isArray(incoming) && typeof (incoming as { name?: unknown }).name === 'string'
        ? (incoming as { name: string }).name.trim()
        : ''
    if (!name) return c.json({ message: 'Name the snapshot' }, 400)
    const captured = captureSnapshot(sqlite, roadmapId, name, email)
    if ('error' in captured) return c.json({ message: 'Not found' }, 404)
    const row = db.select().from(snapshots).where(eq(snapshots.id, captured.id)).get()
    return c.json(row, 201)
  })

  app.get('/:id/snapshots/:snapshotId/load', (c) => {
    const email = caller(c)
    if (!email) return c.json({ message: 'Sign-in required' }, 401)
    const roadmapId = idParam(c.req.param('id'))
    const snapshotId = idParam(c.req.param('snapshotId'))
    if (roadmapId == null || snapshotId == null) return c.json({ message: 'Not found' }, 404)
    const snapshot = db
      .select()
      .from(snapshots)
      .where(and(eq(snapshots.id, snapshotId), eq(snapshots.roadmapId, roadmapId)))
      .get()
    if (!snapshot) return c.json({ message: 'Not found' }, 404)
    const taskRows = db.select().from(snapshotTasks).where(eq(snapshotTasks.snapshotId, snapshotId)).all()
    const parents = new Set(taskRows.map((row) => row.parentSourceTaskId).filter((id): id is number => id != null))
    const dependencyRows = db.select().from(snapshotDependencies).where(eq(snapshotDependencies.snapshotId, snapshotId)).all()
    return c.json({
      success: true,
      revision: snapshot.sourceRevision,
      snapshotName: snapshot.name,
      tasks: {
        rows: taskRows.map((row) => ({
          id: row.sourceTaskId,
          parentId: row.parentSourceTaskId,
          parentIndex: row.parentIndex,
          name: row.name,
          startDate: row.startDate,
          endDate: row.endDate,
          duration: row.duration,
          percentDone: row.percentDone,
          note: row.note,
          manuallyScheduled: row.manuallyScheduled,
          status: row.status,
          owner: row.owner,
          outcome: row.outcome,
          successCriteria: row.successCriteria,
          gitlabUrl: row.gitlabUrl,
          expanded: parents.has(row.sourceTaskId),
        })),
      },
      dependencies: {
        rows: dependencyRows.map((row) => ({
          id: row.sourceDependencyId,
          fromEvent: row.fromSourceTaskId,
          toEvent: row.toSourceTaskId,
          type: row.type,
          lag: row.lag,
        })),
      },
    })
  })

  app.delete('/:id/snapshots/:snapshotId', (c) => {
    const email = caller(c)
    if (!email) return c.json({ message: 'Sign-in required' }, 401)
    const roadmapId = idParam(c.req.param('id'))
    const snapshotId = idParam(c.req.param('snapshotId'))
    if (roadmapId == null || snapshotId == null) return c.json({ message: 'Not found' }, 404)
    if (!isEditorOfRoadmap(db, email, roadmapId)) return c.json({ message: 'Only an editor can change this roadmap' }, 403)
    const snapshot = db
      .select({ id: snapshots.id })
      .from(snapshots)
      .where(and(eq(snapshots.id, snapshotId), eq(snapshots.roadmapId, roadmapId)))
      .get()
    if (!snapshot) return c.json({ message: 'Not found' }, 404)
    db.delete(snapshots).where(eq(snapshots.id, snapshotId)).run()
    return c.json({ success: true })
  })

  app.get('/:id/compare', (c) => {
    const email = caller(c)
    if (!email) return c.json({ message: 'Sign-in required' }, 401)
    const roadmapId = idParam(c.req.param('id'))
    if (roadmapId == null) return c.json({ message: 'Not found' }, 404)
    const from = c.req.query('from') ?? ''
    const to = c.req.query('to') ?? 'live'
    const before = sideTasks(db, roadmapId, from)
    const after = sideTasks(db, roadmapId, to)
    if (!before || !after) return c.json({ message: 'Not found' }, 404)
    return c.json({ changes: diffTasks(before, after) })
  })
}
