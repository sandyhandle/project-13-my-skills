import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns'
import type { AppData, DailyPoint, Skill, SkillEvent } from '../domain/types'
import { sessionUnits } from '../domain/engine/growth'
import { getTemplateById } from '../domain/templates'

const timelineCache = new Map<string, DailyPoint[]>()

function pointsForSession(event: Extract<SkillEvent, { type: 'practice_session' }>): number {
  if (event.pointsOverride !== undefined) return event.pointsOverride
  if (event.ai) return event.ai.points
  const detail = Math.min(event.notes.length / 20, 15)
  const rating = event.selfRating ? (event.selfRating - 3) * 8 : 0
  return Math.max(0, Math.min(100, 40 + detail + rating + (event.performance.performed ? 15 : 0)))
}

export function simulateSkill(skill: Skill, events: SkillEvent[], untilDate: string): DailyPoint[] {
  const signature = `${skill.id}:${untilDate}:${JSON.stringify(events)}`
  const cached = timelineCache.get(signature)
  if (cached) return cached

  const skillEvents = events
    .filter((event) => event.skillId === skill.id)
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))

  const created = skillEvents.find((event) => event.type === 'skill_created')
  if (!created || created.type !== 'skill_created') return []

  let level = created.initialLevel
  let peak = created.initialLevel
  let config = created.config
  let status = created.status
  let lastPracticeDate = created.date

  const points: DailyPoint[] = []
  let cursor = parseISO(created.date)
  const end = parseISO(untilDate < created.date ? created.date : untilDate)

  while (cursor <= end) {
    const date = format(cursor, 'yyyy-MM-dd')
    const dayEvents = skillEvents.filter((event) => event.date === date)
    let sessionCount = 0
    let minutes = 0
    let unitsUsedToday = 0
    const startLevel = level

    for (const event of dayEvents) {
      if (event.type === 'skill_created') {
        level = event.initialLevel
        peak = event.initialLevel
        config = event.config
        status = event.status
        lastPracticeDate = date
      } else if (event.type === 'config_changed') {
        config = event.config
      } else if (event.type === 'status_changed' || event.type === 'season_ended') {
        status = event.type === 'status_changed' ? event.status : event.nextStatus
      } else if (event.type === 'manual_adjustment') {
        level = event.newLevel
        peak = event.lowerPeakToo && event.newLevel < peak ? event.newLevel : Math.max(peak, level)
      }
    }

    for (const event of dayEvents) {
      if (event.type !== 'practice_session') continue
      const remaining = Math.max(0, config.maxUnitsPerDay - unitsUsedToday)
      if (remaining <= 0) continue

      const pointsValue = pointsForSession(event)
      const performanceType = getTemplateById(skill.templateId)?.performanceTypes.find(
        (type) => type.id === event.performance.typeId,
      )
      const units = Math.min(remaining, sessionUnits({
        minutes: event.minutes,
        points: pointsValue,
        performed: event.performance.performed,
        performanceFactor: performanceType?.factor,
        usesAudience: performanceType?.usesAudience,
        audienceSize: event.performance.audienceSize,
        config,
      }))
      unitsUsedToday += units

      const recoveryMultiplier = level < peak
        ? 1 + config.recoveryBoost * ((peak - level) / peak)
        : 1
      level = Math.max(0, Math.min(1, level + config.baseGrowth * units * (1 - level) * recoveryMultiplier))
      peak = Math.max(peak, level)
      lastPracticeDate = date
      sessionCount += 1
      minutes += event.minutes
    }

    let inactiveDays = differenceInCalendarDays(cursor, parseISO(lastPracticeDate))
    let decaying = false
    if (sessionCount === 0) {
      inactiveDays = Math.max(0, inactiveDays)
      if (inactiveDays > config.graceDays) {
        const k = Math.log(2) / config.halfLifeDays
        const statusMultiplier =
          status === 'maintenance'
            ? config.maintenanceDecayMultiplier
            : status === 'dormant'
              ? config.dormantDecayMultiplier
              : 1
        level = level * Math.exp(-k * statusMultiplier)
        if (config.retentionFloorRatio > 0) {
          level = Math.max(level, peak * config.retentionFloorRatio)
        }
        decaying = true
      }
    } else {
      inactiveDays = 0
    }
    level = Math.max(0, Math.min(1, level))

    points.push({
      date,
      level,
      peak,
      status,
      inactiveDays,
      decaying,
      recovering: level < peak,
      sessionCount,
      minutes,
      delta: level - startLevel,
    })
    cursor = addDays(cursor, 1)
  }

  timelineCache.set(signature, points)
  if (timelineCache.size > 500) {
    const oldest = timelineCache.keys().next().value
    if (oldest) timelineCache.delete(oldest)
  }
  return points
}

export function clearTimelineCache(): void {
  timelineCache.clear()
}

export function getSkillTimeline(data: AppData, skillId: string, untilDate: string): DailyPoint[] {
  const skill = data.skills.find((item) => item.id === skillId)
  if (!skill) return []
  const events = data.events.filter((event) => event.skillId === skillId)
  return simulateSkill(skill, events, untilDate)
}

export function snapshot(data: AppData, date: string): Record<string, number | null> {
  return Object.fromEntries(
    data.skills
      .filter((skill) => !skill.archived)
      .map((skill) => {
        const timeline = getSkillTimeline(data, skill.id, date)
        const point = timeline.find((item) => item.date === date)
        return [skill.id, point?.level ?? null]
      }),
  )
}
