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

function pad(n) {
  return String(n).padStart(2, '0')
}

// Format a Date's local date part as YYYY-MM-DD (no timezone shift).
function toDateString(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// UK-style parser so "15/4" reads as 15 April, not April 15.
const parser = chrono.en.GB

// Resolve a bare ordinal day ("the 25th", "on the 3rd") to the next
// occurrence of that day-of-month — chrono ignores these on their own.
function parseBareOrdinal(text, ref) {
  const m = text.toLowerCase().match(/\b(?:on |by |the )?(\d{1,2})(st|nd|rd|th)\b/)
  if (!m) return null
  const day = parseInt(m[1], 10)
  if (day < 1 || day > 31) return null

  const d = new Date(ref.getFullYear(), ref.getMonth(), day)
  if (d.getMonth() !== ref.getMonth() || d < new Date(ref.getFullYear(), ref.getMonth(), ref.getDate())) {
    // Day already passed this month (or overflowed) → roll to next month.
    d.setFullYear(ref.getFullYear(), ref.getMonth() + 1, day)
  }
  return toDateString(d)
}

/**
 * Parse a natural-language due date/time out of free text using chrono.
 * Returns { dueDate: 'YYYY-MM-DD'|null, dueTime: 'HH:MM'|null }.
 * dueTime is only set when the user gave an explicit clock time
 * (e.g. "7am", "at 15:30") — vague words like "afternoon" leave it null.
 */
export function parseDueDate(text, ref = new Date()) {
  const results = parser.parse(text, ref, { forwardDate: true })
  if (!results.length) {
    return { dueDate: parseBareOrdinal(text, ref), dueTime: null }
  }

  const start = results[0].start
  const dueDate = toDateString(start.date())

  const hasTime = start.isCertain('hour')
  const dueTime = hasTime
    ? `${pad(start.get('hour'))}:${pad(start.get('minute') || 0)}`
    : null

  return { dueDate, dueTime }
}

// Detect a simple recurrence from phrasing like "daily", "every week",
// "every Monday". Returns 'daily' | 'weekly' | null.
export function detectRecurrence(text) {
  const lower = text.toLowerCase()
  if (/\b(every day|everyday|daily|each day)\b/.test(lower)) return 'daily'
  if (
    /\b(every week|weekly|each week)\b/.test(lower) ||
    /\bevery (monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/.test(lower)
  ) {
    return 'weekly'
  }
  return null
}

export function categorizeTask(text, ref = new Date()) {
  const lower = text.toLowerCase()

  // Score each category by keyword hits; default to Personal.
  let bestCat = 'Personal'
  let bestScore = 0
  for (const [cat, { keywords }] of Object.entries(CATEGORIES)) {
    const score = keywords.reduce((acc, kw) => acc + (lower.includes(kw) ? 1 : 0), 0)
    if (score > bestScore) {
      bestScore = score
      bestCat = cat
    }
  }

  const { dueDate, dueTime } = parseDueDate(text, ref)
  const recurrence = detectRecurrence(text)
  return { category: bestCat, dueDate, dueTime, recurrence }
}
