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
import { parseInput } from './categorize'
import { dueSortValue, isOverdue, isDueToday, todayStr, nextDays, dayHeading } from './lib/dates'
import { nextDueDate } from './lib/recurrence'
import { recordVisit, getDoneToday, bumpDone } from './lib/streak'
import { buildICS, downloadText } from './lib/ics'
import { exportJSON, parseImport } from './lib/backup'
import { useDarkMode } from './hooks/useDarkMode'
import ItemCard from './components/ItemCard'
import DetailSheet from './components/DetailSheet'
import AddBar from './components/AddBar'
import StatsView from './components/StatsView'
import Toast from './components/Toast'
import './index.css'

const NAV = [
  { id: 'today', emoji: '📌', label: 'Today' },
  { id: 'lists', emoji: '🗂️', label: 'Lists' },
  { id: 'week', emoji: '📅', label: 'Week' },
  { id: 'ideas', emoji: '💡', label: 'Ideas' },
  { id: 'stats', emoji: '📊', label: 'Stats' },
]
const CATEGORIES = ['Health', 'Errands', 'Work', 'Study', 'Personal']
const LIST_BUCKETS = ['All', ...CATEGORIES, 'Someday']

function byManualOrder(a, b) {
  if (a.completed !== b.completed) return a.completed ? 1 : -1
  const ao = a.sort_order ?? Infinity
  const bo = b.sort_order ?? Infinity
  if (ao !== bo) return ao - bo
  return new Date(b.created_at) - new Date(a.created_at)
}
function byDue(a, b) {
  if (a.completed !== b.completed) return a.completed ? 1 : -1
  return dueSortValue(a) - dueSortValue(b)
}

export default function App() {
  const [tasks, setTasks] = useState([])
  const [view, setView] = useState('today')
  const [bucket, setBucket] = useState('All')
  const [search, setSearch] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState(null)
  const [toast, setToast] = useState(null)
  const [detail, setDetail] = useState(null)
  const [stats, setStats] = useState(() => ({ streak: recordVisit(), done: getDoneToday() }))

  const [isDark, toggleDark] = useDarkMode()
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

  // ---- Add (optimistic; works offline via client-generated id) ----
  async function addItem(raw, type) {
    setAdding(true)
    setError(null)
    const parsed = parseInput(raw, { type })
    const minOrder = tasks.reduce((m, t) => Math.min(m, t.sort_order ?? 0), 0)
    const id = crypto.randomUUID()
    const row = {
      id,
      text: parsed.title,
      type: parsed.type,
      category: parsed.category,
      due_date: parsed.dueDate,
      due_time: parsed.dueTime,
      end_time: parsed.endTime,
      recur: parsed.recur,
      recurrence: parsed.recurrence,
      tags: parsed.tags,
      notes: null,
      subtasks: [],
      completed: false,
      priority: false,
      someday: false,
      sort_order: minOrder - 1,
      created_at: new Date().toISOString(),
    }
    setTasks((prev) => [row, ...prev])

    // Route the view so the new item is visible.
    if (parsed.type === 'note') setView('ideas')
    else if (isOverdue(row) || isDueToday(row)) setView('today')
    else { setView('lists'); setBucket('All') }

    const { data, error } = await supabase.from('tasks').insert([row]).select().single()
    if (error) {
      // Offline / no backend: keep the optimistic row (SW will replay the write).
      console.error(error)
    } else if (data) {
      setTasks((prev) => prev.map((t) => (t.id === id ? data : t)))
    }
    setAdding(false)
  }

  // ---- Complete (+ recurrence spawn + haptics + stats) ----
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
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, completed: nowComplete } : t)))
    const { error } = await supabase.from('tasks').update({ completed: nowComplete }).eq('id', task.id)
    if (error) console.error(error)

    if (nowComplete && spawn) await spawnNextOccurrence(task)
    if (toast && nowComplete) {
      showToast('Completed', () => setCompleted(task, false, { spawn: false, toast: false }))
    }
  }

  async function spawnNextOccurrence(task) {
    const next = nextDueDate(task)
    if (!next) return
    const id = crypto.randomUUID()
    const row = {
      ...task,
      id,
      due_date: next,
      completed: false,
      subtasks: (task.subtasks || []).map((s) => ({ ...s, done: false })),
      sort_order: (task.sort_order ?? 0) - 0.5,
      created_at: new Date().toISOString(),
    }
    setTasks((prev) => [row, ...prev])
    const { data, error } = await supabase.from('tasks').insert([row]).select().single()
    if (error) console.error(error)
    else if (data) setTasks((prev) => prev.map((t) => (t.id === id ? data : t)))
  }

  // ---- Delete (soft, with undo) ----
  function deleteTask(task) {
    setTasks((prev) => prev.filter((t) => t.id !== task.id))
    if (detail?.id === task.id) setDetail(null)
    showToast('Deleted', () => {
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

  // ---- Update (from detail sheet) ----
  async function updateItem(id, patch) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)))
    setDetail((d) => (d && d.id === id ? { ...d, ...patch } : d))
    const { error } = await supabase.from('tasks').update(patch).eq('id', id)
    if (error) console.error(error)
  }
  const editTitle = (id, text) => updateItem(id, { text })
  const toggleStar = (task) => updateItem(task.id, { priority: !task.priority })

  async function clearCompleted(list) {
    const ids = list.filter((t) => t.completed).map((t) => t.id)
    if (!ids.length) return
    setTasks((prev) => prev.filter((t) => !ids.includes(t.id)))
    const { error } = await supabase.from('tasks').delete().in('id', ids)
    if (error) console.error(error)
  }

  // ---- Carry overdue tasks to today (Plan my day) ----
  async function carryOverdue() {
    const overdue = tasks.filter((t) => isOverdue(t))
    if (!overdue.length) return
    const today = todayStr()
    const ids = overdue.map((t) => t.id)
    setTasks((prev) => prev.map((t) => (ids.includes(t.id) ? { ...t, due_date: today } : t)))
    await Promise.all(
      ids.map((id) => supabase.from('tasks').update({ due_date: today }).eq('id', id)),
    ).catch((e) => console.error(e))
    showToast(`Moved ${ids.length} to today`)
  }

  // ---- Drag reorder ----
  async function onDragEnd(event, ordered) {
    const { active, over } = event
    if (!over || active.id === over.id) return
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
      updates.map((u) => supabase.from('tasks').update({ sort_order: u.sort_order }).eq('id', u.id)),
    ).catch((e) => console.error(e))
  }

  // ---- Export / import ----
  function onExportICS() {
    downloadText('my-tasks.ics', buildICS(tasks), 'text/calendar')
    showToast('Calendar exported')
  }
  async function onImportJSON(file) {
    try {
      const rows = parseImport(await file.text())
      const withIds = rows.map((r) => ({ ...r, id: crypto.randomUUID() }))
      setTasks((prev) => [...withIds, ...prev])
      await supabase.from('tasks').insert(withIds)
      showToast(`Imported ${withIds.length} items`)
    } catch (e) {
      console.error(e)
      setError('Import failed — not a valid backup file.')
    }
  }

  // ---- Derived lists ----
  const q = search.trim().toLowerCase()
  const searchResults = q
    ? tasks.filter((t) =>
        [t.text, t.notes, ...(t.tags || [])].filter(Boolean).some((s) => s.toLowerCase().includes(q)),
      ).sort(byDue)
    : null

  function todayItems() {
    return tasks
      .filter((t) => !t.completed && t.type !== 'note' && (isOverdue(t) || isDueToday(t)))
      .sort(byDue)
  }
  function bucketItems() {
    if (bucket === 'Someday') return tasks.filter((t) => t.someday && t.type !== 'note').sort(byManualOrder)
    if (bucket === 'All') return tasks.filter((t) => t.type !== 'note' && !t.someday).sort(byManualOrder)
    return tasks.filter((t) => t.type === 'task' && t.category === bucket && !t.someday).sort(byManualOrder)
  }
  function ideaItems() {
    return tasks.filter((t) => t.type === 'note').sort(byManualOrder)
  }
  function weekGroups() {
    return nextDays(7).map((date) => ({
      date,
      items: tasks
        .filter((t) => !t.completed && t.due_date === date)
        .sort((a, b) => dueSortValue(a) - dueSortValue(b)),
    }))
  }

  const cardHandlers = {
    onToggle: toggleTask,
    onDelete: deleteTask,
    onEditTitle: editTitle,
    onToggleStar: toggleStar,
    onOpen: setDetail,
  }

  function List({ items, draggable }) {
    const ul = (
      <ul className="mx-auto flex max-w-xl flex-col gap-2">
        {items.map((item) => (
          <ItemCard key={item.id} item={item} draggable={draggable && !item.completed} {...cardHandlers} />
        ))}
      </ul>
    )
    if (!draggable) return ul
    return (
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => onDragEnd(e, items)}>
        <SortableContext items={items.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {ul}
        </SortableContext>
      </DndContext>
    )
  }

  function Empty({ emoji, title, hint }) {
    return (
      <div className="py-16 text-center text-slate-400 dark:text-slate-500">
        <div className="mb-3 text-5xl">{emoji}</div>
        <p className="text-sm">{title}</p>
        {hint && <p className="mt-1 text-xs">{hint}</p>}
      </div>
    )
  }

  // ---- Render main content ----
  function content() {
    if (searchResults) {
      return searchResults.length ? (
        <List items={searchResults} draggable={false} />
      ) : (
        <Empty emoji="🔍" title="No matches." hint={`Nothing found for “${search.trim()}”.`} />
      )
    }

    if (view === 'stats') {
      return (
        <StatsView
          tasks={tasks}
          stats={stats}
          isDark={isDark}
          onToggleDark={toggleDark}
          onExportJSON={() => { exportJSON(tasks); showToast('Backup downloaded') }}
          onExportICS={onExportICS}
          onImportJSON={onImportJSON}
        />
      )
    }

    if (view === 'today') {
      const items = todayItems()
      const overdue = tasks.filter((t) => isOverdue(t)).length
      const events = items.filter((t) => t.type === 'event').length
      return (
        <div className="mx-auto max-w-xl">
          <div className="mb-3 rounded-2xl border border-slate-200/70 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {items.length === 0
                ? 'Nothing due today. 🎉'
                : `${items.length} due today${events ? ` · ${events} event${events > 1 ? 's' : ''}` : ''}${overdue ? ` · ${overdue} overdue` : ''}.`}
            </p>
            {overdue > 0 && (
              <button
                onClick={carryOverdue}
                className="mt-2 rounded-lg bg-violet-100 px-3 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-200 dark:bg-violet-500/20 dark:text-violet-300"
              >
                ↪ Move {overdue} overdue to today
              </button>
            )}
          </div>
          {items.length ? <List items={items} draggable={false} /> : (
            <Empty emoji="🎉" title="All clear for today." hint="Enjoy the calm — or capture something below." />
          )}
        </div>
      )
    }

    if (view === 'lists') {
      const items = bucketItems()
      const completed = items.filter((t) => t.completed)
      return (
        <>
          <div className="mx-auto mb-3 flex max-w-xl gap-1 overflow-x-auto">
            {LIST_BUCKETS.map((b) => (
              <button
                key={b}
                onClick={() => setBucket(b)}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  bucket === b
                    ? 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                }`}
              >
                {b}
              </button>
            ))}
          </div>
          {items.length ? (
            <>
              <List items={items} draggable={bucket !== 'All' && bucket !== 'Someday'} />
              {completed.length > 0 && (
                <div className="mx-auto max-w-xl pt-3 text-center">
                  <button onClick={() => clearCompleted(items)} className="text-xs text-slate-400 underline underline-offset-2 hover:text-red-400 dark:text-slate-500">
                    Clear {completed.length} completed
                  </button>
                </div>
              )}
            </>
          ) : (
            <Empty emoji="🗂️" title="Nothing here yet." hint="Add a task below." />
          )}
        </>
      )
    }

    if (view === 'week') {
      const groups = weekGroups()
      const any = groups.some((g) => g.items.length)
      if (!any) return <Empty emoji="📅" title="Nothing scheduled this week." hint="Add an event or a dated task." />
      return (
        <div className="mx-auto flex max-w-xl flex-col gap-4">
          {groups.map((g) => (
            <div key={g.date}>
              <div className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                {dayHeading(g.date)}
              </div>
              {g.items.length ? (
                <List items={g.items} draggable={false} />
              ) : (
                <p className="px-1 text-xs text-slate-300 dark:text-slate-600">—</p>
              )}
            </div>
          ))}
        </div>
      )
    }

    if (view === 'ideas') {
      const items = ideaItems()
      return items.length ? (
        <List items={items} draggable />
      ) : (
        <Empty emoji="💡" title="No ideas captured yet." hint="Switch the bar to “Note” and jot one down." />
      )
    }
  }

  return (
    <div className="flex min-h-[100svh] flex-col bg-violet-50 dark:bg-slate-900">
      <header className="px-4 pt-[calc(env(safe-area-inset-top)+20px)] pb-2">
        <div className="mx-auto flex max-w-xl items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-800 dark:text-slate-100">My Agenda</h1>
            <p className="mt-0.5 text-[13px] text-slate-400 dark:text-slate-500">
              🔥 {stats.streak} day streak · {stats.done} done today
            </p>
          </div>
          <button
            onClick={() => { setSearchOpen((o) => !o); if (searchOpen) setSearch('') }}
            aria-label="Search"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-lg shadow-sm active:scale-95 dark:bg-slate-800"
          >
            🔍
          </button>
        </div>

        {searchOpen && (
          <div className="mx-auto mt-3 max-w-xl">
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks, notes, #tags…"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm outline-none focus:border-violet-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
        )}
      </header>

      {error && (
        <div className="mx-4 mb-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center text-[13px] text-red-600 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </div>
      )}

      {/* primary nav */}
      {!searchResults && (
        <div className="overflow-x-auto px-4">
          <div className="mx-auto flex w-max min-w-full max-w-xl justify-center gap-1 pb-1">
            {NAV.map((n) => {
              const active = view === n.id
              return (
                <button
                  key={n.id}
                  onClick={() => setView(n.id)}
                  className={`flex items-center gap-1.5 whitespace-nowrap rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${
                    active
                      ? 'border-slate-200 bg-white text-slate-800 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'
                      : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
                  }`}
                >
                  <span>{n.emoji}</span>
                  <span>{n.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      <main className="flex-1 overflow-y-auto px-4 pb-40 pt-4">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-6 w-6 animate-spin-slow rounded-full border-2 border-slate-200 border-t-violet-400 dark:border-slate-700" />
          </div>
        ) : (
          content()
        )}
      </main>

      {view !== 'stats' && <AddBar onAdd={addItem} adding={adding} />}

      {detail && (
        <DetailSheet key={detail.id} item={detail} onUpdate={updateItem} onDelete={deleteTask} onClose={() => setDetail(null)} />
      )}
      <Toast toast={toast} onUndo={() => setToast(null)} onDismiss={() => setToast(null)} />
    </div>
  )
}
