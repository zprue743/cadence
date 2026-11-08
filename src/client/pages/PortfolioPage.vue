<script setup lang="ts">
import { nextTick, onMounted, ref, shallowRef, watch } from 'vue'
import { BryntumGantt, BryntumGanttProjectModel } from '@bryntum/gantt-vue-3'
import type { Gantt, ProjectModel } from '@bryntum/gantt'
import '@bryntum/gantt/fontawesome/css/fontawesome.css'
import '@bryntum/gantt/fontawesome/css/solid.css'
import '@bryntum/gantt/gantt.css'
import '../gantt/gantt.css'
import { CadenceTaskModel } from '../gantt/taskModel'
import { portfolioColumns, subGridConfigs, taskRenderer, zoomPresets } from '../gantt/ganttConfig'
import { refreshDerived, tooltipHtml } from '../gantt/schedule'
import { useColorMode } from '../useColorMode'
import type { TaskModel } from '@bryntum/gantt'

const { colorMode, setColorMode } = useColorMode()
const projectRef = ref<InstanceType<typeof BryntumGanttProjectModel> | null>(null)
const ganttRef = ref<InstanceType<typeof BryntumGantt> | null>(null)
const project = shallowRef<ProjectModel | null>(null)
const loadError = ref('')
const tooltipFeature = { template: ({ taskRecord }: { taskRecord: TaskModel }) => tooltipHtml(taskRecord) }

onMounted(() => {
  void fetch('/api/portfolio/load').then((response) => {
    if (!response.ok) loadError.value = response.status === 401 ? 'Sign-in required' : 'The portfolio is unavailable.'
  })
})

watch(projectRef, (component) => {
  if (!component) {
    project.value = null
    return
  }
  void nextTick(() => {
    const next = component.instance.value ?? null
    project.value = next
    next?.on({
      load() {
        next.taskStore.forEach((task) => refreshDerived(task as TaskModel))
      },
    })
  })
})

function scrollToToday() {
  const gantt: Gantt | undefined = ganttRef.value?.instance.value
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  gantt?.scrollToDate(new Date(), { block: 'center', animate: !reduced })
}
</script>

<template>
  <main class="roadmap">
    <header class="toolbar">
      <div class="brand">
        <a href="#/" class="mark">Cadence</a>
        <span class="eyebrow">Portfolio</span>
      </div>
      <div class="toolbar-actions">
        <div class="segmented" role="group" aria-label="Color mode">
          <button type="button" :aria-pressed="colorMode === 'light'" @click="setColorMode('light')">Light</button>
          <button type="button" :aria-pressed="colorMode === 'dark'" @click="setColorMode('dark')">Dark</button>
        </div>
        <div class="segmented" role="group" aria-label="Timeline">
          <button type="button" @click="scrollToToday">Today</button>
        </div>
        <a class="nav-btn" href="#/">Teams</a>
      </div>
    </header>
    <p class="hint">Top-level commitments across teams. This view does not save.</p>
    <p v-if="loadError" class="load-error" role="alert">{{ loadError }}</p>
    <div v-else class="workspace">
      <BryntumGanttProjectModel
        ref="projectRef"
        class="project-host"
        load-url="/api/portfolio/load"
        :auto-load="true"
        :auto-sync="false"
        :task-model-class="CadenceTaskModel"
      />
      <div class="gantt-host">
        <BryntumGantt
          v-if="project"
          ref="ganttRef"
          class="gantt"
          :project="project"
          :columns="portfolioColumns"
          :sub-grid-configs="subGridConfigs"
          :view-preset="zoomPresets.quarter"
          :task-renderer="taskRenderer"
          :task-edit-feature="false"
          :critical-paths-feature="false"
          :time-ranges-feature="{ showCurrentTimeLine: true }"
          :task-tooltip-feature="tooltipFeature"
          :read-only="true"
        />
      </div>
    </div>
  </main>
</template>
