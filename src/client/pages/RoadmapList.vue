<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useColorMode } from '../useColorMode'
import '../gantt/gantt.css'
import type { RoadmapSummary } from '../../shared/types'

const { colorMode, setColorMode } = useColorMode()
const roadmaps = ref<RoadmapSummary[]>([])
const error = ref('')
const draft = ref<Record<number, string>>({})

const teams = computed(() => {
  const groups = new Map<number, { id: number; name: string; canEdit: boolean; roadmaps: RoadmapSummary[] }>()
  for (const roadmap of roadmaps.value) {
    const group = groups.get(roadmap.teamId) ?? { id: roadmap.teamId, name: roadmap.teamName, canEdit: false, roadmaps: [] }
    group.canEdit = group.canEdit || roadmap.canEdit
    group.roadmaps.push(roadmap)
    groups.set(roadmap.teamId, group)
  }
  return [...groups.values()]
})

onMounted(() => {
  void load()
})

async function load() {
  const response = await fetch('/api/roadmaps')
  if (response.status === 401) {
    error.value = 'Sign-in required'
    return
  }
  if (!response.ok) {
    error.value = 'The roadmap API is not running.'
    return
  }
  roadmaps.value = (await response.json()) as RoadmapSummary[]
}

async function createRoadmap(teamId: number) {
  const name = draft.value[teamId]?.trim() || 'Untitled roadmap'
  const response = await fetch('/api/roadmaps', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, teamId }),
  })
  if (!response.ok) return
  const created = (await response.json()) as { id: number }
  location.hash = `#/roadmaps/${created.id}`
}

function range(roadmap: RoadmapSummary): string {
  if (!roadmap.startDate && !roadmap.endDate) return 'No dates'
  return `${roadmap.startDate ?? '…'} – ${roadmap.endDate ?? '…'}`
}
</script>

<template>
  <main class="list-page">
    <header class="toolbar">
      <h1>Cadence</h1>
      <div class="toolbar-actions">
        <a class="text-link" href="#/portfolio">Portfolio</a>
        <div class="segmented" role="group" aria-label="Color mode">
          <button type="button" :aria-pressed="colorMode === 'light'" @click="setColorMode('light')">Light</button>
          <button type="button" :aria-pressed="colorMode === 'dark'" @click="setColorMode('dark')">Dark</button>
        </div>
      </div>
    </header>
    <p v-if="error" class="load-error" role="alert">{{ error }}</p>
    <section v-for="team in teams" :key="team.id" class="team">
      <h2>{{ team.name }}</h2>
      <ul>
        <li v-for="roadmap in team.roadmaps" :key="roadmap.id">
          <a :href="`#/roadmaps/${roadmap.id}`">{{ roadmap.name }}</a>
          <span>{{ range(roadmap) }}</span>
          <span>Edited {{ roadmap.updatedAt.slice(0, 10) }}</span>
        </li>
      </ul>
      <form v-if="team.canEdit" @submit.prevent="createRoadmap(team.id)">
        <label>
          New roadmap
          <input v-model="draft[team.id]" type="text" />
        </label>
        <button type="submit">Create</button>
      </form>
    </section>
  </main>
</template>
