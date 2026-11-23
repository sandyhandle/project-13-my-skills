import { addDays, format, parseISO, startOfWeek } from 'date-fns'
import type { AppData, PracticeSessionEvent } from '../types'
import type { ExportOptions } from './notionMarkdown'
import { getSkillTimeline } from '../../store/selectors'

interface WeekSummary {
  skillId: string
  weekStart: string
  sessions: number
  minutes: number
}

export function generateWeeklySummary(data: AppData, options: ExportOptions): string {
  const selected = new Set(options.skillIds)
  const groups = new Map<string, WeekSummary>()
  const events = data.events.filter((event): event is PracticeSessionEvent =>
    event.type === 'practice_session' &&
    selected.has(event.skillId) &&
    event.date >= options.fromDate &&
    event.date <= options.toDate,
  )

  events.forEach((event) => {
    const weekStart = format(startOfWeek(parseISO(event.date), { weekStartsOn: 1 }), 'yyyy-MM-dd')
    const key = `${event.skillId}:${weekStart}`
    const group = groups.get(key) ?? { skillId: event.skillId, weekStart, sessions: 0, minutes: 0 }
    group.sessions += 1
    group.minutes += event.minutes
    groups.set(key, group)
  })

  const lines = Array.from(groups.values())
    .sort((a, b) => b.weekStart.localeCompare(a.weekStart) || a.skillId.localeCompare(b.skillId))
    .map((group) => {
      const skill = data.skills.find((item) => item.id === group.skillId)
      const timeline = getSkillTimeline(data, group.skillId, options.toDate)
      const weekEnd = format(addDays(parseISO(group.weekStart), 6), 'yyyy-MM-dd')
      const start = timeline.find((point) => point.date >= group.weekStart)?.level
      const end = timeline.find((point) => point.date >= weekEnd)?.level ?? timeline.at(-1)?.level
      const levels = start === undefined || end === undefined
        ? ''
        : ` · ${(start * 100).toFixed(1)}% → ${(end * 100).toFixed(1)}%`
      return `- **${skill?.name ?? 'Unknown skill'}** · ${group.weekStart}: ${group.sessions} sessions, ${group.minutes} min${levels}`
    })

  return `# Weekly practice summary\n\n${lines.join('\n')}`
}
