import type { DomClassList, TaskModel, ViewPresetConfig } from '@bryntum/gantt'

export const statuses = ['proposed', 'planned', 'in progress', 'done', 'slipped'] as const

export type TaskStatus = (typeof statuses)[number]

export type ZoomId = 'month' | 'quarter' | 'year'

export function statusClass(status: string): string {
  return `cadence-status-${status.replace(/\s+/g, '-')}`
}

const statusClasses = statuses.map(statusClass)

export function taskRenderer({
  taskRecord,
  renderData,
}: {
  taskRecord: TaskModel
  renderData: { cls: DomClassList | string }
}): string {
  const status = String(taskRecord.get('status') ?? 'proposed')
  const active = statusClass(status)

  if (typeof renderData.cls === 'string') {
    const kept = renderData.cls.split(/\s+/).filter((name) => name && !statusClasses.includes(name))
    renderData.cls = [...kept, active].join(' ')
  } else {
    const flags: Record<string, boolean> = {}
    for (const name of statusClasses) flags[name] = name === active
    renderData.cls.assign(flags)
  }

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
  { type: 'name' as const, field: 'name', text: 'Name', width: 160 },
  { field: 'status', text: 'Status', width: 110 },
  { field: 'owner', text: 'Owner', width: 130 },
  { type: 'startdate' as const, field: 'startDate', text: 'Start', width: 110 },
  { type: 'enddate' as const, field: 'endDate', text: 'End', width: 110 },
]

export const subGridConfigs = {
  locked: { flex: 3, minWidth: 240 },
  normal: { flex: 2, minWidth: 180 },
}

export const tasks = [
  {
    id: 1,
    name: 'Platform',
    startDate: '2026-01-06',
    endDate: '2026-12-18',
    manuallyScheduled: true,
    status: 'planned',
    owner: 'Avery Chen',
    outcome: 'A roadmap the teams can share',
    note: '',
    expanded: true,
    children: [
      {
        id: 2,
        name: 'Auth',
        startDate: '2026-02-02',
        endDate: '2026-06-30',
        manuallyScheduled: true,
        status: 'in progress',
        owner: 'Sam Ortiz',
        outcome: 'Sign-in for every product',
        note: '',
        expanded: true,
        children: [
          {
            id: 3,
            name: 'Beta',
            startDate: '2026-04-15',
            duration: 0,
            manuallyScheduled: true,
            status: 'proposed',
            owner: 'Sam Ortiz',
            outcome: 'Open beta',
            note: '',
          },
        ],
      },
      {
        id: 4,
        name: 'Billing',
        startDate: '2026-07-01',
        endDate: '2026-11-20',
        manuallyScheduled: true,
        status: 'slipped',
        owner: 'Riley Ng',
        outcome: 'Invoices go out on time',
        note: 'Slipped after the vendor delay',
      },
    ],
  },
]

export const dependencies = [{ id: 1, fromEvent: 2, toEvent: 4, type: 2 }]
