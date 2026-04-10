const CATEGORIES = {
  Health: {
    keywords: [
      'appointment', 'doctor', 'gp', 'dentist', 'dentist', 'hospital', 'clinic',
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

const SCHEDULED_KEYWORDS = [
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'today', 'tomorrow', 'tonight', 'next week', 'this week', 'next month',
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
  'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
  'morning', 'afternoon', 'evening',
  /\b\d{1,2}(st|nd|rd|th)?\b/, // matches "15th", "3rd", "1st", etc.
  /\b\d{1,2}[\/\-]\d{1,2}\b/, // matches "15/4", "3-12"
]

function extractScheduledDay(text) {
  const lower = text.toLowerCase()

  // Check regex patterns
  for (const kw of SCHEDULED_KEYWORDS) {
    if (kw instanceof RegExp) {
      const match = text.match(kw)
      if (match) return match[0]
      continue
    }
    if (lower.includes(kw)) {
      // Capitalize first letter
      return kw.charAt(0).toUpperCase() + kw.slice(1)
    }
  }
  return null
}

export function categorizeTask(text) {
  const lower = text.toLowerCase()

  // Score each category
  const scores = {}
  for (const [cat, { keywords }] of Object.entries(CATEGORIES)) {
    scores[cat] = keywords.reduce((acc, kw) => acc + (lower.includes(kw) ? 1 : 0), 0)
  }

  // Pick highest scoring category, default to Personal
  let bestCat = 'Personal'
  let bestScore = 0
  for (const [cat, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score
      bestCat = cat
    }
  }

  const scheduledDay = extractScheduledDay(text)

  return { category: bestCat, scheduledDay }
}
