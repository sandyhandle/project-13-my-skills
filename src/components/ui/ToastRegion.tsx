import { useEffect, useState } from 'react'
import type { ToastKind } from './toast'

interface ToastMessage {
  id: number
  message: string
  kind: ToastKind
}

export function ToastRegion() {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  useEffect(() => {
    const timers: number[] = []
    const handleToast = (event: Event) => {
      const detail = (event as CustomEvent<{ message: string; kind: ToastKind }>).detail
      if (!detail?.message) return
      const toast = { ...detail, id: Date.now() + Math.random() }
      setToasts((current) => [...current.slice(-2), toast])
      timers.push(window.setTimeout(() => {
        setToasts((current) => current.filter((item) => item.id !== toast.id))
      }, 4000))
    }
    window.addEventListener('app-toast', handleToast)
    return () => {
      window.removeEventListener('app-toast', handleToast)
      timers.forEach((timer) => window.clearTimeout(timer))
    }
  }, [])

  return (
    <div className="toast-region" aria-live="polite" aria-relevant="additions text" aria-atomic="false">
      {toasts.map((toast) => (
        <div key={toast.id} role={toast.kind === 'error' ? 'alert' : 'status'} className={`toast toast-${toast.kind}`}>
          {toast.message}
        </div>
      ))}
    </div>
  )
}
