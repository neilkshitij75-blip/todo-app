import { useRef, useState, useEffect } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { formatDue, isOverdue, isDueToday } from '../lib/dates'
import { recurLabel } from '../lib/recurrence'

const SWIPE_THRESHOLD = 80

const TYPE_META = {
  task: { accent: 'bg-violet-400' },
  event: { accent: 'bg-sky-400' },
  note: { accent: 'bg-amber-400' },
}

export default function ItemCard({
  item,
  onToggle,
  onDelete,
  onEditTitle,
  onToggleStar,
  onOpen,
  draggable = true,
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: !draggable,
  })

  const [offset, setOffset] = useState(0)
  const [snapBack, setSnapBack] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(item.text)
  const [justCompleted, setJustCompleted] = useState(false)

  const swipe = useRef({ startX: 0, startY: 0, active: false, down: false })
  const inputRef = useRef(null)

  useEffect(() => {
    if (editing) {
      const el = inputRef.current
      el?.focus()
      const len = el?.value.length ?? 0
      el?.setSelectionRange(len, len)
    }
  }, [editing])

  const isNote = item.type === 'note'
  const overdue = isOverdue(item)
  const dueToday = isDueToday(item)
  const dueLabel = formatDue(item)
  const recur = recurLabel(item)
  const subs = Array.isArray(item.subtasks) ? item.subtasks : []
  const subDone = subs.filter((s) => s.done).length

  function onPointerDown(e) {
    if (editing) return
    swipe.current = { startX: e.clientX, startY: e.clientY, active: false, down: true }
    setSnapBack(false)
  }

  function onPointerMove(e) {
    if (editing || !swipe.current.down) return
    const dx = e.clientX - swipe.current.startX
    const dy = e.clientY - swipe.current.startY
    if (!swipe.current.active) {
      if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
        swipe.current.active = true
        e.currentTarget.setPointerCapture?.(e.pointerId)
      } else {
        return
      }
    }
    e.preventDefault()
    // Notes can't be completed, so only allow left (delete) swipe.
    const clamped = Math.max(-140, Math.min(isNote ? 0 : 140, dx))
    setOffset(clamped)
  }

  function onPointerUp() {
    const wasActive = swipe.current.active
    swipe.current.down = false
    swipe.current.active = false
    if (!wasActive) return
    setSnapBack(true)
    if (!isNote && offset >= SWIPE_THRESHOLD) handleToggle()
    else if (offset <= -SWIPE_THRESHOLD) onDelete(item)
    setOffset(0)
  }

  function handleToggle() {
    if (!item.completed) {
      setJustCompleted(true)
      setTimeout(() => setJustCompleted(false), 300)
    }
    onToggle(item)
  }

  function saveEdit() {
    const text = draft.trim()
    setEditing(false)
    if (text && text !== item.text) onEditTitle(item.id, text)
    else setDraft(item.text)
  }

  const style = { transform: CSS.Transform.toString(transform), transition }
  const cardBorder = overdue
    ? 'border-red-300 dark:border-red-500/50'
    : 'border-slate-200/70 dark:border-slate-700'

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`relative overflow-hidden rounded-2xl ${isDragging ? 'z-10 shadow-lg' : ''}`}
    >
      <div className="absolute inset-0 flex items-center justify-between px-5">
        <span className="text-sm font-semibold text-white" style={{ opacity: offset > 20 ? 1 : 0 }}>
          ✓ Done
        </span>
        <span className="ml-auto text-sm font-semibold text-white" style={{ opacity: offset < -20 ? 1 : 0 }}>
          Delete
        </span>
      </div>
      <div
        className="absolute inset-0"
        style={{ background: offset > 20 ? '#10b981' : offset < -20 ? '#ef4444' : 'transparent' }}
      />

      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{
          transform: `translateX(${offset}px)`,
          transition: snapBack ? 'transform 0.2s ease' : 'none',
          touchAction: 'pan-y',
        }}
        className={`relative flex items-start gap-3 rounded-2xl border bg-white p-4 dark:bg-slate-800 ${cardBorder} ${
          item.completed ? 'opacity-60' : ''
        } ${justCompleted ? 'animate-complete' : ''}`}
      >
        {/* type accent strip */}
        <span className={`absolute left-0 top-3 bottom-3 w-1 rounded-full ${TYPE_META[item.type]?.accent || TYPE_META.task.accent}`} />

        {!isNote ? (
          <button
            onClick={handleToggle}
            aria-label={item.completed ? 'Mark incomplete' : 'Mark complete'}
            className={`ml-1 mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 transition-all cursor-pointer ${
              item.completed
                ? 'border-emerald-500 bg-emerald-500'
                : 'border-slate-300 hover:border-emerald-400 dark:border-slate-500'
            }`}
          >
            {item.completed && (
              <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
        ) : (
          <span className="ml-1 mt-0.5 text-base leading-none">💡</span>
        )}

        <div className="min-w-0 flex-1">
          {editing ? (
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={saveEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveEdit()
                if (e.key === 'Escape') { setDraft(item.text); setEditing(false) }
              }}
              className="w-full rounded-lg border border-violet-300 bg-white px-2 py-1 text-sm text-slate-800 outline-none focus:border-violet-500 dark:bg-slate-900 dark:text-slate-100"
            />
          ) : (
            <p
              onClick={() => !item.completed && setEditing(true)}
              className={`text-sm leading-relaxed ${
                item.completed
                  ? 'text-slate-400 line-through dark:text-slate-500'
                  : 'cursor-text text-slate-700 dark:text-slate-200'
              }`}
            >
              {item.text}
            </p>
          )}

          {item.notes && (
            <p className="mt-0.5 truncate text-xs text-slate-400 dark:text-slate-500">{item.notes}</p>
          )}

          {(dueLabel || recur || subs.length > 0 || item.tags?.length > 0) && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {dueLabel && (
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                    overdue
                      ? 'bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-300'
                      : dueToday
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
                        : 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300'
                  }`}
                >
                  {overdue ? '⚠️' : item.type === 'event' ? '🗓️' : '📅'} {dueLabel}
                </span>
              )}
              {recur && (
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-700 dark:text-slate-300">
                  🔁 {recur}
                </span>
              )}
              {subs.length > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-700 dark:text-slate-300">
                  ☑ {subDone}/{subs.length}
                </span>
              )}
              {item.tags?.map((t) => (
                <span key={t} className="rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-500 dark:bg-violet-500/10 dark:text-violet-300">
                  #{t}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-shrink-0 items-center gap-0.5">
          <button
            onClick={() => onToggleStar(item)}
            aria-label={item.priority ? 'Remove priority' : 'Mark priority'}
            className="flex h-7 w-7 items-center justify-center rounded-full text-base transition-colors cursor-pointer hover:bg-amber-50 dark:hover:bg-slate-700"
          >
            <span className={item.priority ? 'text-amber-400' : 'text-slate-300 dark:text-slate-500'}>
              {item.priority ? '★' : '☆'}
            </span>
          </button>

          {draggable && (
            <button
              {...attributes}
              {...listeners}
              aria-label="Drag to reorder"
              className="flex h-7 w-6 cursor-grab items-center justify-center text-slate-300 touch-none active:cursor-grabbing dark:text-slate-500"
            >
              <svg width="12" height="16" viewBox="0 0 12 16" fill="currentColor">
                <circle cx="3" cy="3" r="1.4" /><circle cx="9" cy="3" r="1.4" />
                <circle cx="3" cy="8" r="1.4" /><circle cx="9" cy="8" r="1.4" />
                <circle cx="3" cy="13" r="1.4" /><circle cx="9" cy="13" r="1.4" />
              </svg>
            </button>
          )}

          <button
            onClick={() => onOpen(item)}
            aria-label="Open details"
            className="flex h-7 w-7 items-center justify-center rounded-full text-slate-300 transition-colors cursor-pointer hover:bg-slate-100 hover:text-slate-500 dark:text-slate-500 dark:hover:bg-slate-700"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </li>
  )
}
