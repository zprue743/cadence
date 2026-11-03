import { eq } from 'drizzle-orm'
import { dependencies, roadmaps, tasks, teams } from './schema'
import type { AppDatabase } from './db'

const sampleTasks = [
  {
    id: 1,
    parentId: null,
    parentIndex: 0,
    name: 'Platform',
    startDate: '2026-01-06',
    endDate: '2026-12-18',
    duration: null,
    status: 'planned',
    owner: 'Avery Chen',
    outcome: 'A roadmap the teams can share',
    successCriteria: 'Every team can open one shared roadmap',
    note: '',
  },
  {
    id: 2,
    parentId: 1,
    parentIndex: 0,
    name: 'Auth',
    startDate: '2026-02-02',
    endDate: '2026-06-30',
    duration: null,
    status: 'in progress',
    owner: 'Sam Ortiz',
    outcome: 'Sign-in for every product',
    successCriteria: 'A person can sign in to every product with one account',
    note: '',
  },
  {
    id: 3,
    parentId: 2,
    parentIndex: 0,
    name: 'Beta',
    startDate: '2026-04-15',
    endDate: null,
    duration: 0,
    status: 'proposed',
    owner: 'Sam Ortiz',
    outcome: 'Open beta',
    successCriteria: 'Design partners can use the beta without a support call',
    note: '',
  },
  {
    id: 4,
    parentId: 1,
    parentIndex: 1,
    name: 'Billing',
    startDate: '2026-07-01',
    endDate: '2026-11-20',
    duration: null,
    status: 'slipped',
    owner: 'Riley Ng',
    outcome: 'Invoices go out on time',
    successCriteria: 'Invoices leave within one business day of month end',
    note: 'Slipped after the vendor delay',
  },
]

export function seedIfEmpty(db: AppDatabase) {
  const existing = db.select({ id: roadmaps.id }).from(roadmaps).limit(1).all()
  if (existing.length > 0) return

  const team =
    db.select().from(teams).where(eq(teams.slug, 'platform')).get() ??
    db.insert(teams).values({ name: 'Platform', slug: 'platform' }).returning().get()
  if (!team) return

  const roadmap = db
    .insert(roadmaps)
    .values({
      teamId: team.id,
      name: 'Platform',
      description: '',
      revision: 0,
      updatedAt: new Date().toISOString(),
    })
    .returning({ id: roadmaps.id })
    .get()

  if (!roadmap) return

  db.insert(tasks)
    .values(
      sampleTasks.map((task) => ({
        ...task,
        roadmapId: roadmap.id,
        percentDone: 0,
        manuallyScheduled: true,
        successCriteria: task.successCriteria,
        gitlabUrl: '',
      })),
    )
    .run()

  db.insert(dependencies)
    .values({
      id: 1,
      roadmapId: roadmap.id,
      fromEvent: 2,
      toEvent: 4,
      type: 2,
      lag: 0,
    })
    .run()
}
