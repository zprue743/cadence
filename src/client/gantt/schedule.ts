import type { Gantt, TaskModel } from '@bryntum/gantt'
import {
  dateHealth,
  formatCalendarDate,
  localCalendarDate,
  needsAttention,
  scheduleLabel,
  targetCalendarDate,
  type DateHealth,
  type ScheduleInput,
} from '../../shared/dateHealth'

export function scheduleFromTask(task: TaskModel): ScheduleInput {
  const duration = task.duration
  return {
    status: String(task.get('status') ?? 'proposed'),
    duration: typeof duration === 'number' ? duration : null,
    start: task.startDate ?? null,
    end: task.endDate ?? null,
  }
}

export function healthForTask(task: TaskModel): DateHealth {
  return dateHealth(scheduleFromTask(task))
}

export function taskNeedsAttention(task: TaskModel): boolean {
  const schedule = scheduleFromTask(task)
  return needsAttention(schedule.status, dateHealth(schedule))
}

export function refreshDerived(task: TaskModel) {
  const schedule = scheduleFromTask(task)
  const target = targetCalendarDate(schedule)
  task.set('dateHealth', dateHealth(schedule), true)
  task.set('targetDate', target ? formatCalendarDate(target) : '', true)
  if (schedule.duration === 0) task.set('rollup', true, true)
}

export function tooltipHtml(task: TaskModel): string {
  const schedule = scheduleFromTask(task)
  const health = dateHealth(schedule)
  const outcome = text(task, 'outcome') || 'No outcome'
  const criteria = text(task, 'successCriteria') || 'No success criteria'
  const owner = text(task, 'owner') || 'Unassigned'
  const status = text(task, 'status')
  return `<section class="cadence-tip"><h3>${escapeHtml(task.name)}</h3><p>${escapeHtml(outcome)}</p><p>${escapeHtml(criteria)}</p><p><span class="cadence-tip-status cadence-status-${escapeHtml(status).replace(/\s+/g, '-')}">${escapeHtml(status)}</span> · ${escapeHtml(health)} · ${escapeHtml(owner)}</p><p>${escapeHtml(scheduleLabel(schedule))}</p></section>`
}

function text(task: TaskModel, field: string): string {
  return String(task.get(field) ?? '')
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    if (char === '&') return '&amp;'
    if (char === '<') return '&lt;'
    if (char === '>') return '&gt;'
    if (char === '"') return '&quot;'
    return '&#39;'
  })
}

export function fitParentShade(chart: Gantt) {
  chart.element.querySelectorAll<HTMLElement>('.b-parent-area').forEach((el) => {
    const id = el.dataset.taskId?.replace(/^parent-area-/, '')
    if (!id) return
    const task = chart.project.taskStore.getById(id)
    const children = (task as { children?: { startDate?: Date; endDate?: Date }[] } | null)?.children
    if (!children?.length) return
    let start: Date | null = null
    let end: Date | null = null
    for (const child of Array.from(children)) {
      const childStart = child.startDate instanceof Date ? child.startDate : null
      const childEnd = child.endDate instanceof Date ? child.endDate : childStart
      if (childStart && (!start || childStart < start)) start = childStart
      if (childEnd && (!end || childEnd > end)) end = childEnd
    }
    if (!start || !end) return
    const left = chart.getCoordinateFromDate(start)
    const right = chart.getCoordinateFromDate(end)
    if (!Number.isFinite(left) || !Number.isFinite(right)) return
    el.style.insetInlineStart = `${left}px`
    el.style.width = `${Math.max(right - left, 1)}px`
  })
}

export function startLabel(task: TaskModel): string {
  const start = task.startDate
  if (!(start instanceof Date) || Number.isNaN(start.getTime())) return ''
  return formatCalendarDate(localCalendarDate(start))
}
