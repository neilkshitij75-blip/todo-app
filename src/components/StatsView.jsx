import { getWeekChart } from '../lib/streak'

const CATEGORIES = ['Health', 'Errands', 'Work', 'Study', 'Personal']

function Card({ children }) {
  return <div className="rounded-2xl border border-slate-200/70 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">{children}</div>
}

export default function StatsView({ tasks, stats, isDark, onToggleDark, onExportJSON, onExportICS, onImportJSON }) {
  const week = getWeekChart()
  const weekTotal = week.reduce((a, d) => a + d.count, 0)
  const max = Math.max(1, ...week.map((d) => d.count))

  const openByCat = CATEGORIES.map((c) => ({
    cat: c,
    count: tasks.filter((t) => t.type === 'task' && t.category === c && !t.completed).length,
  }))
  const totalOpen = tasks.filter((t) => !t.completed && t.type !== 'note').length
  const notes = tasks.filter((t) => t.type === 'note').length

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-3">
      {/* headline numbers */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Day streak', value: stats.streak, emoji: '🔥' },
          { label: 'Done today', value: stats.done, emoji: '✅' },
          { label: 'Done this week', value: weekTotal, emoji: '📈' },
        ].map((s) => (
          <Card key={s.label}>
            <div className="text-2xl">{s.emoji}</div>
            <div className="mt-1 text-2xl font-semibold text-slate-800 dark:text-slate-100">{s.value}</div>
            <div className="text-xs text-slate-400 dark:text-slate-500">{s.label}</div>
          </Card>
        ))}
      </div>

      {/* week chart */}
      <Card>
        <div className="mb-3 text-sm font-medium text-slate-600 dark:text-slate-300">Last 7 days</div>
        <div className="flex items-end justify-between gap-2" style={{ height: 96 }}>
          {week.map((d, i) => (
            <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1">
              <div
                className="w-full rounded-md bg-violet-500 transition-all"
                style={{ height: `${(d.count / max) * 72}px`, minHeight: d.count ? 4 : 2, opacity: d.count ? 1 : 0.25 }}
                title={`${d.count} done`}
              />
              <span className="text-[10px] text-slate-400">{d.label}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* open by category */}
      <Card>
        <div className="mb-2 text-sm font-medium text-slate-600 dark:text-slate-300">
          Open tasks by category <span className="text-slate-400">· {totalOpen} total</span>
        </div>
        <div className="flex flex-col gap-2">
          {openByCat.map(({ cat, count }) => (
            <div key={cat} className="flex items-center gap-2">
              <span className="w-16 text-xs text-slate-500 dark:text-slate-400">{cat}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                <div className="h-full rounded-full bg-violet-400" style={{ width: `${(count / Math.max(1, totalOpen)) * 100}%` }} />
              </div>
              <span className="w-5 text-right text-xs text-slate-500 dark:text-slate-400">{count}</span>
            </div>
          ))}
          <div className="pt-1 text-xs text-slate-400 dark:text-slate-500">💡 {notes} saved idea{notes === 1 ? '' : 's'}</div>
        </div>
      </Card>

      {/* data + settings */}
      <Card>
        <div className="mb-3 text-sm font-medium text-slate-600 dark:text-slate-300">Data &amp; settings</div>
        <div className="flex flex-wrap gap-2">
          <button onClick={onToggleDark} className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200">
            {isDark ? '☀️ Light mode' : '🌙 Dark mode'}
          </button>
          <button onClick={onExportICS} className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200">
            📆 Export calendar (.ics)
          </button>
          <button onClick={onExportJSON} className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200">
            ⬇️ Backup (JSON)
          </button>
          <label className="cursor-pointer rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200">
            ⬆️ Import
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => { if (e.target.files?.[0]) onImportJSON(e.target.files[0]); e.target.value = '' }}
            />
          </label>
        </div>
      </Card>
    </div>
  )
}
