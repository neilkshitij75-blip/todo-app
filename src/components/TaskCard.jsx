import { useRef, useState, useEffect } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { formatDue, isOverdue, isDueToday } from '../lib/dates'

const SWIPE_THRESHOLD = 80 // px to trigger complete/delete

export default function TaskCard({
  task,
  onToggle,
  onDelete,
  onEdit,
  onToggleStar,
  draggable = true,
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, disabled: !draggable })

  const [offset, setOffset] = useState(0)
  const [snapBack, setSnapBack] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(task.text)
  const [justCompleted, setJustCompleted] = useState(false)

  const swipe = useRef({ startX: 0, startY: 0, active: false, down: false })
  const inputRef = useRef(null)

  useEffect(() => {
    if (editing) {
      const el = inputRef.current
      el?.focus()
      // Cursor at end (non-destructive) rather than selecting all, so a tap
      // to tweak wording doesn't wipe the task on the first keystroke.
      const len = el?.value.length ?? 0
      el?.setSelectionRange(len, len)
    }
  }, [editing])

  const overdue = isOverdue(task)
  const dueToday = isDueToday(task)
  const dueLabel = formatDue(task)

  // ---- Swipe handling (pointer events on the card body) ----
  function onPointerDown(e) {
    if (editing) return
    // Only react to a primary press that actually landed on this card — not
    // to pointer events that wander in from a neighbouring card's drag.
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
    // Resist over-drag a little.
    const clamped = Math.max(-140, Math.min(140, dx))
    setOffset(clamped)
  }

  function onPointerUp() {
    const wasActive = swipe.current.active
    swipe.current.down = false
    swipe.current.active = false
    if (!wasActive) return
    setSnapBack(true)
    if (offset >= SWIPE_THRESHOLD) {
      handleToggle()
    } else if (offset <= -SWIPE_THRESHOLD) {
      onDelete(task)
    }
    setOffset(0)
  }

  function handleToggle() {
    if (!task.completed) {
      setJustCompleted(true)
      setTimeout(() => setJustCompleted(false), 300)
    }
    onToggle(task)
  }

  function saveEdit() {
    const text = draft.trim()
    setEditing(false)
    if (text && text !== task.text) onEdit(task.id, text)
    else setDraft(task.text)
  }

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const cardBorder = overdue
    ? 'border-red-300 dark:border-red-500/50'
    : 'border-slate-200/70 dark:border-slate-700'

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`relative overflow-hidden rounded-2xl ${isDragging ? 'z-10 shadow-lg' : ''}`}
    >
      {/* Reveal layers behind the card */}
      <div className="absolute inset-0 flex items-center justify-between px-5 rounded-2xl">
        <span
          className="text-sm font-semibold text-white transition-opacity"
          style={{ opacity: offset > 20 ? 1 : 0 }}
        >
          ✓ Done
        </span>
        <span
          className="ml-auto text-sm font-semibold text-white transition-opacity"
          style={{ opacity: offset < -20 ? 1 : 0 }}
        >
          Delete
        </span>
      </div>
      <div
        className="absolute inset-0 rounded-2xl transition-colors"
        style={{
          background:
            offset > 20 ? '#10b981' : offset < -20 ? '#ef4444' : 'transparent',
        }}
      />

      {/* Swipeable card body */}
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
          task.completed ? 'opacity-60' : ''
        } ${justCompleted ? 'animate-complete' : ''}`}
      >
        {/* Complete checkbox */}
        <button
          onClick={handleToggle}
          aria-label={task.completed ? 'Mark incomplete' : 'Mark complete'}
          className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 transition-all cursor-pointer ${
            task.completed
              ? 'border-emerald-500 bg-emerald-500'
              : 'border-slate-300 hover:border-emerald-400 dark:border-slate-500'
          }`}
        >
          {task.completed && (
            <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>

        {/* Text + badges */}
        <div className="min-w-0 flex-1">
          {editing ? (
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={saveEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveEdit()
                if (e.key === 'Escape') {
                  setDraft(task.text)
                  setEditing(false)
                }
              }}
              className="w-full rounded-lg border border-violet-300 bg-white px-2 py-1 text-sm text-slate-800 outline-none focus:border-violet-500 dark:bg-slate-900 dark:text-slate-100"
            />
          ) : (
            <p
              onClick={() => !task.completed && setEditing(true)}
              className={`text-sm leading-relaxed ${
                task.completed
                  ? 'text-slate-400 line-through dark:text-slate-500'
                  : 'cursor-text text-slate-700 dark:text-slate-200'
              }`}
            >
              {task.text}
            </p>
          )}

          {(dueLabel || task.recurrence) && (
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
                  {overdue ? '⚠️' : '📅'} {dueLabel}
                </span>
              )}
              {task.recurrence && (
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-700 dark:text-slate-300">
                  🔁 {task.recurrence}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Right controls: star, drag handle, delete */}
        <div className="flex flex-shrink-0 items-center gap-0.5">
          <button
            onClick={() => onToggleStar(task)}
            aria-label={task.priority ? 'Remove priority' : 'Mark priority'}
            className="flex h-7 w-7 items-center justify-center rounded-full text-base transition-colors cursor-pointer hover:bg-amber-50 dark:hover:bg-slate-700"
          >
            <span className={task.priority ? 'text-amber-400' : 'text-slate-300 dark:text-slate-500'}>
              {task.priority ? '★' : '☆'}
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
            onClick={() => onDelete(task)}
            aria-label="Delete task"
            className="flex h-7 w-7 items-center justify-center rounded-full text-lg leading-none text-slate-300 transition-colors cursor-pointer hover:bg-red-50 hover:text-red-400 dark:text-slate-500 dark:hover:bg-slate-700"
          >
            ×
          </button>
        </div>
      </div>
    </li>
  )
}
