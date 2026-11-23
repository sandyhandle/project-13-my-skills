import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns'
import type { SeasonPlan, SkillEvent } from '../types'

export interface PlanProgress {
  weeksElapsed: number
  plannedSessions: number
  actualSessions: number
  adherence: number
  paceRecent: number
  projectedLevelAtTarget: number | null
  verdict: 'ahead' | 'on_track' | 'behind'
}

export function analyzePlan(
  skillId: string,
  plan: SeasonPlan,
  startDate: string,
  events: SkillEvent[],
  startLevel: number,
  today = format(new Date(), 'yyyy-MM-dd'),
): PlanProgress {
  const elapsedDays = Math.max(0, differenceInCalendarDays(parseISO(today), parseISO(startDate)))
  const weeksElapsed = elapsedDays / 7
  const practice = events.filter((event) => event.skillId === skillId && event.type === 'practice_session' && event.date >= startDate && event.date <= today)
  const actualSessions = practice.length
  const plannedSessions = plan.sessionsPerWeek * weeksElapsed
  const adherence = plannedSessions > 0 ? actualSessions / plannedSessions : 0

  const fourWeeksAgo = format(addDays(parseISO(today), -28), 'yyyy-MM-dd')
  const recent = practice.filter((event) => event.date >= fourWeeksAgo)
  const recentPoints = recent
    .filter((event): event is Extract<SkillEvent, { type: 'practice_session' }> => event.type === 'practice_session')
    .map((event) => event.pointsOverride ?? event.ai?.points)
  const averagePoints = recentPoints.filter((value): value is number => value !== undefined)
  const fallbackPoints = averagePoints.length ? averagePoints.reduce((sum, value) => sum + value, 0) / averagePoints.length : 50
  const paceRecent = Math.max(0, (recent.length / 4) * ((fallbackPoints - 50) / 100) * 0.02 * 100)

  let projectedLevelAtTarget: number | null = null
  if (plan.targetDate) {
    const targetDays = Math.max(0, differenceInCalendarDays(parseISO(plan.targetDate), parseISO(today)))
    const plannedPerDay = plan.sessionsPerWeek / 7
    let level = startLevel
    for (let day = 0; day < targetDays; day += 1) {
      if ((day % Math.ceil(1 / plannedPerDay)) === 0) {
        const quality = 0.25 + 1.5 * (fallbackPoints / 100)
        const units = Math.min(3, quality)
        level = Math.min(1, level + 0.002 * units * (1 - level))
      }
    }
    projectedLevelAtTarget = level
  }

  let verdict: PlanProgress['verdict'] = 'on_track'
  if (plan.targetLevel !== undefined && projectedLevelAtTarget !== null) {
    if (projectedLevelAtTarget > plan.targetLevel + 0.02) verdict = 'ahead'
    else if (projectedLevelAtTarget < plan.targetLevel - 0.02) verdict = 'behind'
  } else if (adherence >= 1.1) verdict = 'ahead'
  else if (adherence < 0.8) verdict = 'behind'

  return {
    weeksElapsed,
    plannedSessions,
    actualSessions,
    adherence,
    paceRecent,
    projectedLevelAtTarget,
    verdict,
  }
}
