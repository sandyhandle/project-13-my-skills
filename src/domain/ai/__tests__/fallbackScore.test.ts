import { describe, expect, it } from 'vitest'
import { fallbackScore } from '../fallbackScore'

describe('fallbackScore', () => {
  it('uses detail, self-rating, and performance factors', () => {
    const session = {
      minutes: 30,
      notes: 'Practiced deliberately and reviewed a difficult technique',
      performance: { performed: false },
      selfRating: 4 as const,
    }
    const score = fallbackScore(session)
    expect(score).toBeGreaterThanOrEqual(40)
    expect(score).toBeLessThanOrEqual(100)
  })

  it('adds performance points and caps at 100', () => {
    const base = fallbackScore({
      minutes: 30,
      notes: 'Detailed practice with complete reflection and feedback',
      performance: { performed: false },
      selfRating: 5,
    })
    const performed = fallbackScore({
      minutes: 30,
      notes: 'Detailed practice with complete reflection and feedback',
      performance: { performed: true },
      selfRating: 5,
    })
    expect(performed).toBeGreaterThan(base)
    expect(performed).toBeLessThanOrEqual(100)
  })
})
