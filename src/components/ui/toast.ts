export type ToastKind = 'success' | 'error'

export function showToast(message: string, kind: ToastKind = 'success') {
  window.dispatchEvent(new CustomEvent('app-toast', { detail: { message, kind } }))
}
