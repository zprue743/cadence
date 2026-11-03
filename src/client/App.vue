<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import PortfolioPage from './pages/PortfolioPage.vue'
import RoadmapList from './pages/RoadmapList.vue'
import RoadmapPage from './pages/RoadmapPage.vue'

type AppRoute =
  | { name: 'list' }
  | { name: 'portfolio' }
  | { name: 'roadmap'; id: number; snapshotId: number | null }

const route = ref<AppRoute>({ name: 'list' })

function parseHash(): AppRoute {
  const parts = (location.hash.replace(/^#/, '') || '/').split('/').filter(Boolean)
  if (parts[0] === 'portfolio') return { name: 'portfolio' }
  if (parts[0] === 'roadmaps' && parts[1] && /^\d+$/.test(parts[1])) {
    const snapshotId = parts[2] === 'snapshots' && parts[3] && /^\d+$/.test(parts[3]) ? Number(parts[3]) : null
    return { name: 'roadmap', id: Number(parts[1]), snapshotId }
  }
  return { name: 'list' }
}

function syncRoute() {
  route.value = parseHash()
}

onMounted(() => {
  syncRoute()
  window.addEventListener('hashchange', syncRoute)
})

onUnmounted(() => {
  window.removeEventListener('hashchange', syncRoute)
})
</script>

<template>
  <RoadmapList v-if="route.name === 'list'" />
  <PortfolioPage v-else-if="route.name === 'portfolio'" />
  <RoadmapPage v-else :roadmap-id="route.id" :snapshot-id="route.snapshotId" />
</template>
