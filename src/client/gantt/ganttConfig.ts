import type { DomClassList, TaskModel, ViewPresetConfig } from '@bryntum/gantt'
import { healthForTask } from './schedule'

export const statuses = ['proposed', 'planned', 'in progress', 'done', 'slipped'] as const

export type TaskStatus = (typeof statuses)[number]

export type ZoomId = 'month' | 'quarter' | 'year'

export function statusClass(status: string): string {
  return `cadence-status-${status.replace(/\s+/g, '-')}`
}

const statusClasses = statuses.map(statusClass)
const healthClasses = ['completed', 'overdue', 'on-track', 'no-target'].map((name) => `cadence-health-${name}`)

function assignClasses(renderData: { cls: DomClassList | string }, active: string[]) {
  const allowed = new Set([...statusClasses, ...healthClasses])
  if (typeof renderData.cls === 'string') {
    const kept = renderData.cls.split(/\s+/).filter((name) => name && !allowed.has(name))
    renderData.cls = [...kept, ...active].join(' ')
    return
  }
  const flags: Record<string, boolean> = {}
  for (const name of allowed) flags[name] = active.includes(name)
  renderData.cls.assign(flags)
}

export function taskRenderer({
  taskRecord,
  renderData,
}: {
  taskRecord: TaskModel
  renderData: { cls: DomClassList | string }
}): string {
  const status = String(taskRecord.get('status') ?? 'proposed')
  const health = healthForTask(taskRecord).toLowerCase().replace(/\s+/g, '-')
  assignClasses(renderData, [statusClass(status), `cadence-health-${health}`])
  return ''
}

export const quarterPreset: ViewPresetConfig = {
  id: 'quarter',
  base: 'year',
  tickWidth: 140,
  headers: [
    { unit: 'year', dateFormat: 'YYYY' },
    {
      unit: 'quarter',
      increment: 1,
      renderer: (startDate: Date) => `Q${Math.floor(startDate.getMonth() / 3) + 1}`,
    },
  ],
}

export const zoomPresets: Record<ZoomId, string | ViewPresetConfig> = {
  month: 'monthAndYear',
  quarter: quarterPreset,
  year: 'year',
}

export const columns = [
  { type: 'name' as const, field: 'name', text: 'Name', width: 180 },
  { field: 'outcome', text: 'Outcome', width: 180 },
  { field: 'successCriteria', text: 'Success criteria', width: 200 },
  { field: 'owner', text: 'Owner', width: 120 },
  { field: 'status', text: 'Status', width: 110 },
  {
    field: 'dateHealth',
    text: 'Date health',
    width: 120,
    editor: false,
    htmlEncode: false,
    renderer({ record }: { record: TaskModel }) {
      const health = healthForTask(record)
      const slug = health.toLowerCase().replace(/\s+/g, '-')
      return `<span class="health health-${slug}">${health}</span>`
    },
  },
  { type: 'startdate' as const, field: 'startDate', text: 'Start', width: 110 },
  { type: 'enddate' as const, field: 'endDate', text: 'End', width: 110 },
]

export const portfolioColumns = [
  { field: 'teamName', text: 'Team', width: 140, editor: false },
  { type: 'name' as const, field: 'name', text: 'Name', width: 200 },
  { field: 'status', text: 'Status', width: 110, editor: false },
  {
    field: 'dateHealth',
    text: 'Date health',
    width: 120,
    editor: false,
    htmlEncode: false,
    renderer({ record }: { record: TaskModel }) {
      const health = healthForTask(record)
      const slug = health.toLowerCase().replace(/\s+/g, '-')
      return `<span class="health health-${slug}">${health}</span>`
    },
  },
  { field: 'owner', text: 'Owner', width: 130, editor: false },
  { type: 'startdate' as const, field: 'startDate', text: 'Start', width: 110, editor: false },
  { type: 'enddate' as const, field: 'endDate', text: 'End', width: 110, editor: false },
]

export const subGridConfigs = {
  locked: { flex: 3, minWidth: 240 },
  normal: { flex: 2, minWidth: 180 },
}
