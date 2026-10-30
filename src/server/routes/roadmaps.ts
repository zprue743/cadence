import type Database from 'better-sqlite3'
import { and, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import type { AppDatabase } from '../db'
import { dependencies, roadmaps, tasks } from '../schema'
import type { DependencyRow, LoadResponse, RoadmapSummary, TaskRow } from '../../shared/types'

type SyncRecord = Record<string, unknown>

type StoreChanges = {
  added?: unknown
  updated?: unknown
  removed?: unknown
}

type SyncBody = {
  requestId?: number | string
  revision?: unknown
  tasks?: StoreChanges
  dependencies?: StoreChanges
}

type SyncSuccess = {
  success: true
  requestId?: number | string
  revision: number
  tasks?: { rows: SyncRecord[] }
  dependencies?: { rows: SyncRecord[] }
}

type SyncOutcome =
  | { kind: 'missing' }
  | { kind: 'conflict' }
  | { kind: 'ok'; body: SyncSuccess }

class SyncError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SyncError'
  }
}

const taskColumns: Record<string, string> = {
  name: 'name',
  startDate: 'start_date',
  endDate: 'end_date',
  duration: 'duration',
  percentDone: 'percent_done',
  note: 'note',
  manuallyScheduled: 'manually_scheduled',
  status: 'status',
  owner: 'owner',
  outcome: 'outcome',
  parentId: 'parent_id',
  parentIndex: 'parent_index',
}

const dependencyColumns: Record<string, string> = {
  fromEvent: 'from_event',
  toEvent: 'to_event',
  type: 'type',
  lag: 'lag',
}

function present(record: SyncRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key)
}

function asString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value
  if (value == null) return fallback
  return String(value)
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value)
  return null
}

function asBool(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value
  if (value === 0 || value === '0' || value === 'false') return false
  if (value === 1 || value === '1' || value === 'true') return true
  return fallback
}

function records(value: unknown): SyncRecord[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is SyncRecord => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
}

function removedIds(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  const ids: number[] = []
  for (const item of value) {
    const raw = typeof item === 'object' && item && 'id' in item ? item.id : item
    const id = asNumber(raw)
    if (id != null && Number.isInteger(id)) ids.push(id)
  }
  return ids
}

function resolveId(value: unknown, phantoms: Map<string, number>): number | null | undefined {
  if (value == null || value === '') return null
  if (typeof value === 'number' && Number.isInteger(value)) return value
  if (typeof value === 'string') {
    const mapped = phantoms.get(value)
    if (mapped != null) return mapped
    if (/^-?\d+$/.test(value)) return Number(value)
  }
  return undefined
}

function taskIdsFor(sqlite: Database.Database, roadmapId: number): Set<number> {
  const rows = sqlite.prepare('select id from tasks where roadmap_id = ?').all(roadmapId) as { id: number }[]
  return new Set(rows.map((row) => row.id))
}

function requireTask(id: number | null | undefined, taskIds: Set<number>): number {
  if (id == null || !taskIds.has(id)) throw new SyncError('Task is not on this roadmap')
  return id
}

function bindTaskValue(key: string, value: unknown, phantoms: Map<string, number>, taskIds: Set<number>): unknown {
  if (key === 'parentId') {
    const resolved = resolveId(value, phantoms)
    if (resolved === undefined) throw new SyncError('Parent task is not on this roadmap')
    if (resolved != null && !taskIds.has(resolved)) throw new SyncError('Parent task is not on this roadmap')
    return resolved
  }
  if (key === 'name' || key === 'note' || key === 'status' || key === 'owner' || key === 'outcome') {
    return asString(value)
  }
  if (key === 'startDate' || key === 'endDate') return value == null ? null : asString(value)
  if (key === 'duration' || key === 'percentDone') return asNumber(value)
  if (key === 'parentIndex') return asNumber(value) ?? 0
  if (key === 'manuallyScheduled') return asBool(value, true) ? 1 : 0
  return null
}

function removeTasks(sqlite: Database.Database, roadmapId: number, ids: number[]) {
  if (ids.length === 0) return
  const rows = sqlite.prepare('select id, parent_id from tasks where roadmap_id = ?').all(roadmapId) as {
    id: number
    parent_id: number | null
  }[]
  const children = new Map<number, number[]>()
  const owned = new Set<number>()
  for (const row of rows) {
    owned.add(row.id)
    if (row.parent_id == null) continue
    const list = children.get(row.parent_id) ?? []
    list.push(row.id)
    children.set(row.parent_id, list)
  }
  const doomed = new Set<number>()
  const stack = ids.filter((id) => owned.has(id))
  while (stack.length > 0) {
    const id = stack.pop()
    if (id == null || doomed.has(id)) continue
    doomed.add(id)
    for (const child of children.get(id) ?? []) stack.push(child)
  }
  const deleteDependency = sqlite.prepare(
    'delete from dependencies where roadmap_id = ? and (from_event = ? or to_event = ?)',
  )
  const deleteTask = sqlite.prepare('delete from tasks where id = ? and roadmap_id = ?')
  for (const id of doomed) {
    deleteDependency.run(roadmapId, id, id)
    deleteTask.run(id, roadmapId)
  }
}

function applySync(db: AppDatabase, sqlite: Database.Database, roadmapId: number, body: SyncBody): SyncOutcome {
  const roadmap = db.select().from(roadmaps).where(eq(roadmaps.id, roadmapId)).get()
  if (!roadmap) return { kind: 'missing' }
  if (Number(roadmap.revision) !== Number(body.revision)) return { kind: 'conflict' }

  const phantoms = new Map<string, number>()
  const taskRows: SyncRecord[] = []
  const dependencyRows: SyncRecord[] = []

  const removedDependencies = removedIds(body.dependencies?.removed)
  if (removedDependencies.length > 0) {
    const deleteDependency = sqlite.prepare('delete from dependencies where id = ? and roadmap_id = ?')
    for (const id of removedDependencies) deleteDependency.run(id, roadmapId)
  }
  removeTasks(sqlite, roadmapId, removedIds(body.tasks?.removed))

  let taskIds = taskIdsFor(sqlite, roadmapId)
  const pendingParents: { id: number; phantom: string }[] = []
  const insertTask = sqlite.prepare(
    `insert into tasks (
      roadmap_id, parent_id, parent_index, name, start_date, end_date, duration,
      percent_done, note, manually_scheduled, status, owner, outcome
    ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )

  for (const record of records(body.tasks?.added)) {
    const phantom = asString(record.$PhantomId)
    let parentId: number | null = null
    if (present(record, 'parentId') && record.parentId != null && record.parentId !== '') {
      const resolved = resolveId(record.parentId, phantoms)
      if (typeof record.parentId === 'string' && resolved == null && !/^-?\d+$/.test(record.parentId)) {
        pendingParents.push({ id: -1, phantom: record.parentId })
      } else {
        parentId = requireTask(resolved, taskIds)
      }
    }
    const inserted = insertTask.run(
      roadmapId,
      parentId,
      present(record, 'parentIndex') ? (asNumber(record.parentIndex) ?? 0) : 0,
      present(record, 'name') ? asString(record.name, 'New task') : 'New task',
      present(record, 'startDate') && record.startDate != null ? asString(record.startDate) : null,
      present(record, 'endDate') && record.endDate != null ? asString(record.endDate) : null,
      present(record, 'duration') ? asNumber(record.duration) : null,
      present(record, 'percentDone') ? (asNumber(record.percentDone) ?? 0) : 0,
      present(record, 'note') ? asString(record.note) : '',
      asBool(present(record, 'manuallyScheduled') ? record.manuallyScheduled : true, true) ? 1 : 0,
      present(record, 'status') ? asString(record.status, 'proposed') : 'proposed',
      present(record, 'owner') ? asString(record.owner) : '',
      present(record, 'outcome') ? asString(record.outcome) : '',
    )
    const id = Number(inserted.lastInsertRowid)
    if (pendingParents.length > 0 && pendingParents[pendingParents.length - 1]?.id === -1) {
      pendingParents[pendingParents.length - 1]!.id = id
    }
    if (phantom) phantoms.set(phantom, id)
    taskIds.add(id)
    taskRows.push({ $PhantomId: record.$PhantomId, id, parentId })
  }

  for (const pending of pendingParents) {
    const parentId = phantoms.get(pending.phantom)
    if (parentId == null || !taskIds.has(parentId)) throw new SyncError('Parent task is not on this roadmap')
    sqlite.prepare('update tasks set parent_id = ? where id = ? and roadmap_id = ?').run(parentId, pending.id, roadmapId)
    const row = taskRows.find((item) => item.id === pending.id)
    if (row) row.parentId = parentId
  }

  for (const record of records(body.tasks?.updated)) {
    const id = requireTask(resolveId(record.id, phantoms), taskIds)
    const sets: string[] = []
    const values: unknown[] = []
    let parentId: number | null | undefined
    for (const key of Object.keys(taskColumns)) {
      if (!present(record, key)) continue
      const bound = bindTaskValue(key, record[key], phantoms, taskIds)
      sets.push(`${taskColumns[key]} = ?`)
      values.push(bound)
      if (key === 'parentId') parentId = bound as number | null
    }
    if (sets.length === 0) continue
    const result = sqlite.prepare(`update tasks set ${sets.join(', ')} where id = ? and roadmap_id = ?`).run(...values, id, roadmapId)
    if (result.changes === 0) throw new SyncError('Task is not on this roadmap')
    if (parentId !== undefined) taskRows.push({ id, parentId })
  }

  taskIds = taskIdsFor(sqlite, roadmapId)
  const insertDependency = sqlite.prepare(
    'insert into dependencies (roadmap_id, from_event, to_event, type, lag) values (?, ?, ?, ?, ?)',
  )

  for (const record of records(body.dependencies?.added)) {
    const fromEvent = requireTask(resolveId(record.fromEvent, phantoms), taskIds)
    const toEvent = requireTask(resolveId(record.toEvent, phantoms), taskIds)
    const inserted = insertDependency.run(
      roadmapId,
      fromEvent,
      toEvent,
      present(record, 'type') ? (asNumber(record.type) ?? 2) : 2,
      present(record, 'lag') ? (asNumber(record.lag) ?? 0) : 0,
    )
    const id = Number(inserted.lastInsertRowid)
    const phantom = asString(record.$PhantomId)
    if (phantom) phantoms.set(phantom, id)
    dependencyRows.push({ $PhantomId: record.$PhantomId, id, fromEvent, toEvent })
  }

  for (const record of records(body.dependencies?.updated)) {
    const id = resolveId(record.id, phantoms)
    if (id == null) throw new SyncError('Dependency is not on this roadmap')
    const current = sqlite
      .prepare('select from_event, to_event from dependencies where id = ? and roadmap_id = ?')
      .get(id, roadmapId) as { from_event: number; to_event: number } | undefined
    if (!current) throw new SyncError('Dependency is not on this roadmap')

    const sets: string[] = []
    const values: unknown[] = []
    let fromEvent = current.from_event
    let toEvent = current.to_event
    for (const key of Object.keys(dependencyColumns)) {
      if (!present(record, key)) continue
      if (key === 'fromEvent' || key === 'toEvent') {
        const resolved = requireTask(resolveId(record[key], phantoms), taskIds)
        sets.push(`${dependencyColumns[key]} = ?`)
        values.push(resolved)
        if (key === 'fromEvent') fromEvent = resolved
        else toEvent = resolved
        continue
      }
      const numeric = asNumber(record[key]) ?? (key === 'lag' ? 0 : 2)
      sets.push(`${dependencyColumns[key]} = ?`)
      values.push(numeric)
    }
    requireTask(fromEvent, taskIds)
    requireTask(toEvent, taskIds)
    if (sets.length === 0) continue
    const result = sqlite
      .prepare(`update dependencies set ${sets.join(', ')} where id = ? and roadmap_id = ?`)
      .run(...values, id, roadmapId)
    if (result.changes === 0) throw new SyncError('Dependency is not on this roadmap')
    dependencyRows.push({ id, fromEvent, toEvent })
  }

  const revision = roadmap.revision + 1
  sqlite.prepare('update roadmaps set revision = ?, updated_at = ? where id = ?').run(revision, new Date().toISOString(), roadmapId)

  const response: SyncSuccess = { success: true, revision }
  if (body.requestId !== undefined) response.requestId = body.requestId
  if (taskRows.length > 0) response.tasks = { rows: taskRows }
  if (dependencyRows.length > 0) response.dependencies = { rows: dependencyRows }
  return { kind: 'ok', body: response }
}

function roadmapIdParam(value: string): number | null {
  if (!/^\d+$/.test(value)) return null
  const id = Number(value)
  return Number.isInteger(id) ? id : null
}

export function roadmapRoutes(db: AppDatabase, sqlite: Database.Database) {
  const app = new Hono()

  app.get('/', (c) => {
    const rows = db
      .select({
        id: roadmaps.id,
        name: roadmaps.name,
        description: roadmaps.description,
        revision: roadmaps.revision,
        updatedAt: roadmaps.updatedAt,
      })
      .from(roadmaps)
      .orderBy(roadmaps.id)
      .all()
    const list: RoadmapSummary[] = rows
    return c.json(list)
  })

  app.post('/', async (c) => {
    const incoming: unknown = await c.req.json().catch(() => null)
    const body = incoming && typeof incoming === 'object' && !Array.isArray(incoming) ? (incoming as SyncRecord) : {}
    const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : 'Untitled roadmap'
    const description = typeof body.description === 'string' ? body.description : ''
    const row = db
      .insert(roadmaps)
      .values({
        name,
        description,
        revision: 0,
        updatedAt: new Date().toISOString(),
      })
      .returning({
        id: roadmaps.id,
        name: roadmaps.name,
        description: roadmaps.description,
        revision: roadmaps.revision,
        updatedAt: roadmaps.updatedAt,
      })
      .get()
    return c.json(row, 201)
  })

  app.get('/:id/load', (c) => {
    const id = roadmapIdParam(c.req.param('id'))
    if (id == null) return c.json({ message: 'Not found' }, 404)
    const roadmap = db.select().from(roadmaps).where(eq(roadmaps.id, id)).get()
    if (!roadmap) return c.json({ message: 'Not found' }, 404)

    const taskRecords = db.select().from(tasks).where(eq(tasks.roadmapId, id)).orderBy(tasks.parentIndex, tasks.id).all()
    const parents = new Set(taskRecords.map((row) => row.parentId).filter((parentId): parentId is number => parentId != null))
    const taskPayload: TaskRow[] = taskRecords.map((row) => ({
      id: row.id,
      parentId: row.parentId,
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
      expanded: parents.has(row.id),
    }))
    const dependencyRecords = db.select().from(dependencies).where(eq(dependencies.roadmapId, id)).orderBy(dependencies.id).all()
    const dependencyPayload: DependencyRow[] = dependencyRecords.map((row) => ({
      id: row.id,
      fromEvent: row.fromEvent,
      toEvent: row.toEvent,
      type: row.type,
      lag: row.lag,
    }))
    const payload: LoadResponse = {
      success: true,
      revision: roadmap.revision,
      tasks: { rows: taskPayload },
      dependencies: { rows: dependencyPayload },
    }
    return c.json(payload)
  })

  app.post('/:id/sync', async (c) => {
    const id = roadmapIdParam(c.req.param('id'))
    if (id == null) return c.json({ message: 'Not found' }, 404)
    const incoming: unknown = await c.req.json().catch(() => null)
    const body: SyncBody = incoming && typeof incoming === 'object' && !Array.isArray(incoming) ? (incoming as SyncBody) : {}
    try {
      const outcome = sqlite.transaction(() => applySync(db, sqlite, id, body)).immediate()
      if (outcome.kind === 'missing') return c.json({ message: 'Not found' }, 404)
      if (outcome.kind === 'conflict') return c.json({ success: false })
      return c.json(outcome.body)
    } catch (error) {
      if (error instanceof SyncError) return c.json({ success: false })
      console.error(error)
      return c.json({ success: false }, 500)
    }
  })

  app.delete('/:id', (c) => {
    const id = roadmapIdParam(c.req.param('id'))
    if (id == null) return c.json({ message: 'Not found' }, 404)
    const roadmap = db.select({ id: roadmaps.id }).from(roadmaps).where(eq(roadmaps.id, id)).get()
    if (!roadmap) return c.json({ message: 'Not found' }, 404)
    sqlite.transaction(() => {
      db.delete(dependencies).where(eq(dependencies.roadmapId, id)).run()
      db.delete(tasks).where(eq(tasks.roadmapId, id)).run()
      db.delete(roadmaps).where(and(eq(roadmaps.id, id))).run()
    })()
    return c.json({ success: true })
  })

  return app
}
