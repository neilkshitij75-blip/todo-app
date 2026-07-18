import * as chrono from 'chrono-node'

const CATEGORIES = {
  Health: {
    keywords: [
      'appointment', 'doctor', 'gp', 'dentist', 'hospital', 'clinic',
      'medicine', 'medication', 'prescription', 'pharmacy', 'gym', 'workout',
      'exercise', 'run', 'jog', 'yoga', 'therapy', 'therapist', 'health',
      'medical', 'nurse', 'physio', 'optician', 'optometrist', 'blood test',
      'checkup', 'check-up', 'wellbeing', 'mental health', 'diet', 'vitamin',
      'supplement', 'surgery', 'operation', 'vaccine', 'vaccination',
    ],
  },
  Errands: {
    keywords: [
      'buy', 'purchase', 'pick up', 'pickup', 'shop', 'shopping', 'groceries',
      'grocery', 'store', 'supermarket', 'order', 'collect', 'return', 'send',
      'mail', 'post', 'package', 'parcel', 'delivery', 'amazon', 'flowers',
      'gift', 'present', 'pay', 'bill', 'bank', 'atm', 'cash', 'dry cleaning',
      'laundry', 'repair', 'fix', 'get',
    ],
  },
  Work: {
    keywords: [
      'work', 'meeting', 'email', 'slack', 'call', 'interview', 'project',
      'deadline', 'report', 'presentation', 'client', 'colleague', 'boss',
      'manager', 'office', 'zoom', 'teams', 'standup', 'sprint', 'review',
      'feedback', 'proposal', 'contract', 'invoice', 'task', 'ticket',
      'deploy', 'launch', 'release', 'job', 'career', 'cv', 'resume',
      'application', 'apply', 'hr', 'onboarding',
    ],
  },
  Study: {
    keywords: [
      'study', 'read', 'reading', 'assignment', 'essay', 'thesis', 'dissertation',
      'exam', 'test', 'quiz', 'lecture', 'class', 'course', 'module',
      'homework', 'revision', 'revise', 'research', 'paper', 'submit',
      'submission', 'university', 'college', 'school', 'tutor', 'learn',
      'chapter', 'textbook', 'notes', 'library', 'grade', 'mark',
    ],
  },
  Personal: {
    keywords: [
      'call mum', 'call mom', 'call dad', 'call friend', 'family', 'friend',
      'birthday', 'anniversary', 'date', 'dinner', 'lunch', 'breakfast',
      'cook', 'clean', 'tidy', 'organise', 'organize', 'home', 'house',
      'flat', 'apartment', 'landlord', 'rent', 'move', 'passport', 'visa',
      'insurance', 'tax', 'council', 'garden', 'plant', 'pet', 'vet',
      'haircut', 'barber', 'salon', 'travel', 'holiday', 'trip', 'book',
      'flight', 'hotel', 'personal',
    ],
  },
}

// UK-style parser so "15/4" reads as 15 April, not April 15.
const parser = chrono.en.GB

function pad(n) {
  return String(n).padStart(2, '0')
}

function toDateString(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function toTimeString(comp) {
  return `${pad(comp.get('hour'))}:${pad(comp.get('minute') || 0)}`
}

// Resolve a bare ordinal day ("the 25th", "on the 3rd") to the next
// occurrence of that day-of-month — chrono ignores these on their own.
function parseBareOrdinal(text, ref) {
  const m = text.toLowerCase().match(/\b(?:on |by |the )?(\d{1,2})(st|nd|rd|th)\b/)
  if (!m) return null
  const day = parseInt(m[1], 10)
  if (day < 1 || day > 31) return null
  const d = new Date(ref.getFullYear(), ref.getMonth(), day)
  if (d.getMonth() !== ref.getMonth() || d < new Date(ref.getFullYear(), ref.getMonth(), ref.getDate())) {
    d.setFullYear(ref.getFullYear(), ref.getMonth() + 1, day)
  }
  return { dueDate: toDateString(d), dueTime: null, endTime: null }
}

/**
 * Parse date + optional start/end times from free text.
 * Returns { dueDate, dueTime, endTime } (any may be null).
 * dueTime/endTime only set when an explicit clock time is given; a time
 * range ("3-4pm", "10:00-11:30") also fills endTime.
 */
export function parseDueDate(text, ref = new Date()) {
  const results = parser.parse(text, ref, { forwardDate: true })
  if (!results.length) return parseBareOrdinal(text, ref) || { dueDate: null, dueTime: null, endTime: null }

  // Time comes from whichever result carries an explicit clock time.
  const timeRes = results.find((r) => r.start.isCertain('hour'))
  const dueTime = timeRes ? toTimeString(timeRes.start) : null
  const endTime = timeRes?.end?.isCertain('hour') ? toTimeString(timeRes.end) : null

  // Date comes from a result that names a day/weekday/month; otherwise fall
  // back to a bare ordinal ("the 25th"), then to the time result's date.
  const dateRes = results.find(
    (r) => r.start.isCertain('day') || r.start.isCertain('weekday') || r.start.isCertain('month'),
  )
  let dueDate
  if (dateRes) dueDate = toDateString(dateRes.start.date())
  else {
    const ordinal = parseBareOrdinal(text, ref)
    dueDate = ordinal ? ordinal.dueDate : toDateString((timeRes || results[0]).start.date())
  }

  return { dueDate, dueTime, endTime }
}

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

/**
 * Parse a recurrence rule from phrasing. Returns a { freq, interval, until }
 * object or null. Supports: daily / weekly / monthly, "every N days|weeks|
 * months", "every Monday" (weekly), and an optional "until <date>".
 */
export function parseRecurrence(text, ref = new Date()) {
  const lower = text.toLowerCase()
  let freq = null
  let interval = 1

  const everyN = lower.match(/\bevery\s+(\d+)\s+(day|week|month)s?\b/)
  if (everyN) {
    interval = Math.max(1, parseInt(everyN[1], 10))
    freq = { day: 'daily', week: 'weekly', month: 'monthly' }[everyN[2]]
  } else if (/\b(every day|everyday|daily|each day)\b/.test(lower)) {
    freq = 'daily'
  } else if (
    /\b(every week|weekly|each week)\b/.test(lower) ||
    WEEKDAYS.some((d) => new RegExp(`\\bevery ${d}\\b`).test(lower))
  ) {
    freq = 'weekly'
  } else if (/\b(every month|monthly|each month)\b/.test(lower)) {
    freq = 'monthly'
  }

  if (!freq) return null

  let until = null
  const untilMatch = lower.match(/\b(?:until|till|til)\s+(.+)$/)
  if (untilMatch) {
    const r = parser.parse(untilMatch[1], ref, { forwardDate: true })
    if (r.length) until = toDateString(r[0].start.date())
  }

  return { freq, interval, until }
}

// Extract #tags, returning { tags, cleaned } where cleaned has them removed.
export function extractTags(text) {
  const tags = []
  const cleaned = text
    .replace(/(^|\s)#([\w-]+)/g, (_, sp, tag) => {
      tags.push(tag.toLowerCase())
      return sp
    })
    .replace(/\s{2,}/g, ' ')
    .trim()
  return { tags, cleaned }
}

function pickCategory(text) {
  const lower = text.toLowerCase()
  let bestCat = 'Personal'
  let bestScore = 0
  for (const [cat, { keywords }] of Object.entries(CATEGORIES)) {
    const score = keywords.reduce((acc, kw) => acc + (lower.includes(kw) ? 1 : 0), 0)
    if (score > bestScore) {
      bestScore = score
      bestCat = cat
    }
  }
  return bestCat
}

/**
 * Full input parser for the add bar.
 * @param {string} raw   the typed text
 * @param {object} opts  { type: 'task'|'event'|'note', ref: Date }
 * @returns { type, title, category, dueDate, dueTime, endTime, recur, recurrence, tags }
 */
export function parseInput(raw, { type = 'task', ref = new Date() } = {}) {
  const { tags, cleaned } = extractTags(raw)
  const title = cleaned || raw.trim()
  const category = pickCategory(title)

  // Notes are pure capture — no date/recurrence parsing.
  if (type === 'note') {
    return { type, title, category, dueDate: null, dueTime: null, endTime: null, recur: null, recurrence: null, tags }
  }

  const { dueDate, dueTime, endTime } = parseDueDate(title, ref)
  const recur = parseRecurrence(title, ref)
  return {
    type,
    title,
    category,
    dueDate,
    dueTime,
    endTime,
    recur,
    recurrence: recur?.freq ?? null, // keep legacy column populated
    tags,
  }
}

// Back-compat helper retained for any older callers.
export function categorizeTask(text, ref = new Date()) {
  const { category, dueDate, dueTime, recurrence } = parseInput(text, { ref })
  return { category, dueDate, dueTime, recurrence }
}
