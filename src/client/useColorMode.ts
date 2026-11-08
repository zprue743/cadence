import { ref, watch } from 'vue'
import { DomHelper } from '@bryntum/gantt'
import svalbardDark from '@bryntum/gantt/svalbard-dark.css?url'
import svalbardLight from '@bryntum/gantt/svalbard-light.css?url'

export type ColorMode = 'light' | 'dark'

const COLOR_MODE_KEY = 'cadence-color-mode'
const themeUrls: Record<ColorMode, string> = {
  light: svalbardLight,
  dark: svalbardDark,
}
const themeNames: Record<ColorMode, `svalbard-${ColorMode}`> = {
  light: 'svalbard-light',
  dark: 'svalbard-dark',
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

function ensureThemeLink(mode: ColorMode): HTMLLinkElement {
  const existing = document.querySelector('link[data-bryntum-theme]')
  if (existing instanceof HTMLLinkElement) return existing
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.dataset.bryntumTheme = ''
  link.href = themeUrls[mode]
  document.head.appendChild(link)
  return link
}

function applyColorMode(mode: ColorMode) {
  const link = ensureThemeLink(mode)
  // Tell Bryntum which theme is active, then pin the Vite-resolved stylesheet URL.
  DomHelper.setTheme(themeNames[mode])
  link.href = themeUrls[mode]
  document.documentElement.dataset.colorMode = mode
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
