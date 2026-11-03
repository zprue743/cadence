export const dateHealthLabels = ['Completed', 'Overdue', 'On Track', 'No Target'] as const

export type DateHealth = (typeof dateHealthLabels)[number]

export type ScheduleInput = {
  status: string
  duration: number | null
  start: Date | string | null
  end: Date | string | null
}

export function localCalendarDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function todayCalendarDate(now = new Date()): string {
  return localCalendarDate(now)
}

function asDate(value: Date | string | null): Date | null {
  if (value == null || value === '') return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function isMilestone(input: ScheduleInput): boolean {
  if (input.duration === 0) return true
  const start = asDate(input.start)
  const end = asDate(input.end)
  return start != null && end != null && start.getTime() === end.getTime()
}

export function targetCalendarDate(input: ScheduleInput): string | null {
  if (isMilestone(input)) {
    const start = asDate(input.start)
    return start ? localCalendarDate(start) : null
  }
  const end = asDate(input.end)
  if (!end) return null
  return localCalendarDate(new Date(end.getTime() - 1))
}

export function dateHealth(input: ScheduleInput, today = todayCalendarDate()): DateHealth {
  if (input.status === 'done') return 'Completed'
  const target = targetCalendarDate(input)
  if (!target) return 'No Target'
  if (target < today) return 'Overdue'
  return 'On Track'
}

export function needsAttention(status: string, health: DateHealth): boolean {
  return health === 'Overdue' || status === 'slipped'
}

export function formatCalendarDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number)
  if (!year || !month || !day) return iso
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function scheduleLabel(input: ScheduleInput): string {
  const target = targetCalendarDate(input)
  if (!target) return 'No target date'
  if (isMilestone(input)) return formatCalendarDate(target)
  const start = asDate(input.start)
  const startLabel = start ? formatCalendarDate(localCalendarDate(start)) : 'No start'
  return `${startLabel} – ${formatCalendarDate(target)}`
}
