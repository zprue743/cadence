<script setup lang="ts">
import { computed, nextTick, onMounted, ref, shallowRef, watch } from 'vue'
import { BryntumGantt, BryntumGanttProjectModel } from '@bryntum/gantt-vue-3'
import { OpenAIPlugin, type Gantt, type Model, type ProjectModel, type TaskModel } from '@bryntum/gantt'
import '@bryntum/gantt/fontawesome/css/fontawesome.css'
import '@bryntum/gantt/fontawesome/css/solid.css'
import '@bryntum/gantt/gantt.css'
import '../gantt/gantt.css'
import { CadenceTaskModel } from '../gantt/taskModel'
import { columns, statuses, subGridConfigs, taskRenderer, zoomPresets, type ZoomId } from '../gantt/ganttConfig'
import { exportReview, installExcelWriter } from '../gantt/exportReview'
import { fitParentShade, healthForTask, refreshDerived, taskNeedsAttention, tooltipHtml } from '../gantt/schedule'
import { useColorMode } from '../useColorMode'
import { visibleIds } from '../../shared/filterTree'
import type { ChangeRow, GitlabSignal, RoadmapSummary, SnapshotSummary } from '../../shared/types'

installExcelWriter()

const props = defineProps<{ roadmapId: number; snapshotId: number | null }>()

const projectRef = ref<InstanceType<typeof BryntumGanttProjectModel> | null>(null)
const ganttRef = ref<InstanceType<typeof BryntumGantt> | null>(null)
const project = shallowRef<ProjectModel | null>(null)
const selected = shallowRef<TaskModel | null>(null)
const activeZoom = ref<ZoomId>('month')
const { colorMode, setColorMode } = useColorMode()
const taskName = ref('')
const status = ref('proposed')
const owner = ref('')
const outcome = ref('')
const successCriteria = ref('')
const note = ref('')
const gitlabUrl = ref('')
const dateHealthLabel = ref('')
const loadError = ref('')
const ready = ref(false)
const aiEnabled = ref(false)
const canEdit = ref(false)
const roadmapName = ref('Roadmap')
const saveState = ref<'idle' | 'saving' | 'saved' | 'failed'>('idle')
const conflict = ref(false)
const reviewFilter = ref<'attention' | 'in progress' | 'planned' | null>(null)
const findText = ref('')
const matchCount = ref(0)
const totalCount = ref(0)
const showHint = ref(readHint())
const snapshots = ref<SnapshotSummary[]>([])
const snapshotName = ref('')
const compareId = ref<number | null>(props.snapshotId)
const changes = ref<ChangeRow[]>([])
const signal = ref<GitlabSignal | null>(null)
const signalError = ref('')
const signalLoading = ref(false)
const viewingSnapshot = ref('')
const taskPanelOpen = ref(true)
let chartBound = false
let undoArmed = false
let compareToken = 0

const HINT_KEY = 'cadence-review-hint'

function readHint(): boolean {
  try {
    return localStorage.getItem(HINT_KEY) !== 'hidden'
  } catch {
    return true
  }
}

const loadUrl = computed(() =>
  props.snapshotId == null
    ? `/api/roadmaps/${props.roadmapId}/load`
    : `/api/roadmaps/${props.roadmapId}/snapshots/${props.snapshotId}/load`,
)
const syncUrl = computed(() => (canEdit.value && props.snapshotId == null ? `/api/roadmaps/${props.roadmapId}/sync` : ''))
const readOnly = computed(() => props.snapshotId != null || !canEdit.value)
const aiFeature = computed(() => {
  if (!aiEnabled.value || readOnly.value) return false
  return {
    promptUrl: `/api/ai/prompt?roadmapId=${props.roadmapId}`,
    apiPlugin: OpenAIPlugin,
    model: 'gpt-4.1',
    tools: {
      criticalPath: {
        description: 'Critical path is not available.',
        available: false,
        fn() {},
      },
    },
    undo: false,
    redo: false,
  }
})
/* Export/Print live in app chrome as ghost text; tbar stays for undo/redo. */
const tbar: { type: string; text?: string; onClick?: () => void; rendition?: string }[] = []
const tooltipFeature = { template: ({ taskRecord }: { taskRecord: TaskModel }) => tooltipHtml(taskRecord) }
const filterLabel = computed(() => {
  if (reviewFilter.value === 'attention') return 'Needs attention'
  if (reviewFilter.value === 'in progress') return 'In progress'
  if (reviewFilter.value === 'planned') return 'Planned'
  return ''
})

onMounted(() => {
  void loadMeta()
})

watch(
  () => [props.roadmapId, props.snapshotId],
  () => {
    chartBound = false
    undoArmed = false
    ready.value = false
    project.value = null
    void loadMeta()
  },
)

watch(projectRef, (component) => {
  if (!component) {
    project.value = null
    return
  }
  void nextTick(() => {
    project.value = component.instance.value ?? null
    bindProject(project.value)
  })
})

watch(ganttRef, (component) => {
  if (!component) {
    chartBound = false
    return
  }
  void nextTick(() => {
    const gantt = component.instance.value
    if (!gantt || chartBound) return
    chartBound = true
    gantt.on({ cellClick: onCellClick, taskClick: onTaskClick, horizontalScroll: () => fitParentShade(gantt), presetChange: () => fitParentShade(gantt) })
    const parentArea = gantt.features.parentArea as { highlightParent?: (task: TaskModel) => void } | undefined
    if (parentArea?.highlightParent) {
      const highlight = parentArea.highlightParent.bind(parentArea)
      parentArea.highlightParent = (task) => {
        highlight(task)
        fitParentShade(gantt)
      }
    }
    fitParentShade(gantt)
    applyFilter()
  })
})

async function loadMeta() {
  loadError.value = ''
  try {
    const response = await fetch(`/api/roadmaps/${props.roadmapId}`)
    if (response.status === 401) throw new Error('Sign-in required')
    if (!response.ok) throw new Error('Roadmap not found')
    const detail = (await response.json()) as RoadmapSummary
    roadmapName.value = detail.name
    canEdit.value = detail.canEdit && props.snapshotId == null
    if (canEdit.value) {
      const aiResponse = await fetch(`/api/ai?roadmapId=${props.roadmapId}`)
      if (aiResponse.ok) aiEnabled.value = Boolean((await aiResponse.json() as { enabled?: boolean }).enabled)
    } else {
      aiEnabled.value = false
    }
    await loadSnapshots()
    if (props.snapshotId != null) {
      viewingSnapshot.value = snapshots.value.find((item) => item.id === props.snapshotId)?.name ?? 'Snapshot'
      compareId.value = props.snapshotId
    } else {
      viewingSnapshot.value = ''
    }
    await loadChanges()
    ready.value = true
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : 'The roadmap API is not running.'
  }
}

async function loadSnapshots() {
  const response = await fetch(`/api/roadmaps/${props.roadmapId}/snapshots`)
  if (!response.ok) {
    snapshots.value = []
    return
  }
  snapshots.value = (await response.json()) as SnapshotSummary[]
}

function bindProject(next: ProjectModel | null) {
  if (!next) return
  next.on({
    beforeSync() {
      saveState.value = 'saving'
      conflict.value = false
    },
    sync() {
      saveState.value = 'saved'
      refreshAll(next)
    },
    async syncFail({ response }: { response?: unknown }) {
      saveState.value = 'failed'
      conflict.value = await readConflict(response)
    },
    load() {
      refreshAll(next)
      if (!readOnly.value) void armUndo(next)
      const gantt = ganttInstance()
      if (gantt?.tbar && !readOnly.value && !gantt.tbar.widgetMap.cadenceUndo) {
        try {
          gantt.tbar.add({ type: 'undoredo', ref: 'cadenceUndo', items: { transactionsCombo: null } })
        } catch {
          // The chart stays usable when the undo widget cannot attach yet.
        }
      }
      try {
        setZoom('quarter')
      } catch {
        activeZoom.value = 'month'
      }
      if (gantt) fitParentShade(gantt)
      applyFilter()
    },
  })
}

function refreshAll(next: ProjectModel) {
  next.taskStore.forEach((task) => {
    refreshDerived(task as TaskModel)
  })
}

async function armUndo(next: ProjectModel) {
  if (undoArmed || readOnly.value) return
  undoArmed = true
  await next.commitAsync()
  const stm = next.stm as { autoRecord?: boolean; resetQueue?: () => void; enable?: () => void }
  stm.autoRecord = true
  stm.resetQueue?.()
  stm.enable?.()
}

async function readConflict(response: unknown): Promise<boolean> {
  if (!response || typeof response !== 'object') return false
  const record = response as { conflict?: boolean; parsedJson?: { conflict?: boolean }; responseText?: string }
  if (record.conflict || record.parsedJson?.conflict) return true
  if (typeof record.responseText === 'string' && record.responseText.includes('"conflict":true')) return true
  const asResponse = response as Response
  if (typeof asResponse.clone === 'function') {
    try {
      const body = (await asResponse.clone().json()) as { conflict?: boolean }
      return Boolean(body.conflict)
    } catch {
      return false
    }
  }
  return false
}

function ganttInstance(): Gantt | undefined {
  return ganttRef.value?.instance.value
}

function setZoom(id: ZoomId) {
  activeZoom.value = id
  const gantt = ganttInstance()
  if (!gantt) return
  const preset = zoomPresets[id]
  gantt.viewPreset = typeof preset === 'string' ? preset : { ...preset, options: {} }
}

function scrollToToday() {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ganttInstance()?.scrollToDate(new Date(), { block: 'center', animate: !reduced })
}

function readTask(record: TaskModel | null) {
  selected.value = record
  signal.value = null
  signalError.value = ''
  if (!record) return
  taskName.value = record.name
  status.value = String(record.get('status') ?? 'proposed')
  owner.value = String(record.get('owner') ?? '')
  outcome.value = String(record.get('outcome') ?? '')
  successCriteria.value = String(record.get('successCriteria') ?? '')
  note.value = String(record.get('note') ?? '')
  gitlabUrl.value = String(record.get('gitlabUrl') ?? '')
  dateHealthLabel.value = healthForTask(record)
  if (gitlabUrl.value.trim()) void loadSignal()
}

function onSelectionChange(event: { selection: Model[] }) {
  const record = event.selection[0]
  readTask(record ? (record as TaskModel) : null)
}

function onCellClick(event: { record: Model }) {
  readTask(event.record as TaskModel)
}

function onTaskClick(event: { taskRecord: TaskModel }) {
  readTask(event.taskRecord)
}

function commit(field: 'status' | 'owner' | 'outcome' | 'successCriteria' | 'note' | 'gitlabUrl', value: string) {
  if (readOnly.value) return
  selected.value?.set(field, value)
  if (selected.value) {
    refreshDerived(selected.value)
    dateHealthLabel.value = healthForTask(selected.value)
  }
}

function onStatus(event: Event) {
  status.value = (event.target as HTMLSelectElement).value
  commit('status', status.value)
  applyFilter()
}

function onOwner(event: Event) {
  owner.value = (event.target as HTMLInputElement).value
  commit('owner', owner.value)
}

function onOutcome(event: Event) {
  outcome.value = (event.target as HTMLTextAreaElement).value
  commit('outcome', outcome.value)
}

function onCriteria(event: Event) {
  successCriteria.value = (event.target as HTMLTextAreaElement).value
  commit('successCriteria', successCriteria.value)
}

function onNote(event: Event) {
  note.value = (event.target as HTMLTextAreaElement).value
  commit('note', note.value)
}

function onGitlab(event: Event) {
  gitlabUrl.value = (event.target as HTMLInputElement).value
  commit('gitlabUrl', gitlabUrl.value)
}

function setFilter(next: 'attention' | 'in progress' | 'planned') {
  reviewFilter.value = reviewFilter.value === next ? null : next
  applyFilter()
}

function applyFilter() {
  const gantt = ganttInstance()
  const store = gantt?.project.taskStore
  if (!store) return
  store.removeFilter('cadence-review')
  const nodes: { id: number; parentId: number | null }[] = []
  const matched: number[] = []
  store.forEach((task) => {
    const record = task as TaskModel
    const parent = record.parent as { id?: unknown; isRoot?: boolean } | null
    const parentId = parent && !parent.isRoot && parent.id != null ? Number(parent.id) : null
    nodes.push({ id: Number(record.id), parentId: Number.isInteger(parentId) ? parentId : null })
    const statusValue = String(record.get('status') ?? '')
    const hit =
      reviewFilter.value === 'attention'
        ? taskNeedsAttention(record)
        : reviewFilter.value != null && statusValue === reviewFilter.value
    if (reviewFilter.value == null || hit) matched.push(Number(record.id))
  })
  totalCount.value = nodes.length
  const visible = visibleIds(nodes, matched)
  matchCount.value = reviewFilter.value == null ? nodes.length : visible.size
  if (reviewFilter.value == null) return
  store.filter({ id: 'cadence-review', filterBy: (task: TaskModel) => visible.has(Number(task.id)) })
}

function onFind(event: Event) {
  findText.value = (event.target as HTMLInputElement).value
  const feature = ganttInstance()?.features.search as { search?: (query: string) => void; clear?: () => void } | undefined
  if (!feature) return
  if (!findText.value.trim()) {
    feature.clear?.()
    return
  }
  feature.search?.(findText.value)
}

function dismissHint() {
  showHint.value = false
  try {
    localStorage.setItem(HINT_KEY, 'hidden')
  } catch {
    // The hint stays dismissed for this visit.
  }
}

async function reloadChart() {
  const next = project.value
  if (!next) return
  conflict.value = false
  saveState.value = 'idle'
  await next.load()
  const stm = next.stm as { resetQueue?: () => void } | undefined
  stm?.resetQueue?.()
}

async function onExport() {
  const gantt = ganttInstance()
  if (!gantt) return
  refreshAll(gantt.project)
  await exportReview(gantt, roadmapName.value)
}

function onPrint() {
  const gantt = ganttInstance()
  if (!gantt) return
  gantt.print({ orientation: 'landscape' })
}

async function waitForSave(): Promise<boolean> {
  const next = project.value
  if (!next || readOnly.value) return false
  if (saveState.value === 'saving') {
    await new Promise<void>((resolve) => {
      const timer = window.setInterval(() => {
        if (saveState.value !== 'saving') {
          window.clearInterval(timer)
          resolve()
        }
      }, 50)
    })
  }
  await next.commitAsync()
  if (next.crudStoreHasChanges()) await next.sync()
  return saveState.value !== 'failed'
}

async function captureSnapshot() {
  const name = snapshotName.value.trim()
  if (!name || readOnly.value) return
  const ready = await waitForSave()
  if (!ready) return
  const response = await fetch(`/api/roadmaps/${props.roadmapId}/snapshots`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  if (!response.ok) return
  snapshotName.value = ''
  await loadSnapshots()
}

async function loadChanges() {
  const token = ++compareToken
  if (compareId.value == null) {
    changes.value = []
    return
  }
  const from = String(compareId.value)
  const to = props.snapshotId == null ? 'live' : String(props.snapshotId)
  if (from === to) {
    changes.value = []
    return
  }
  const response = await fetch(`/api/roadmaps/${props.roadmapId}/compare?from=${from}&to=${to}`)
  if (token !== compareToken) return
  if (!response.ok) {
    changes.value = []
    return
  }
  changes.value = ((await response.json()) as { changes: ChangeRow[] }).changes
}

function onCompare(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  compareId.value = value ? Number(value) : null
  void loadChanges()
}

async function loadSignal() {
  const url = gitlabUrl.value.trim()
  signal.value = null
  signalError.value = ''
  if (!url) return
  signalLoading.value = true
  try {
    const response = await fetch(`/api/gitlab/signal?url=${encodeURIComponent(url)}`)
    const body = (await response.json()) as GitlabSignal & { message?: string }
    if (!response.ok) {
      signalError.value = body.message || 'GitLab request failed'
      return
    }
    signal.value = body
  } catch {
    signalError.value = 'GitLab request failed'
  } finally {
    signalLoading.value = false
  }
}

const changeText: Record<ChangeRow['kind'], string> = {
  added: 'Added',
  removed: 'Removed',
  date: 'Date moved',
  status: 'Status',
  owner: 'Owner',
  outcome: 'Outcome',
  success: 'Success criteria',
}
</script>

<template>
  <main class="roadmap">
    <header class="toolbar">
      <div class="brand">
        <a href="#/" class="mark">Cadence</a>
        <span class="eyebrow">{{ roadmapName }}</span>
        <p v-if="viewingSnapshot" class="snapshot-flag">Viewing {{ viewingSnapshot }}</p>
      </div>
      <div class="toolbar-actions">
        <p class="save-state" :data-state="saveState" role="status">
          <template v-if="saveState === 'saving'">Saving</template>
          <template v-else-if="saveState === 'saved'">Saved</template>
          <template v-else-if="saveState === 'failed'">Not saved</template>
        </p>
        <div class="segmented" role="group" aria-label="Color mode">
          <button type="button" :aria-pressed="colorMode === 'light'" @click="setColorMode('light')">Light</button>
          <button type="button" :aria-pressed="colorMode === 'dark'" @click="setColorMode('dark')">Dark</button>
        </div>
        <div class="segmented" role="group" aria-label="Timeline zoom">
          <button type="button" :aria-pressed="activeZoom === 'month'" @click="setZoom('month')">Month</button>
          <button type="button" :aria-pressed="activeZoom === 'quarter'" @click="setZoom('quarter')">Quarter</button>
          <button type="button" :aria-pressed="activeZoom === 'year'" @click="setZoom('year')">Year</button>
          <button type="button" @click="scrollToToday">Today</button>
        </div>
        <a class="nav-btn" href="#/portfolio">Portfolio</a>
      </div>
    </header>
    <div class="review-strip">
      <div class="filters" role="group" aria-label="Review filters">
        <button type="button" class="filter filter--attn" :aria-pressed="reviewFilter === 'attention'" @click="setFilter('attention')">
          <span class="tick" aria-hidden="true"></span>
          Needs attention
        </button>
        <button type="button" class="filter filter--prog" :aria-pressed="reviewFilter === 'in progress'" @click="setFilter('in progress')">
          <span class="tick" aria-hidden="true"></span>
          In progress
        </button>
        <button type="button" class="filter filter--plan" :aria-pressed="reviewFilter === 'planned'" @click="setFilter('planned')">
          <span class="tick" aria-hidden="true"></span>
          Planned
        </button>
      </div>
      <label class="find">
        Find
        <input :value="findText" type="search" placeholder="Match rows" aria-describedby="find-note" @input="onFind" />
      </label>
      <p id="find-note" class="find-note">Find highlights matches. Filters hide rows.</p>
      <p v-if="reviewFilter" class="filter-banner">
        Showing {{ matchCount }} of {{ totalCount }}
        <button type="button" @click="reviewFilter = null; applyFilter()">Clear</button>
      </p>
      <p v-if="showHint" class="hint">
        Bar = committed window. Drag edges to replan.
        <button type="button" @click="dismissHint">Dismiss</button>
      </p>
      <div class="review-actions">
        <button type="button" class="ghost" @click="onExport">Export</button>
        <button type="button" class="ghost" @click="onPrint">Print</button>
      </div>
    </div>
    <p v-if="conflict" class="conflict" role="alert">
      The roadmap changed. This undo was not applied.
      <button type="button" @click="reloadChart">Reload</button>
    </p>
    <div class="workspace">
      <p v-if="loadError" class="load-error" role="alert">{{ loadError }}</p>
      <BryntumGanttProjectModel
        v-if="ready && !loadError"
        :key="`${roadmapId}-${snapshotId ?? 'live'}`"
        ref="projectRef"
        class="project-host"
        :load-url="loadUrl"
        :sync-url="syncUrl"
        :auto-load="true"
        :auto-sync="!readOnly"
        :task-model-class="CadenceTaskModel"
        :task-store="{ transformFlatData: true }"
        :add-constraint-on-date-set="false"
        :auto-schedule-manual-tasks-on-second-pass="false"
      />
      <div class="gantt-host">
        <BryntumGantt
          v-if="project"
          ref="ganttRef"
          class="gantt"
          :project="project"
          :columns="columns"
          :sub-grid-configs="subGridConfigs"
          :view-preset="zoomPresets.month"
          :task-renderer="taskRenderer"
          :tbar="tbar"
          :task-edit-feature="false"
          :critical-paths-feature="false"
          :time-ranges-feature="{ showCurrentTimeLine: true }"
          :task-tooltip-feature="tooltipFeature"
          :rollups-feature="{ rollupToAllParents: true }"
          :parent-area-feature="true"
          :search-feature="true"
          :excel-exporter-feature="true"
          :print-feature="true"
          :ai-feature="aiFeature"
          :listeners="{ selectionChange: onSelectionChange, cellClick: onCellClick, taskClick: onTaskClick }"
        />
      </div>
      <aside v-if="taskPanelOpen" id="task-details" class="panel" aria-label="Task details">
        <div class="panel-heading">
          <h2>{{ selected ? taskName : 'Task' }}</h2>
          <button type="button" class="panel-toggle" :aria-expanded="taskPanelOpen" aria-controls="task-details" @click="taskPanelOpen = false">
            Collapse
          </button>
        </div>
        <p v-if="!selected">Select a task.</p>
        <form v-else @submit.prevent>
          <label>
            Outcome
            <textarea :value="outcome" :readonly="readOnly" @input="onOutcome"></textarea>
          </label>
          <label>
            Success criteria
            <textarea :value="successCriteria" :readonly="readOnly" @input="onCriteria"></textarea>
          </label>
          <label>
            Owner
            <input :value="owner" type="text" :readonly="readOnly" @input="onOwner" />
          </label>
          <label>
            Status
            <select :value="status" :disabled="readOnly" @change="onStatus">
              <option v-for="item in statuses" :key="item" :value="item">{{ item }}</option>
            </select>
          </label>
          <p class="health-readout">Date health <strong>{{ dateHealthLabel }}</strong></p>
          <section class="delivery" aria-label="Delivery signal">
            <h3>Delivery signal</h3>
            <label>
              GitLab work item
              <input :value="gitlabUrl" type="url" :readonly="readOnly" placeholder="https://gitlab.example.com/group/project/-/work_items/1" @input="onGitlab" @change="loadSignal" />
            </label>
            <p v-if="signalLoading">Loading GitLab…</p>
            <p v-else-if="signalError" class="signal-error">{{ signalError }}</p>
            <p v-else-if="signal">
              {{ signal.title }}
              <template v-if="signal.opened != null"> · {{ signal.closed }}/{{ (signal.opened ?? 0) + (signal.closed ?? 0) }} closed</template>
              <template v-if="signal.dueDate"> · due {{ signal.dueDate }}</template>
            </p>
          </section>
          <label>
            Notes
            <textarea :value="note" :readonly="readOnly" @input="onNote"></textarea>
          </label>
        </form>
        <section class="snapshots" aria-label="Commitment snapshots">
          <h3>Snapshots</h3>
          <form v-if="!readOnly" class="capture" @submit.prevent="captureSnapshot">
            <label>
              Name
              <input v-model="snapshotName" type="text" placeholder="Q3 2026 commit" />
            </label>
            <button type="submit" class="primary" :disabled="saveState === 'saving' || saveState === 'failed'">Capture commitment</button>
          </form>
          <label>
            Compare with
            <select :value="compareId ?? ''" @change="onCompare">
              <option value="">Choose a snapshot</option>
              <option v-for="item in snapshots" :key="item.id" :value="item.id">
                {{ item.name }} · {{ item.createdAt.slice(0, 10) }}
              </option>
            </select>
          </label>
          <ul v-if="changes.length" class="changes">
            <li v-for="(change, index) in changes" :key="`${change.sourceTaskId}-${change.kind}-${index}`">
              <span>{{ changeText[change.kind] }}</span>
              {{ change.name }}
              <small v-if="change.before || change.after">{{ change.before }} → {{ change.after }}</small>
            </li>
          </ul>
          <p v-else-if="compareId != null">No changes since that snapshot.</p>
          <ul class="snapshot-links">
            <li v-for="item in snapshots" :key="item.id">
              <a :href="`#/roadmaps/${roadmapId}/snapshots/${item.id}`">{{ item.name }}</a>
            </li>
          </ul>
        </section>
      </aside>
      <button
        v-else
        type="button"
        class="panel-toggle panel-toggle--collapsed"
        :aria-expanded="taskPanelOpen"
        aria-controls="task-details"
        @click="taskPanelOpen = true"
      >
        Show task details
      </button>
    </div>
  </main>
</template>
