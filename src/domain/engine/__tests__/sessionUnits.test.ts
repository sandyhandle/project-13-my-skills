import { describe, expect, it } from 'vitest'
import { sessionUnits } from '../growth'
import { defaultSkillConfig } from '../../defaults'

describe('sessionUnits', () => {
  it('applies performance factors and audience bonuses only where supported', () => {
    const standard = sessionUnits({ minutes: 30, points: 50, config: defaultSkillConfig })
    const recorded = sessionUnits({
      minutes: 30,
      points: 50,
      performed: true,
      performanceFactor: 1.3,
      usesAudience: false,
      audienceSize: 200,
      config: defaultSkillConfig,
    })
    const liveAudience = sessionUnits({
      minutes: 30,
      points: 50,
      performed: true,
      performanceFactor: 1.8,
      usesAudience: true,
      audienceSize: 200,
      config: defaultSkillConfig,
    })
    expect(recorded).toBeGreaterThan(standard)
    expect(liveAudience).toBeGreaterThan(recorded)
  })
})
