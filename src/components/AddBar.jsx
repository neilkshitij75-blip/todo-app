import { useState, useRef } from 'react'

const TYPES = [
  { id: 'task', label: 'Task', emoji: '✓' },
  { id: 'event', label: 'Event', emoji: '📅' },
  { id: 'note', label: 'Note', emoji: '💡' },
]

const PLACEHOLDERS = {
  task: 'e.g. gym at 7am tomorrow #health',
  event: 'e.g. dentist 3-4pm on the 25th',
  note: 'e.g. idea: try time-blocking #ideas',
}

export default function AddBar({ onAdd, adding }) {
  const [type, setType] = useState('task')
  const [input, setInput] = useState('')
  const inputRef = useRef(null)

  function submit(e) {
    e.preventDefault()
    const text = input.trim()
    if (!text || adding) return
    onAdd(text, type)
    setInput('')
    inputRef.current?.focus()
  }

  return (
    <div className="fixed inset-x-0 bottom-0 border-t border-slate-100/80 bg-white/85 px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-2.5 backdrop-blur-xl dark:border-slate-700/60 dark:bg-slate-800/85">
      <div className="mx-auto max-w-xl">
        <div className="mb-2 flex gap-1">
          {TYPES.map((t) => (
            <button
              key={t.id}
              onClick={() => setType(t.id)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                type === t.id
                  ? 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
              }`}
            >
              {t.emoji} {t.label}
            </button>
          ))}
        </div>
        <form onSubmit={submit} className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={PLACEHOLDERS[type]}
            disabled={adding}
            className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm outline-none transition-colors focus:border-violet-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          />
          <button
            type="submit"
            disabled={!input.trim() || adding}
            className="flex min-w-16 items-center justify-center rounded-xl bg-violet-600 px-5 py-3 text-sm font-medium text-white shadow-sm transition-all active:scale-95 disabled:opacity-40"
          >
            {adding ? (
              <div className="h-4 w-4 animate-spin-slow rounded-full border-2 border-white/40 border-t-white" />
            ) : (
              'Add'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
