import { useEffect, useState } from 'react'

const KEY = 'tasks.theme' // 'light' | 'dark' | null (follow system)

function systemPrefersDark() {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
}

function apply(isDark) {
  document.documentElement.classList.toggle('dark', isDark)
}

/**
 * Dark mode that follows the system preference by default, with a manual
 * override persisted to localStorage. Returns [isDark, toggle].
 */
export function useDarkMode() {
  const [choice, setChoice] = useState(() => localStorage.getItem(KEY)) // may be null
  const [systemDark, setSystemDark] = useState(systemPrefersDark)

  const isDark = choice ? choice === 'dark' : systemDark

  useEffect(() => {
    apply(isDark)
  }, [isDark])

  // Track system changes only while following the system (no explicit choice).
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (e) => setSystemDark(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  function toggle() {
    const next = isDark ? 'light' : 'dark'
    setChoice(next)
    localStorage.setItem(KEY, next)
  }

  return [isDark, toggle]
}
