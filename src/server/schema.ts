import { integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const teams = sqliteTable('teams', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
})

export const members = sqliteTable(
  'members',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    teamId: integer('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    role: text('role').notNull(),
  },
  (table) => [uniqueIndex('members_team_email').on(table.teamId, table.email)],
)

export const roadmaps = sqliteTable('roadmaps', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  revision: integer('revision').notNull().default(0),
  updatedAt: text('updated_at').notNull(),
})

export const tasks = sqliteTable('tasks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  roadmapId: integer('roadmap_id')
    .notNull()
    .references(() => roadmaps.id, { onDelete: 'cascade' }),
  parentId: integer('parent_id'),
  parentIndex: integer('parent_index').notNull().default(0),
  name: text('name').notNull(),
  startDate: text('start_date'),
  endDate: text('end_date'),
  duration: real('duration'),
  percentDone: real('percent_done').notNull().default(0),
  note: text('note').notNull().default(''),
  manuallyScheduled: integer('manually_scheduled', { mode: 'boolean' }).notNull().default(true),
  status: text('status').notNull().default('proposed'),
  owner: text('owner').notNull().default(''),
  outcome: text('outcome').notNull().default(''),
  successCriteria: text('success_criteria').notNull().default(''),
  gitlabUrl: text('gitlab_url').notNull().default(''),
})

export const dependencies = sqliteTable('dependencies', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  roadmapId: integer('roadmap_id')
    .notNull()
    .references(() => roadmaps.id, { onDelete: 'cascade' }),
  fromEvent: integer('from_event').notNull(),
  toEvent: integer('to_event').notNull(),
  type: integer('type').notNull().default(2),
  lag: real('lag').notNull().default(0),
})

export const snapshots = sqliteTable('snapshots', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  roadmapId: integer('roadmap_id')
    .notNull()
    .references(() => roadmaps.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  createdAt: text('created_at').notNull(),
  authorEmail: text('author_email').notNull(),
  sourceRevision: integer('source_revision').notNull(),
})

export const snapshotTasks = sqliteTable('snapshot_tasks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  snapshotId: integer('snapshot_id')
    .notNull()
    .references(() => snapshots.id, { onDelete: 'cascade' }),
  sourceTaskId: integer('source_task_id').notNull(),
  parentSourceTaskId: integer('parent_source_task_id'),
  parentIndex: integer('parent_index').notNull().default(0),
  name: text('name').notNull(),
  startDate: text('start_date'),
  endDate: text('end_date'),
  duration: real('duration'),
  percentDone: real('percent_done').notNull().default(0),
  note: text('note').notNull().default(''),
  manuallyScheduled: integer('manually_scheduled', { mode: 'boolean' }).notNull().default(true),
  status: text('status').notNull().default('proposed'),
  owner: text('owner').notNull().default(''),
  outcome: text('outcome').notNull().default(''),
  successCriteria: text('success_criteria').notNull().default(''),
  gitlabUrl: text('gitlab_url').notNull().default(''),
})

export const snapshotDependencies = sqliteTable('snapshot_dependencies', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  snapshotId: integer('snapshot_id')
    .notNull()
    .references(() => snapshots.id, { onDelete: 'cascade' }),
  sourceDependencyId: integer('source_dependency_id').notNull(),
  fromSourceTaskId: integer('from_source_task_id').notNull(),
  toSourceTaskId: integer('to_source_task_id').notNull(),
  type: integer('type').notNull().default(2),
  lag: real('lag').notNull().default(0),
})
