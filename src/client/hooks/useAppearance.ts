import { useEffect } from 'react'
import { useSettings } from '@client/hooks/useSettings'
import { readSetting } from '@client/lib/settings'

const FONT_SCALE: Record<string, string> = {
  default: '100%',
  large: '112.5%',
  'extra-large': '125%',
}

/**
 * Applies the darkMode and fontScale settings to the document.
 * Kept as an effect on the root so a saved change takes hold immediately
 * without a reload, and so the OS preference is followed in "system" mode.
 */
export function useAppearance() {
  const { data: settings } = useSettings()
  const darkMode = readSetting(settings, 'darkMode')
  const fontScale = readSetting(settings, 'fontScale')

  useEffect(() => {
    const root = document.documentElement

    const apply = () => {
      const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true
      const dark = darkMode === 'dark' || (darkMode === 'system' && prefersDark)

      // The CSS is structured as :root = dark, .light = light overrides.
      // So we add .light when in light mode, remove it when in dark mode.
      root.classList.toggle('light', !dark)
      root.classList.toggle('dark', dark)
      root.style.colorScheme = dark ? 'dark' : 'light'
    }

    apply()

    // Only track the OS preference while actually in system mode.
    if (darkMode !== 'system' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [darkMode])

  useEffect(() => {
    document.documentElement.style.fontSize = FONT_SCALE[fontScale] ?? FONT_SCALE.default
  }, [fontScale])
}
