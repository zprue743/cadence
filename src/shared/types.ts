export type RoadmapSummary = {
  id: number
  teamId: number
  teamName: string
  name: string
  description: string
  revision: number
  updatedAt: string
  startDate: string | null
  endDate: string | null
  canEdit: boolean
}

export type AiStatus = {
  enabled: boolean
}

export type TaskRow = {
  id: number
  parentId: number | null
  parentIndex: number
  name: string
  startDate: string | null
  endDate: string | null
  duration: number | null
  percentDone: number
  note: string
  manuallyScheduled: boolean
  status: string
  owner: string
  outcome: string
  successCriteria: string
  gitlabUrl: string
  expanded: boolean
  teamName?: string
  roadmapName?: string
}

export type DependencyRow = {
  id: number
  fromEvent: number
  toEvent: number
  type: number
  lag: number
}

export type LoadResponse = {
  success: true
  revision: number
  tasks: { rows: TaskRow[] }
  dependencies: { rows: DependencyRow[] }
}

export type SnapshotSummary = {
  id: number
  name: string
  createdAt: string
  authorEmail: string
  sourceRevision: number
}

export type ChangeKind = 'added' | 'removed' | 'date' | 'status' | 'owner' | 'outcome' | 'success'

export type ChangeRow = {
  kind: ChangeKind
  sourceTaskId: number
  name: string
  before: string
  after: string
}

export type GitlabSignal = {
  title: string
  state: string
  opened: number | null
  closed: number | null
  dueDate: string | null
  updatedAt: string | null
  webUrl: string
}
