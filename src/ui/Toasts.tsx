import { useCallback, useRef, useState } from 'react'

export type ToastKind = 'ok' | 'error' | 'info'
interface Toast { id: number; msg: string; kind: ToastKind; leaving: boolean }

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([])
  const seq = useRef(0)
  const push = useCallback((msg: string, kind: ToastKind = 'ok') => {
    const id = ++seq.current
    setToasts((t) => [...t.slice(-3), { id, msg, kind, leaving: false }])
    const life = kind === 'error' ? 5200 : 2800
    window.setTimeout(() => setToasts((t) => t.map((x) => (x.id === id ? { ...x, leaving: true } : x))), life)
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), life + 220)
  }, [])
  return { toasts, push }
}

export function Toasts({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="toast-container" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast${t.kind === 'error' ? ' toast-error' : t.kind === 'info' ? ' toast-info' : ''}${t.leaving ? ' leaving' : ''}`}>
          {t.msg}
        </div>
      ))}
    </div>
  )
}
