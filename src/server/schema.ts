import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const roadmaps = sqliteTable('roadmaps', {
  id: integer('id').primaryKey({ autoIncrement: true }),
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
