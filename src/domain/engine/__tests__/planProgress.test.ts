import { describe, expect, it } from 'vitest'
import { analyzePlan } from '../planProgress'
import type { SkillEvent } from '../../types'

describe('analyzePlan', () => {
  it('calculates elapsed weeks, adherence, and an ahead verdict', () => {
    const events: SkillEvent[] = [
      {
        id: 'session-1', skillId: 'skill-1', date: '2026-11-16', createdAt: '2026-11-16T12:00:00Z',
        type: 'practice_session', minutes: 30, notes: 'Practice',
        performance: { performed: false }, templateFields: {}, selfRating: 4,
      },
      {
        id: 'session-2', skillId: 'skill-1', date: '2026-11-17', createdAt: '2026-11-17T12:00:00Z',
        type: 'practice_session', minutes: 30, notes: 'Practice',
        performance: { performed: false }, templateFields: {}, selfRating: 4,
      },
    ]
    const result = analyzePlan(
      'skill-1',
      { goal: 'Interview', sessionsPerWeek: 2, targetDate: '2027-01-01', targetLevel: 0.5 },
      '2026-11-09',
      events,
      0.2,
      '2026-11-23',
    )
    expect(result.weeksElapsed).toBe(2)
    expect(result.actualSessions).toBe(2)
    expect(result.plannedSessions).toBe(4)
    expect(result.adherence).toBe(0.5)
    expect(['ahead', 'on_track', 'behind']).toContain(result.verdict)
  })

  it('marks high adherence ahead when no target level is set', () => {
    const events: SkillEvent[] = Array.from({ length: 10 }, (_, index) => ({
      id: `session-${index}`,
      skillId: 'skill-1',
      date: `2026-11-${String(10 + index).padStart(2, '0')}`,
      createdAt: `2026-11-${String(10 + index).padStart(2, '0')}T12:00:00Z`,
      type: 'practice_session',
      minutes: 30,
      notes: 'Practice',
      performance: { performed: false },
      templateFields: {},
      pointsOverride: 60,
    })) as SkillEvent[]
    const result = analyzePlan(
      'skill-1',
      { goal: 'Practice', sessionsPerWeek: 3 },
      '2026-11-09',
      events,
      0.3,
      '2026-11-23',
    )
    expect(result.adherence).toBeGreaterThan(1)
    expect(result.verdict).toBe('ahead')
  })
})
