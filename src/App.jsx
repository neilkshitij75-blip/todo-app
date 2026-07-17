import { useState, useEffect, useRef } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { supabase } from './supabase'
import { categorizeTask } from './categorize'
import { dueSortValue, isOverdue, isDueToday, addDays, todayStr } from './lib/dates'
import { recordVisit, getDoneToday, bumpDone } from './lib/streak'
import { useDarkMode } from './hooks/useDarkMode'
import TaskCard from './components/TaskCard'
import Toast from './components/Toast'
import './index.css'

const TABS = [
  { id: 'Today',     emoji: '📌', label: 'Today' },
  { id: 'Health',    emoji: '🏥', label: 'Health' },
  { id: 'Errands',   emoji: '🛒', label: 'Errands' },
  { id: 'Work',      emoji: '💼', label: 'Work' },
  { id: 'Study',     emoji: '🎓', label: 'Study' },
  { id: 'Personal',  emoji: '🏠', label: 'Personal' },
  { id: 'Scheduled', emoji: '📅', label: 'Scheduled' },
]

const CATEGORY_TABS = ['Health', 'Errands', 'Work', 'Study', 'Personal']

// Order within a category tab: incomplete first, then by manual sort_order
// (nulls last), tiebreak newest first. Completed tasks sink to the bottom.
function byManualOrder(a, b) {
  if (a.completed !== b.completed) return a.completed ? 1 : -1
  const ao = a.sort_order ?? Infinity
  const bo = b.sort_order ?? Infinity
  if (ao !== bo) return ao - bo
  return new Date(b.created_at) - new Date(a.created_at)
}

// Order for date-driven tabs: incomplete first, then soonest due first.
function byDue(a, b) {
  if (a.completed !== b.completed) return a.completed ? 1 : -1
  return dueSortValue(a) - dueSortValue(b)
}

export default function App() {
  const [tasks, setTasks] = useState([])
  const [activeTab, setActiveTab] = useState('Today')
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState(null)
  const [toast, setToast] = useState(null)
  // recordVisit is idempotent per calendar day, so computing it once in the
  // lazy initializer (rather than in an effect) is safe and avoids a re-render.
  const [stats, setStats] = useState(() => ({ streak: recordVisit(), done: getDoneToday() }))

  const [isDark, toggleDark] = useDarkMode()
  const inputRef = useRef(null)
  const deleteTimers = useRef({})

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  useEffect(() => {
    async function loadTasks() {
      setLoading(true)
      const { data, error } = await supabase.from('tasks').select('*')
      if (error) {
        setError('Failed to load tasks. Check your Supabase credentials in .env.local')
        console.error(error)
      } else {
        setTasks(data || [])
        setError(null)
      }
      setLoading(false)
    }
    loadTasks()
  }, [])

  function showToast(message, onUndo) {
    setToast({ message, onUndo })
  }

  // ---- Add ----
  async function addTask(e) {
    e.preventDefault()
    const text = input.trim()
    if (!text || adding) return

    setAdding(true)
    setError(null)
    const { category, dueDate, dueTime, recurrence } = categorizeTask(text)
    const minOrder = tasks.reduce((m, t) => Math.min(m, t.sort_order ?? 0), 0)

    const newTask = {
      text,
      category,
      due_date: dueDate,
      due_time: dueTime,
      recurrence,
      completed: false,
      priority: false,
      sort_order: minOrder - 1,
    }

    const { data, error } = await supabase.from('tasks').insert([newTask]).select().single()
    if (error) {
      console.error(error)
      setError('Failed to add task. Check your Supabase credentials.')
    } else {
      setTasks((prev) => [data, ...prev])
      setInput('')
      setActiveTab(isOverdue(data) || isDueToday(data) ? 'Today' : category)
    }
    setAdding(false)
    inputRef.current?.focus()
  }

  // ---- Toggle complete (+ recurrence spawn + haptics + stats) ----
  function toggleTask(task) {
    return setCompleted(task, !task.completed)
  }

  async function setCompleted(task, nowComplete, { spawn = true, toast = true } = {}) {
    if (nowComplete) {
      navigator.vibrate?.(15)
      setStats((s) => ({ ...s, done: bumpDone(1) }))
    } else {
      setStats((s) => ({ ...s, done: bumpDone(-1) }))
    }

    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, completed: nowComplete } : t)),
    )
    const { error } = await supabase
      .from('tasks')
      .update({ completed: nowComplete })
      .eq('id', task.id)
    if (error) console.error(error)

    // Spawn the next occurrence when a recurring task is completed.
    if (nowComplete && spawn && task.recurrence) {
      await spawnNextOccurrence(task)
    }

    // Undo only offered when completing; undoing just marks it incomplete
    // again (no re-spawn, no cascading toast).
    if (toast && nowComplete) {
      showToast('Task completed', () =>
        setCompleted(task, false, { spawn: false, toast: false }),
      )
    }
  }

  async function spawnNextOccurrence(task) {
    const step = task.recurrence === 'weekly' ? 7 : 1
    const base = task.due_date || todayStr()
    const next = {
      text: task.text,
      category: task.category,
      due_date: addDays(base, step),
      due_time: task.due_time,
      recurrence: task.recurrence,
      priority: task.priority,
      completed: false,
      sort_order: (task.sort_order ?? 0) - 0.5,
    }
    const { data, error } = await supabase.from('tasks').insert([next]).select().single()
    if (error) console.error(error)
    else setTasks((prev) => [data, ...prev])
  }

  // ---- Delete (soft, with undo) ----
  function deleteTask(task) {
    setTasks((prev) => prev.filter((t) => t.id !== task.id))
    showToast('Task deleted', () => {
      clearTimeout(deleteTimers.current[task.id])
      delete deleteTimers.current[task.id]
      setTasks((prev) => [task, ...prev.filter((t) => t.id !== task.id)])
    })
    deleteTimers.current[task.id] = setTimeout(async () => {
      delete deleteTimers.current[task.id]
      const { error } = await supabase.from('tasks').delete().eq('id', task.id)
      if (error) {
        console.error(error)
        setTasks((prev) => [task, ...prev.filter((t) => t.id !== task.id)])
      }
    }, 4200)
  }

  // ---- Inline edit ----
  async function editTask(id, text) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, text } : t)))
    const { error } = await supabase.from('tasks').update({ text }).eq('id', id)
    if (error) console.error(error)
  }

  // ---- Star / priority ----
  async function toggleStar(task) {
    const priority = !task.priority
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, priority } : t)))
    const { error } = await supabase.from('tasks').update({ priority }).eq('id', task.id)
    if (error) console.error(error)
  }

  async function clearCompleted() {
    const ids = currentTasks.filter((t) => t.completed).map((t) => t.id)
    if (!ids.length) return
    setTasks((prev) => prev.filter((t) => !ids.includes(t.id)))
    const { error } = await supabase.from('tasks').delete().in('id', ids)
    if (error) console.error(error)
  }

  // ---- Drag reorder (category tabs only) ----
  async function onDragEnd(event) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const ordered = currentTasks
    const oldIndex = ordered.findIndex((t) => t.id === active.id)
    const newIndex = ordered.findIndex((t) => t.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return

    const reordered = arrayMove(ordered, oldIndex, newIndex)
    const updates = reordered.map((t, i) => ({ id: t.id, sort_order: i }))

    setTasks((prev) =>
      prev.map((t) => {
        const u = updates.find((x) => x.id === t.id)
        return u ? { ...t, sort_order: u.sort_order } : t
      }),
    )
    await Promise.all(
      updates.map((u) =>
        supabase.from('tasks').update({ sort_order: u.sort_order }).eq('id', u.id),
      ),
    ).catch((e) => console.error(e))
  }

  // ---- Derived per-tab list ----
  function computeCurrentTasks() {
    if (activeTab === 'Today') {
      return tasks
        .filter((t) => !t.completed && (isOverdue(t) || isDueToday(t)))
        .sort(byDue)
    }
    if (activeTab === 'Scheduled') {
      return tasks.filter((t) => t.due_date).sort(byDue)
    }
    return tasks.filter((t) => t.category === activeTab).sort(byManualOrder)
  }
  const currentTasks = computeCurrentTasks()

  function tabCount(tabId) {
    if (tabId === 'Today') {
      return tasks.filter((t) => !t.completed && (isOverdue(t) || isDueToday(t))).length
    }
    if (tabId === 'Scheduled') {
      return tasks.filter((t) => t.due_date && !t.completed).length
    }
    return tasks.filter((t) => t.category === tabId && !t.completed).length
  }

  const isCategoryTab = CATEGORY_TABS.includes(activeTab)
  const completedCount = currentTasks.filter((t) => t.completed).length
  const activeMeta = TABS.find((t) => t.id === activeTab)

  const list = (
    <ul className="mx-auto flex max-w-xl flex-col gap-2">
      {currentTasks.map((task) => (
        <TaskCard
          key={task.id}
          task={task}
          onToggle={toggleTask}
          onDelete={deleteTask}
          onEdit={editTask}
          onToggleStar={toggleStar}
          draggable={isCategoryTab && !task.completed}
        />
      ))}
    </ul>
  )

  return (
    <div className="flex min-h-[100svh] flex-col bg-violet-50 dark:bg-slate-900">
      {/* Header */}
      <header className="px-4 pt-[calc(env(safe-area-inset-top)+24px)] pb-2">
        <div className="mx-auto flex max-w-xl items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-800 dark:text-slate-100">
              My Tasks
            </h1>
            <p className="mt-0.5 text-[13px] text-slate-400 dark:text-slate-500">
              Type naturally — I'll sort it out
            </p>
          </div>
          <button
            onClick={toggleDark}
            aria-label="Toggle dark mode"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-lg shadow-sm transition-transform active:scale-95 dark:bg-slate-800"
          >
            {isDark ? '☀️' : '🌙'}
          </button>
        </div>

        {/* Stats strip */}
        <div className="mx-auto mt-3 flex max-w-xl items-center gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm shadow-sm dark:bg-slate-800">
            <span className="text-base">✅</span>
            <span className="font-semibold text-slate-700 dark:text-slate-200">{stats.done}</span>
            <span className="text-slate-400 dark:text-slate-500">done today</span>
          </div>
          <div className="flex flex-1 items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm shadow-sm dark:bg-slate-800">
            <span className="text-base">🔥</span>
            <span className="font-semibold text-slate-700 dark:text-slate-200">{stats.streak}</span>
            <span className="text-slate-400 dark:text-slate-500">day streak</span>
          </div>
        </div>
      </header>

      {error && (
        <div className="mx-4 mb-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center text-[13px] text-red-600 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Tab bar */}
      <div className="overflow-x-auto px-4">
        <div className="mx-auto flex w-max min-w-full max-w-2xl justify-center gap-1 pb-1">
          {TABS.map((tab) => {
            const count = tabCount(tab.id)
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${
                  active
                    ? 'border-slate-200 bg-white text-slate-800 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <span>{tab.emoji}</span>
                <span>{tab.label}</span>
                {count > 0 && (
                  <span
                    className={`rounded-full px-1.5 text-[11px] font-semibold ${
                      active
                        ? 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300'
                        : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Task list */}
      <main className="flex-1 overflow-y-auto px-4 pb-32 pt-4">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-6 w-6 animate-spin-slow rounded-full border-2 border-slate-200 border-t-violet-400 dark:border-slate-700 dark:border-t-violet-400" />
          </div>
        ) : currentTasks.length === 0 ? (
          <div className="py-16 text-center text-slate-400 dark:text-slate-500">
            <div className="mb-3 text-5xl">{activeTab === 'Today' ? '🎉' : activeMeta?.emoji}</div>
            <p className="text-sm">
              {activeTab === 'Today' ? 'All clear for today.' : 'No tasks here yet.'}
            </p>
            <p className="mt-1 text-xs">
              {activeTab === 'Today' ? 'Enjoy the calm — or add something below.' : 'Add one using the bar below.'}
            </p>
          </div>
        ) : (
          <>
            {isCategoryTab ? (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <SortableContext items={currentTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                  {list}
                </SortableContext>
              </DndContext>
            ) : (
              list
            )}

            {completedCount > 0 && (
              <div className="mx-auto max-w-xl pt-3 text-center">
                <button
                  onClick={clearCompleted}
                  className="text-xs text-slate-400 underline underline-offset-2 hover:text-red-400 dark:text-slate-500"
                >
                  Clear {completedCount} completed
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* Input bar */}
      <div className="fixed inset-x-0 bottom-0 border-t border-slate-100/80 bg-white/85 px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 backdrop-blur-xl dark:border-slate-700/60 dark:bg-slate-800/85">
        <form onSubmit={addTask} className="mx-auto flex max-w-xl gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g. gym at 7am tomorrow…"
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

      <Toast
        toast={toast}
        onUndo={() => setToast(null)}
        onDismiss={() => setToast(null)}
      />
    </div>
  )
}
