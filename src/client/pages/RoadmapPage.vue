<script setup lang="ts">
import { computed, nextTick, onMounted, ref, shallowRef, watch } from 'vue'
import { BryntumGantt, BryntumGanttProjectModel } from '@bryntum/gantt-vue-3'
import { OpenAIPlugin, type Gantt, type Model, type ProjectModel, type TaskModel } from '@bryntum/gantt'
import '@bryntum/gantt/gantt.css'
import '@bryntum/gantt/stockholm-light.css'
import '../gantt/gantt.css'
import { CadenceTaskModel } from '../gantt/taskModel'
import {
  columns,
  statuses,
  subGridConfigs,
  taskRenderer,
  zoomPresets,
  type ZoomId,
} from '../gantt/ganttConfig'
import type { AiStatus, RoadmapSummary } from '../../shared/types'

const projectRef = ref<InstanceType<typeof BryntumGanttProjectModel> | null>(null)
const ganttRef = ref<InstanceType<typeof BryntumGantt> | null>(null)
const project = shallowRef<ProjectModel | null>(null)
const selected = shallowRef<TaskModel | null>(null)
const activeZoom = ref<ZoomId>('month')
const taskName = ref('')
const status = ref('proposed')
const owner = ref('')
const outcome = ref('')
const note = ref('')
const roadmapId = ref<number | null>(null)
const loadError = ref('')
const aiEnabled = ref(false)
let chartBound = false

const loadUrl = computed(() => (roadmapId.value == null ? '' : `/api/roadmaps/${roadmapId.value}/load`))
const syncUrl = computed(() => (roadmapId.value == null ? '' : `/api/roadmaps/${roadmapId.value}/sync`))
const aiFeature = computed(() => {
  if (!aiEnabled.value) return false
  return {
    promptUrl: '/api/ai/prompt',
    apiPlugin: OpenAIPlugin,
    tools: { criticalPath: null as never },
  }
})

onMounted(async () => {
  try {
    const [listResponse, aiResponse] = await Promise.all([fetch('/api/roadmaps'), fetch('/api/ai')])
    if (!listResponse.ok) throw new Error('Roadmap list failed')
    const list = (await listResponse.json()) as RoadmapSummary[]
    const first = list[0]
    if (!first) throw new Error('No roadmap')
    if (aiResponse.ok) {
      const ai = (await aiResponse.json()) as AiStatus
      aiEnabled.value = ai.enabled
    }
    roadmapId.value = first.id
  } catch {
    loadError.value = 'The roadmap API is not running.'
  }
})

watch(projectRef, (component) => {
  if (!component) {
    project.value = null
    return
  }
  void nextTick(() => {
    project.value = component.instance.value ?? null
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
    gantt.on({
      cellClick: onCellClick,
      taskClick: onTaskClick,
    })
  })
})

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
  ganttInstance()?.scrollToDate(new Date(), {
    block: 'center',
    animate: !reduced,
  })
}

function readTask(record: TaskModel | null) {
  selected.value = record
  if (!record) return
  taskName.value = record.name
  status.value = String(record.get('status') ?? 'proposed')
  owner.value = String(record.get('owner') ?? '')
  outcome.value = String(record.get('outcome') ?? '')
  note.value = String(record.get('note') ?? '')
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

function commit(field: 'status' | 'owner' | 'outcome' | 'note', value: string) {
  selected.value?.set(field, value)
}

function onStatus(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  status.value = value
  commit('status', value)
}

function onOwner(event: Event) {
  const value = (event.target as HTMLInputElement).value
  owner.value = value
  commit('owner', value)
}

function onOutcome(event: Event) {
  const value = (event.target as HTMLTextAreaElement).value
  outcome.value = value
  commit('outcome', value)
}

function onNote(event: Event) {
  const value = (event.target as HTMLTextAreaElement).value
  note.value = value
  commit('note', value)
}
</script>

<template>
  <main class="roadmap">
    <header class="toolbar">
      <h1>Cadence</h1>
      <div class="zoom" role="group" aria-label="Timeline zoom">
        <button type="button" :aria-pressed="activeZoom === 'month'" @click="setZoom('month')">Month</button>
        <button type="button" :aria-pressed="activeZoom === 'quarter'" @click="setZoom('quarter')">Quarter</button>
        <button type="button" :aria-pressed="activeZoom === 'year'" @click="setZoom('year')">Year</button>
        <button type="button" @click="scrollToToday">Today</button>
      </div>
    </header>
    <div class="workspace">
      <p v-if="loadError" class="load-error" role="alert">{{ loadError }}</p>
      <BryntumGanttProjectModel
        v-if="roadmapId !== null"
        ref="projectRef"
        class="project-host"
        :load-url="loadUrl"
        :sync-url="syncUrl"
        :auto-load="true"
        :auto-sync="true"
        :task-model-class="CadenceTaskModel"
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
          :task-edit-feature="false"
          :critical-paths-feature="false"
          :ai-feature="aiFeature"
          :listeners="{
            selectionChange: onSelectionChange,
            cellClick: onCellClick,
            taskClick: onTaskClick,
          }"
        />
      </div>
      <aside class="panel" aria-label="Task details">
        <h2>{{ selected ? taskName : 'Task' }}</h2>
        <p v-if="!selected">Select a task.</p>
        <form v-else @submit.prevent>
          <label>
            Outcome
            <textarea :value="outcome" @input="onOutcome"></textarea>
          </label>
          <label>
            Owner
            <input :value="owner" type="text" @input="onOwner" />
          </label>
          <label>
            Status
            <select :value="status" @change="onStatus">
              <option v-for="item in statuses" :key="item" :value="item">{{ item }}</option>
            </select>
          </label>
          <label>
            Notes
            <textarea :value="note" @input="onNote"></textarea>
          </label>
        </form>
      </aside>
    </div>
  </main>
</template>
