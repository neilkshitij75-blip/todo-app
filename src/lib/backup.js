import { downloadText } from './ics'

// Export every item as a JSON snapshot the user can re-import later.
export function exportJSON(tasks) {
  const payload = {
    app: 'my-tasks',
    version: 2,
    exportedAt: new Date().toISOString(),
    count: tasks.length,
    tasks,
  }
  const date = new Date().toISOString().slice(0, 10)
  downloadText(`my-tasks-backup-${date}.json`, JSON.stringify(payload, null, 2), 'application/json')
}

// Parse an imported backup file into an array of task rows. Strips ids so the
// rows can be inserted fresh (avoids clobbering existing ones). Throws on a
// malformed file.
export function parseImport(jsonText) {
  const data = JSON.parse(jsonText)
  const rows = Array.isArray(data) ? data : data.tasks
  if (!Array.isArray(rows)) throw new Error('Not a valid backup file')
  // Drop id/created_at so rows insert fresh instead of clobbering existing ones.
  return rows.map((r) => {
    const rest = { ...r }
    delete rest.id
    delete rest.created_at
    return rest
  })
}
