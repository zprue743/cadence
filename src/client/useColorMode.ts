import { ref, watch } from 'vue'
import material3Dark from '@bryntum/gantt/material3-dark.css?url'
import material3Light from '@bryntum/gantt/material3-light.css?url'

export type ColorMode = 'light' | 'dark'

const COLOR_MODE_KEY = 'cadence-color-mode'
const themeUrls: Record<ColorMode, string> = {
  light: material3Light,
  dark: material3Dark,
}

function readColorMode(): ColorMode {
  try {
    const stored = localStorage.getItem(COLOR_MODE_KEY)
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    // Preference stays with the system setting when storage is blocked.
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyColorMode(mode: ColorMode) {
  const existing = document.getElementById('cadence-theme')
  const link = existing instanceof HTMLLinkElement ? existing : document.createElement('link')
  link.id = 'cadence-theme'
  link.rel = 'stylesheet'
  link.href = themeUrls[mode]
  if (!link.parentNode) document.head.appendChild(link)
  document.documentElement.style.colorScheme = mode
}

export function useColorMode() {
  const colorMode = ref<ColorMode>(readColorMode())

  function setColorMode(mode: ColorMode) {
    colorMode.value = mode
    try {
      localStorage.setItem(COLOR_MODE_KEY, mode)
    } catch {
      // The choice still applies for this visit.
    }
  }

  watch(colorMode, applyColorMode, { immediate: true })

  return { colorMode, setColorMode }
}
