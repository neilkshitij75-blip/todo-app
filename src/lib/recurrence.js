import { addDays, addMonths, todayStr } from './dates'

// Normalise an item's recurrence into { freq, interval, until } or null,
// honouring the legacy `recurrence` text column when `recur` is absent.
export function getRecur(item) {
  if (item.recur) return { interval: 1, until: null, ...item.recur }
  if (item.recurrence) return { freq: item.recurrence, interval: 1, until: null }
  return null
}

export function recurLabel(item) {
  const r = getRecur(item)
  if (!r) return null
  if (r.interval > 1) {
    const unit = { daily: 'day', weekly: 'week', monthly: 'month' }[r.freq]
    return `every ${r.interval} ${unit}s`
  }
  return r.freq
}

// The next due date after completing a recurring item, or null if the rule
// has ended (past its `until` date).
export function nextDueDate(item) {
  const r = getRecur(item)
  if (!r) return null
  const base = item.due_date || todayStr()
  let next
  if (r.freq === 'daily') next = addDays(base, r.interval)
  else if (r.freq === 'weekly') next = addDays(base, 7 * r.interval)
  else if (r.freq === 'monthly') next = addMonths(base, r.interval)
  else return null

  if (r.until && next > r.until) return null
  return next
}
