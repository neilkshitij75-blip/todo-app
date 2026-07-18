import { useEffect, useState } from 'react'
import { getRecur } from '../lib/recurrence'

const TYPES = [
  { id: 'task', label: 'Task', emoji: '✓' },
  { id: 'event', label: 'Event', emoji: '📅' },
  { id: 'note', label: 'Note', emoji: '💡' },
]
const CATEGORIES = ['Health', 'Errands', 'Work', 'Study', 'Personal']

function uid() {
  return Math.random().toString(36).slice(2, 9)
}

function Row({ label, children }) {
  return (
    <label className="flex items-center justify-between gap-3 py-2">
      <span className="text-sm text-slate-500 dark:text-slate-400">{label}</span>
      {children}
    </label>
  )
}

const field =
  'rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-700 outline-none focus:border-violet-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100'

export default function DetailSheet({ item, onUpdate, onDelete, onClose }) {
  const [local, setLocal] = useState(item)
  const [tagInput, setTagInput] = useState('')
  const [subInput, setSubInput] = useState('')

  // The sheet is key-remounted per item in App, so local initialises fresh
  // from `item`; no sync effect needed.
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!item) return null

  const recur = getRecur(local) || { freq: 'none', interval: 1, until: null }
  const subs = Array.isArray(local.subtasks) ? local.subtasks : []

  // Apply a patch both locally (instant) and upstream (persist).
  function patch(p) {
    setLocal((prev) => ({ ...prev, ...p }))
    onUpdate(item.id, p)
  }

  function setRecur(next) {
    if (next.freq === 'none') patch({ recur: null, recurrence: null })
    else patch({ recur: next, recurrence: next.freq })
  }

  function addTag() {
    const t = tagInput.trim().replace(/^#/, '').toLowerCase()
    if (!t || local.tags?.includes(t)) return setTagInput('')
    patch({ tags: [...(local.tags || []), t] })
    setTagInput('')
  }

  function addSub() {
    const text = subInput.trim()
    if (!text) return
    patch({ subtasks: [...subs, { id: uid(), text, done: false }] })
    setSubInput('')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative max-h-[85svh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-white p-5 pb-[calc(env(safe-area-inset-bottom)+20px)] shadow-2xl dark:bg-slate-800 sm:rounded-3xl">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200 dark:bg-slate-600 sm:hidden" />

        {/* type */}
        <div className="mb-3 flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-900">
          {TYPES.map((t) => (
            <button
              key={t.id}
              onClick={() => patch({ type: t.id })}
              className={`flex-1 rounded-lg py-1.5 text-sm font-medium transition-colors ${
                local.type === t.id
                  ? 'bg-white text-slate-800 shadow-sm dark:bg-slate-700 dark:text-slate-100'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {t.emoji} {t.label}
            </button>
          ))}
        </div>

        {/* title */}
        <input
          value={local.text}
          onChange={(e) => setLocal({ ...local, text: e.target.value })}
          onBlur={() => local.text.trim() && local.text !== item.text && patch({ text: local.text.trim() })}
          className={`mb-2 w-full text-base font-medium ${field}`}
          placeholder="Title"
        />

        {/* notes */}
        <textarea
          value={local.notes || ''}
          onChange={(e) => setLocal({ ...local, notes: e.target.value })}
          onBlur={() => patch({ notes: local.notes || null })}
          rows={2}
          placeholder="Notes / details…"
          className={`mb-2 w-full resize-y ${field}`}
        />

        <div className="divide-y divide-slate-100 dark:divide-slate-700">
          {local.type !== 'note' && (
            <>
              <Row label="Date">
                <input
                  type="date"
                  value={local.due_date || ''}
                  onChange={(e) => patch({ due_date: e.target.value || null })}
                  className={field}
                />
              </Row>
              <Row label={local.type === 'event' ? 'Start' : 'Time'}>
                <input
                  type="time"
                  value={local.due_time ? local.due_time.slice(0, 5) : ''}
                  onChange={(e) => patch({ due_time: e.target.value || null })}
                  className={field}
                />
              </Row>
              {local.type === 'event' && (
                <Row label="End">
                  <input
                    type="time"
                    value={local.end_time ? local.end_time.slice(0, 5) : ''}
                    onChange={(e) => patch({ end_time: e.target.value || null })}
                    className={field}
                  />
                </Row>
              )}
            </>
          )}

          {local.type === 'task' && (
            <Row label="Category">
              <select value={local.category} onChange={(e) => patch({ category: e.target.value })} className={field}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </Row>
          )}

          <Row label="Priority">
            <button
              onClick={() => patch({ priority: !local.priority })}
              className={`rounded-full px-3 py-1 text-sm font-medium ${
                local.priority ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300'
              }`}
            >
              {local.priority ? '★ Starred' : '☆ Star'}
            </button>
          </Row>

          {local.type !== 'note' && (
            <Row label="Someday">
              <button
                onClick={() => patch({ someday: !local.someday })}
                className={`rounded-full px-3 py-1 text-sm font-medium ${
                  local.someday ? 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300'
                }`}
              >
                {local.someday ? 'In Someday' : 'Move to Someday'}
              </button>
            </Row>
          )}

          {local.type !== 'note' && (
            <div className="py-2">
              <div className="mb-1.5 text-sm text-slate-500 dark:text-slate-400">Repeat</div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={recur.freq}
                  onChange={(e) => setRecur({ ...recur, freq: e.target.value })}
                  className={field}
                >
                  <option value="none">Never</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
                {recur.freq !== 'none' && (
                  <>
                    <span className="text-sm text-slate-400">every</span>
                    <input
                      type="number"
                      min="1"
                      value={recur.interval}
                      onChange={(e) => setRecur({ ...recur, interval: Math.max(1, +e.target.value || 1) })}
                      className={`w-16 ${field}`}
                    />
                    <span className="text-sm text-slate-400">until</span>
                    <input
                      type="date"
                      value={recur.until || ''}
                      onChange={(e) => setRecur({ ...recur, until: e.target.value || null })}
                      className={field}
                    />
                  </>
                )}
              </div>
            </div>
          )}

          {/* tags */}
          <div className="py-2">
            <div className="mb-1.5 text-sm text-slate-500 dark:text-slate-400">Tags</div>
            <div className="flex flex-wrap items-center gap-1.5">
              {local.tags?.map((t) => (
                <span key={t} className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-500/20 dark:text-violet-300">
                  #{t}
                  <button onClick={() => patch({ tags: local.tags.filter((x) => x !== t) })} className="text-violet-400 hover:text-violet-600">×</button>
                </span>
              ))}
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                onBlur={addTag}
                placeholder="add tag"
                className={`w-24 ${field}`}
              />
            </div>
          </div>

          {/* subtasks */}
          <div className="py-2">
            <div className="mb-1.5 text-sm text-slate-500 dark:text-slate-400">Sub-tasks</div>
            <ul className="mb-1.5 flex flex-col gap-1">
              {subs.map((s) => (
                <li key={s.id} className="flex items-center gap-2">
                  <button
                    onClick={() => patch({ subtasks: subs.map((x) => (x.id === s.id ? { ...x, done: !x.done } : x)) })}
                    className={`flex h-4 w-4 items-center justify-center rounded border ${s.done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 dark:border-slate-500'}`}
                  >
                    {s.done && '✓'}
                  </button>
                  <span className={`flex-1 text-sm ${s.done ? 'text-slate-400 line-through' : 'text-slate-700 dark:text-slate-200'}`}>{s.text}</span>
                  <button onClick={() => patch({ subtasks: subs.filter((x) => x.id !== s.id) })} className="text-slate-300 hover:text-red-400">×</button>
                </li>
              ))}
            </ul>
            <input
              value={subInput}
              onChange={(e) => setSubInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSub())}
              placeholder="add a sub-task…"
              className={`w-full ${field}`}
            />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <button
            onClick={() => { onDelete(item); onClose() }}
            className="rounded-lg px-3 py-2 text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-slate-700"
          >
            Delete
          </button>
          <button
            onClick={onClose}
            className="rounded-lg bg-violet-600 px-5 py-2 text-sm font-medium text-white hover:bg-violet-700"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
