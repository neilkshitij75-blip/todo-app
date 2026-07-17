// Lightweight daily-use tracking in localStorage — no backend, no auth.
import { todayStr } from './dates'

const STREAK_KEY = 'tasks.streak'
const DONE_KEY = 'tasks.doneLog'

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage full / unavailable — non-fatal */
  }
}

function yesterdayStr() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

// Call once on app open. Increments the streak if the last visit was
// yesterday, keeps it if today, resets to 1 otherwise. Returns the count.
export function recordVisit() {
  const today = todayStr()
  const state = read(STREAK_KEY, { count: 0, last: null })

  if (state.last === today) return state.count
  if (state.last === yesterdayStr()) state.count += 1
  else state.count = 1

  state.last = today
  write(STREAK_KEY, state)
  return state.count
}

export function getStreak() {
  return read(STREAK_KEY, { count: 0, last: null }).count
}

// Tasks completed today (tracked as a per-day counter so it survives
// clearing completed tasks).
export function getDoneToday() {
  const log = read(DONE_KEY, {})
  return log[todayStr()] || 0
}

export function bumpDone(delta) {
  const log = read(DONE_KEY, {})
  const today = todayStr()
  log[today] = Math.max(0, (log[today] || 0) + delta)
  // Keep the log small: drop entries older than ~30 days.
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 30)
  for (const k of Object.keys(log)) {
    if (new Date(k + 'T00:00:00') < cutoff) delete log[k]
  }
  write(DONE_KEY, log)
  return log[today]
}
