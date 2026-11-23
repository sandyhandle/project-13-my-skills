import type { SkillConfig } from '../types'

export function sessionUnits(options: {
  minutes: number
  points: number
  performed?: boolean
  performanceFactor?: number
  usesAudience?: boolean
  audienceSize?: number
  config: SkillConfig
}): number {
  const durationFactor = Math.min(options.minutes / options.config.referenceMinutes, 2)
  const qualityFactor = 0.25 + 1.5 * (Math.max(0, Math.min(100, options.points)) / 100)
  let audienceBonus = 0
  if (options.performed && options.usesAudience) {
    const audience = options.audienceSize ?? 0
    if (audience >= 200) audienceBonus = 0.8
    else if (audience >= 50) audienceBonus = 0.5
    else if (audience >= 10) audienceBonus = 0.2
  }
  const performanceFactor = options.performed
    ? (options.performanceFactor ?? 1) + audienceBonus
    : 1
  return Math.min(3, durationFactor * qualityFactor * performanceFactor)
}

export function previewMonthlyGrowth(
  startingLevel: number,
  baseGrowth: number,
  sessionsPerWeek = 7,
  config?: Partial<SkillConfig>,
): number {
  const effective: SkillConfig = {
    baseGrowth,
    graceDays: 7,
    halfLifeDays: 180,
    recoveryBoost: 2,
    referenceMinutes: 30,
    maxUnitsPerDay: 3,
    maintenanceDecayMultiplier: 0.5,
    dormantDecayMultiplier: 0.3,
    retentionFloorRatio: 0,
    ...config,
  }

  let level = startingLevel
  for (let day = 0; day < 30; day += 1) {
    const practiceOnDay = sessionsPerWeek >= 7 || day % Math.ceil(7 / sessionsPerWeek) === 0
    if (!practiceOnDay) continue
    const units = sessionUnits({ minutes: 30, points: 50, config: effective })
    level = Math.min(1, level + effective.baseGrowth * units * (1 - level))
  }
  return level
}

export function calibrateBaseGrowth(
  startingLevel: number,
  targetGainPp: number,
  sessionsPerWeek: number,
): number {
  let low = 0
  let high = 0.02
  for (let iteration = 0; iteration < 40; iteration += 1) {
    const mid = (low + high) / 2
    const gain = (previewMonthlyGrowth(startingLevel, mid, sessionsPerWeek) - startingLevel) * 100
    if (gain < targetGainPp) low = mid
    else high = mid
  }
  return (low + high) / 2
}
