import type { PracticeSessionEvent } from '../types'

export function fallbackScore(session: Pick<PracticeSessionEvent, 'minutes' | 'notes' | 'performance' | 'selfRating'>): number {
  const detail = Math.min(session.notes.length / 20, 15)
  const rating = session.selfRating ? (session.selfRating - 3) * 8 : 0
  return Math.max(0, Math.min(100, 40 + detail + rating + (session.performance.performed ? 15 : 0)))
}
