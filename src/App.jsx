import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'
import { categorizeTask } from './categorize'
import './index.css'

const TABS = [
  { id: 'Health',    emoji: '🏥', label: 'Health' },
  { id: 'Errands',   emoji: '🛒', label: 'Errands' },
  { id: 'Work',      emoji: '💼', label: 'Work' },
  { id: 'Study',     emoji: '🎓', label: 'Study' },
  { id: 'Personal',  emoji: '🏠', label: 'Personal' },
  { id: 'Scheduled', emoji: '📅', label: 'Scheduled' },
]

function TaskCard({ task, onToggle, onDelete }) {
  return (
    <div
      className={`flex items-start gap-3 p-4 bg-white rounded-xl shadow-sm border transition-all duration-300 ${
        task.completed ? 'opacity-50 border-gray-100' : 'border-gray-100 hover:shadow-md'
      }`}
    >
      <button
        onClick={() => onToggle(task)}
        className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all duration-200 cursor-pointer ${
          task.completed
            ? 'bg-emerald-500 border-emerald-500'
            : 'border-gray-300 hover:border-emerald-400'
        }`}
      >
        {task.completed && (
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>

      <div className="flex-1 min-w-0">
        <p className={`text-sm leading-relaxed ${task.completed ? 'line-through text-gray-400' : 'text-gray-700'}`}>
          {task.text}
        </p>
        {task.scheduled_day && (
          <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 bg-blue-50 text-blue-600 text-xs rounded-full font-medium">
            📅 {task.scheduled_day}
          </span>
        )}
      </div>

      <button
        onClick={() => onDelete(task.id)}
        className="flex-shrink-0 w-6 h-6 flex items-center justify-center text-gray-300 hover:text-red-400 hover:bg-red-50 rounded-full transition-all duration-150 text-lg leading-none cursor-pointer"
        aria-label="Delete task"
      >
        ×
      </button>
    </div>
  )
}

export default function App() {
  const [tasks, setTasks] = useState([])
  const [activeTab, setActiveTab] = useState('Health')
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState(null)
  const inputRef = useRef(null)

  useEffect(() => {
    fetchTasks()
  }, [])

  async function fetchTasks() {
    setLoading(true)
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      setError('Failed to load tasks. Check your Supabase credentials in .env.local')
      console.error(error)
    } else {
      setTasks(data || [])
    }
    setLoading(false)
  }

  async function addTask(e) {
    e.preventDefault()
    const text = input.trim()
    if (!text || adding) return

    setAdding(true)
    setError(null)
    const { category, scheduledDay } = categorizeTask(text)

    const newTask = {
      text,
      category,
      scheduled_day: scheduledDay,
      completed: false,
    }

    const { data, error } = await supabase
      .from('tasks')
      .insert([newTask])
      .select()
      .single()

    if (error) {
      console.error(error)
      setError('Failed to add task. Check your Supabase credentials.')
    } else {
      setTasks(prev => [data, ...prev])
      setInput('')
      setActiveTab(scheduledDay ? 'Scheduled' : category)
    }
    setAdding(false)
    inputRef.current?.focus()
  }

  async function toggleTask(task) {
    const updated = { completed: !task.completed }
    const { error } = await supabase
      .from('tasks')
      .update(updated)
      .eq('id', task.id)

    if (!error) {
      setTasks(prev =>
        prev.map(t => (t.id === task.id ? { ...t, ...updated } : t))
      )
    }
  }

  async function deleteTask(id) {
    const { error } = await supabase.from('tasks').delete().eq('id', id)
    if (!error) {
      setTasks(prev => prev.filter(t => t.id !== id))
    }
  }

  async function clearCompleted(tab) {
    const toDelete = tabTasks(tab)
      .filter(t => t.completed)
      .map(t => t.id)

    if (!toDelete.length) return

    const { error } = await supabase
      .from('tasks')
      .delete()
      .in('id', toDelete)

    if (!error) {
      setTasks(prev => prev.filter(t => !toDelete.includes(t.id)))
    }
  }

  function tabTasks(tabId) {
    if (tabId === 'Scheduled') {
      return tasks.filter(t => t.scheduled_day)
    }
    return tasks.filter(t => t.category === tabId)
  }

  function activeCount(tabId) {
    return tabTasks(tabId).filter(t => !t.completed).length
  }

  const currentTasks = tabTasks(activeTab)
  const completedCount = currentTasks.filter(t => t.completed).length

  return (
    <div style={{ minHeight: '100svh', background: 'linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{ padding: '32px 16px 16px', textAlign: 'center' }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, color: '#1e293b', letterSpacing: '-0.5px' }}>
          My Tasks
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#94a3b8' }}>
          Type naturally — I'll sort it out
        </p>
      </header>

      {/* Error banner */}
      {error && (
        <div style={{
          margin: '0 16px 8px',
          padding: '12px 16px',
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: 12,
          color: '#dc2626',
          fontSize: 13,
          textAlign: 'center',
        }}>
          {error}
        </div>
      )}

      {/* Tab bar */}
      <div style={{ padding: '0 16px', overflowX: 'auto' }}>
        <div style={{
          display: 'flex',
          gap: 4,
          maxWidth: 640,
          margin: '0 auto',
          paddingBottom: 4,
          width: 'max-content',
          minWidth: '100%',
          justifyContent: 'center',
        }}>
          {TABS.map(tab => {
            const count = activeCount(tab.id)
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 12px',
                  borderRadius: 12,
                  fontSize: 12,
                  fontWeight: 500,
                  border: isActive ? '1px solid #e2e8f0' : '1px solid transparent',
                  background: isActive ? '#ffffff' : 'transparent',
                  color: isActive ? '#1e293b' : '#64748b',
                  boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                }}
              >
                <span>{tab.emoji}</span>
                <span>{tab.label}</span>
                {count > 0 && (
                  <span style={{
                    padding: '1px 6px',
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 600,
                    background: isActive ? '#dbeafe' : '#f1f5f9',
                    color: isActive ? '#2563eb' : '#64748b',
                  }}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Task list */}
      <main style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 110px' }}>
        <div style={{ maxWidth: 560, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '64px 0', color: '#94a3b8' }}>
              <div style={{
                width: 24, height: 24,
                border: '2px solid #e2e8f0',
                borderTopColor: '#60a5fa',
                borderRadius: '50%',
                animation: 'spin 0.7s linear infinite',
              }} />
            </div>
          ) : currentTasks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '64px 0', color: '#94a3b8' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>{TABS.find(t => t.id === activeTab)?.emoji}</div>
              <p style={{ fontSize: 14, margin: '0 0 4px' }}>No tasks here yet.</p>
              <p style={{ fontSize: 12, margin: 0 }}>Add one using the bar below.</p>
            </div>
          ) : (
            <>
              {currentTasks.map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onToggle={toggleTask}
                  onDelete={deleteTask}
                />
              ))}
              {completedCount > 0 && (
                <div style={{ textAlign: 'center', paddingTop: 8 }}>
                  <button
                    onClick={() => clearCompleted(activeTab)}
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: 12,
                      color: '#94a3b8',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                      textUnderlineOffset: 2,
                    }}
                    onMouseEnter={e => e.target.style.color = '#f87171'}
                    onMouseLeave={e => e.target.style.color = '#94a3b8'}
                  >
                    Clear {completedCount} completed
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Input bar */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 16,
        background: 'rgba(255,255,255,0.85)',
        backdropFilter: 'blur(12px)',
        borderTop: '1px solid #f1f5f9',
        boxShadow: '0 -4px 20px rgba(0,0,0,0.06)',
      }}>
        <form
          onSubmit={addTask}
          style={{ maxWidth: 560, margin: '0 auto', display: 'flex', gap: 8 }}
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="e.g. book a GP appointment on Monday…"
            disabled={adding}
            style={{
              flex: 1,
              padding: '12px 16px',
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: 12,
              fontSize: 14,
              color: '#374151',
              outline: 'none',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              transition: 'border-color 0.15s',
            }}
            onFocus={e => e.target.style.borderColor = '#93c5fd'}
            onBlur={e => e.target.style.borderColor = '#e2e8f0'}
          />
          <button
            type="submit"
            disabled={!input.trim() || adding}
            style={{
              padding: '12px 20px',
              background: '#3b82f6',
              color: '#ffffff',
              border: 'none',
              borderRadius: 12,
              fontSize: 14,
              fontWeight: 500,
              cursor: input.trim() && !adding ? 'pointer' : 'not-allowed',
              opacity: !input.trim() || adding ? 0.4 : 1,
              boxShadow: '0 1px 3px rgba(59,130,246,0.3)',
              transition: 'all 0.15s',
              minWidth: 60,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {adding ? (
              <div style={{
                width: 16, height: 16,
                border: '2px solid rgba(255,255,255,0.4)',
                borderTopColor: '#ffffff',
                borderRadius: '50%',
                animation: 'spin 0.7s linear infinite',
              }} />
            ) : 'Add'}
          </button>
        </form>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .task-card {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 16px;
          background: white;
          border-radius: 12px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.06);
          border: 1px solid #f1f5f9;
          transition: all 0.2s;
        }
        .task-card:hover {
          box-shadow: 0 4px 12px rgba(0,0,0,0.08);
        }
      `}</style>
    </div>
  )
}
