import type { Gantt, TaskModel } from '@bryntum/gantt'
import writeXlsxFile from 'write-excel-file/browser'
import { todayCalendarDate } from '../../shared/dateHealth'
import { healthForTask, startLabel } from './schedule'

type Cell = { value: string; fontWeight?: 'bold' }

export function installExcelWriter() {
  ;(globalThis as { writeXlsxFile?: typeof writeXlsxFile }).writeXlsxFile = writeXlsxFile
}

function slug(value: string): string {
  const cleaned = value.trim().replace(/[^\w.-]+/g, '-').replace(/^-|-$/g, '')
  return cleaned || 'roadmap'
}

export function reviewFilename(roadmapName: string): string {
  return `Cadence-${slug(roadmapName)}-review-${todayCalendarDate()}`
}

function rowFor(task: TaskModel): Cell[] {
  return [
    task.name,
    String(task.get('outcome') ?? ''),
    String(task.get('successCriteria') ?? ''),
    String(task.get('owner') ?? ''),
    String(task.get('status') ?? ''),
    String(task.get('dateHealth') ?? healthForTask(task)),
    startLabel(task),
    String(task.get('targetDate') ?? ''),
  ].map((value) => ({ value }))
}

export async function exportReview(gantt: Gantt, roadmapName: string) {
  await downloadReview(gantt, reviewFilename(roadmapName))
}

export async function downloadReview(gantt: Gantt, filename: string) {
  const header = ['Name', 'Outcome', 'Success criteria', 'Owner', 'Status', 'Date health', 'Start', 'End'].map(
    (value): Cell => ({ value, fontWeight: 'bold' }),
  )
  const tasks: TaskModel[] = []
  gantt.project.taskStore.forEach((task) => {
    tasks.push(task as TaskModel)
  })
  await writeXlsxFile([header, ...tasks.map(rowFor)], { fileName: `${filename}.xlsx` })
}
