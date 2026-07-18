// Local-time date helpers (no UTC drift — we compare calendar days).

function pad(n) {
  return String(n).padStart(2, '0')
}

export function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// Milliseconds for sorting: a task's due moment (date + optional time).
export function dueSortValue(task) {
  if (!task.due_date) return Infinity
  const t = task.due_time ? task.due_time.slice(0, 5) : '23:59'
  return new Date(`${task.due_date}T${t}`).getTime()
}

export function isOverdue(task) {
  if (!task.due_date || task.completed) return false
  const now = new Date()
  if (task.due_time) {
    return dueSortValue(task) < now.getTime()
  }
  return task.due_date < todayStr()
}

export function isDueToday(task) {
  return !!task.due_date && task.due_date === todayStr()
}

export function to12h(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  const period = h >= 12 ? 'pm' : 'am'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return m === 0 ? `${h12}${period}` : `${h12}:${pad(m)}${period}`
}

// "3–4pm" style range for events; falls back to a single time.
export function formatTimeRange(start, end) {
  if (!start) return null
  if (!end) return to12h(start.slice(0, 5))
  return `${to12h(start.slice(0, 5))}–${to12h(end.slice(0, 5))}`
}

// A short, human label for a task's due date, e.g. "Today · 7am",
// "Tomorrow", "Overdue · Mon 12 May", "Thu 23 Jul".
export function formatDue(task) {
  if (!task.due_date) return null

  const due = new Date(`${task.due_date}T00:00:00`)
  const today = new Date(todayStr() + 'T00:00:00')
  const diffDays = Math.round((due - today) / 86400000)

  let dayLabel
  if (diffDays === 0) dayLabel = 'Today'
  else if (diffDays === 1) dayLabel = 'Tomorrow'
  else if (diffDays === -1) dayLabel = 'Yesterday'
  else {
    dayLabel = due.toLocaleDateString(undefined, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    })
  }

  const timeLabel = task.due_time
    ? formatTimeRange(task.due_time, task.end_time)
    : null
  const base = timeLabel ? `${dayLabel} · ${timeLabel}` : dayLabel
  return isOverdue(task) && diffDays < 0 ? `Overdue · ${base}` : base
}

// Advance a YYYY-MM-DD string by n days (for recurring tasks).
export function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00`)
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// Advance a YYYY-MM-DD string by n months, clamping to month length.
export function addMonths(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00`)
  const day = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + n)
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(day, lastDay))
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// The next n calendar days as YYYY-MM-DD, starting today (for the week view).
export function nextDays(n) {
  const start = todayStr()
  return Array.from({ length: n }, (_, i) => addDays(start, i))
}

// Friendly heading for a date column, e.g. "Today", "Tomorrow", "Sat 25 Jul".
export function dayHeading(dateStr) {
  const diff = Math.round(
    (new Date(dateStr + 'T00:00:00') - new Date(todayStr() + 'T00:00:00')) / 86400000,
  )
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  return new Date(dateStr + 'T00:00:00').toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}
