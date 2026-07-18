import { useEffect } from 'react'

// A single bottom toast with an Undo action. Auto-dismisses after `duration`.
export default function Toast({ toast, onUndo, onDismiss, duration = 4000 }) {
  useEffect(() => {
    if (!toast) return
    const id = setTimeout(onDismiss, duration)
    return () => clearTimeout(id)
  }, [toast, duration, onDismiss])

  if (!toast) return null

  return (
    <div className="fixed inset-x-0 bottom-24 z-50 flex justify-center px-4 pointer-events-none">
      <div className="animate-toast-in pointer-events-auto flex items-center gap-3 rounded-xl bg-slate-900 dark:bg-slate-700 px-4 py-3 text-sm text-white shadow-lg">
        <span>{toast.message}</span>
        {toast.onUndo && (
          <button
            onClick={() => {
              toast.onUndo()
              onUndo()
            }}
            className="font-semibold text-violet-300 hover:text-violet-200 cursor-pointer"
          >
            Undo
          </button>
        )}
      </div>
    </div>
  )
}
