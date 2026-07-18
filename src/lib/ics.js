// Minimal iCalendar (.ics) export so events/dated tasks can be pulled into
// Apple/Google Calendar. One-way export of a snapshot — not a live feed.

function pad(n) {
  return String(n).padStart(2, '0')
}

function icsDate(dateStr, timeStr) {
  // All-day: a floating calendar date, no timezone involved.
  if (!timeStr) return dateStr.replace(/-/g, '') // YYYYMMDD (VALUE=DATE)

  // Timed: the stored time is wall-clock in the user's own timezone (the
  // device the app runs on). Interpret it locally and emit UTC (…Z) so the
  // calendar shows the correct instant — DST-aware, so CET and CEST both work.
  const [hh, mm] = timeStr.slice(0, 5).split(':')
  const local = new Date(`${dateStr}T${hh}:${mm}:00`)
  return local.toISOString().slice(0, 19).replace(/[-:]/g, '') + 'Z' // YYYYMMDDTHHMMSSZ
}

function escapeText(s = '') {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

function stamp() {
  const d = new Date()
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(
    d.getUTCHours(),
  )}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
}

function endTimeFor(item) {
  if (item.end_time) return item.end_time
  if (!item.due_time) return null
  // Default a 1-hour block for timed items without an explicit end.
  const [h, m] = item.due_time.slice(0, 5).split(':').map(Number)
  return `${pad((h + 1) % 24)}:${pad(m)}`
}

export function buildICS(items) {
  const dated = items.filter((i) => i.due_date && !i.completed)
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//My Tasks//Agenda//EN',
    'CALSCALE:GREGORIAN',
  ]
  for (const i of dated) {
    lines.push('BEGIN:VEVENT')
    lines.push(`UID:${i.id}@mytasks`)
    lines.push(`DTSTAMP:${stamp()}`)
    if (i.due_time) {
      lines.push(`DTSTART:${icsDate(i.due_date, i.due_time)}`)
      lines.push(`DTEND:${icsDate(i.due_date, endTimeFor(i))}`)
    } else {
      lines.push(`DTSTART;VALUE=DATE:${icsDate(i.due_date)}`)
    }
    lines.push(`SUMMARY:${escapeText(i.text)}`)
    if (i.notes) lines.push(`DESCRIPTION:${escapeText(i.notes)}`)
    if (i.tags?.length) lines.push(`CATEGORIES:${i.tags.map(escapeText).join(',')}`)
    lines.push('END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}

// Trigger a client-side download (user-initiated via a button).
export function downloadText(filename, text, mime = 'text/plain') {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
