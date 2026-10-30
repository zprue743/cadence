export type RoadmapSummary = {
  id: number
  name: string
  description: string
  revision: number
  updatedAt: string
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
  expanded: boolean
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
