import { format, parseISO } from 'date-fns'
import type { AppData, SkillEvent } from '../types'
import { getSkillTimeline } from '../../store/selectors'
import { getTemplateById } from '../templates'

export interface ExportOptions {
  fromDate: string
  toDate: string
  skillIds: string[]
  includeAiFeedback: boolean
  includeLevelChanges: boolean
  includeDecayNotes: boolean
  includeAdjustments: boolean
}

function sessionLevelAt(data: AppData, event: Extract<SkillEvent, { type: 'practice_session' }>, through: boolean): number | null {
  const events = data.events.filter((candidate) => {
    if (candidate.skillId !== event.skillId) return false
    if (candidate.date < event.date) return true
    if (candidate.date > event.date) return false
    if (candidate.type !== 'practice_session') return true
    return through
      ? candidate.createdAt <= event.createdAt
      : candidate.createdAt < event.createdAt
  })
  const skill = data.skills.find((item) => item.id === event.skillId)
  if (!skill) return null
  const timeline = getSkillTimeline({ ...data, events }, skill.id, event.date)
  return timeline.find((point) => point.date === event.date)?.level ?? null
}

function formatSession(data: AppData, event: Extract<SkillEvent, { type: 'practice_session' }>, options: ExportOptions): string {
  const skill = data.skills.find((item) => item.id === event.skillId)
  const performanceType = getTemplateById(skill?.templateId ?? 'generic')
    ?.performanceTypes.find((item) => item.id === event.performance.typeId)?.label
  const lines = [
    `### ${skill?.emoji ?? ''} ${skill?.name ?? 'Unknown skill'} — ${event.minutes} min${event.performance.performed ? ` · Performed: ${performanceType ?? 'Yes'}` : ''}`,
    `**What I did:** ${event.notes}`,
  ]
  const ai = event.ai
  const points = event.pointsOverride ?? ai?.points
  if (points !== undefined) {
    lines.push(`**Session points:** ${points}/100${ai ? ` (difficulty ${ai.difficulty} · novelty ${ai.novelty} · focus ${ai.focus})` : ''}`)
  }
  if (options.includeAiFeedback && ai) {
    lines.push(`**AI feedback:** ${ai.summary} Next: ${ai.nextSessionSuggestion}`)
  }
  if (options.includeLevelChanges) {
    const levelAfter = sessionLevelAt(data, event, true)
    const levelBefore = sessionLevelAt(data, event, false)
    if (levelAfter !== null && levelBefore !== null) {
      lines.push(`**Skill level:** ${(levelBefore * 100).toFixed(1)}% → ${(levelAfter * 100).toFixed(1)}% · ${((levelAfter - levelBefore) * 100 >= 0 ? '+' : '')}${((levelAfter - levelBefore) * 100).toFixed(1)} pp`)
    }
  }
  return `${lines.join('\n')}\n---`
}

export function generateNotionMarkdown(data: AppData, options: ExportOptions): string {
  const selectedSkills = new Set(options.skillIds)
  const events = data.events
    .filter((event) => selectedSkills.has(event.skillId) && event.date >= options.fromDate && event.date <= options.toDate)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
  const sections = new Map<string, string[]>()

  for (const event of events) {
    const skill = data.skills.find((item) => item.id === event.skillId)
    if (!skill) continue
    const dateLines = sections.get(event.date) ?? []
    if (event.type === 'practice_session') {
      dateLines.push(formatSession(data, event, options))
    } else if (options.includeAdjustments && event.type === 'manual_adjustment') {
      dateLines.push(`**Adjusted ${skill.name}:** ${((event.newLevel) * 100).toFixed(1)}% — ${event.reason}`)
    } else if (options.includeAdjustments && event.type === 'status_changed') {
      dateLines.push(`**Status changed:** ${skill.name} → ${event.status}${event.reason ? ` — ${event.reason}` : ''}`)
    } else if (options.includeAdjustments && event.type === 'season_started') {
      dateLines.push(`**Season started:** ${skill.name} — ${event.plan.goal}`)
    } else if (options.includeAdjustments && event.type === 'season_ended') {
      dateLines.push(`**Season ended:** ${skill.name} — ${event.outcome} · next status: ${event.nextStatus}`)
    }
    if (dateLines.length) sections.set(event.date, dateLines)
  }

  if (options.includeDecayNotes) {
    for (const skill of data.skills.filter((item) => selectedSkills.has(item.id))) {
      const timeline = getSkillTimeline(data, skill.id, options.toDate)
      timeline.filter((point) => point.decaying && point.date >= options.fromDate && point.date <= options.toDate)
        .forEach((point) => {
          const previous = timeline.find((item) => item.date < point.date)
          if (!previous?.decaying) {
            const dateLines = sections.get(point.date) ?? []
            dateLines.push(`**Decay began:** ${skill.name} started losing retained level after inactivity.`)
            sections.set(point.date, dateLines)
          }
        })
    }
  }

  return Array.from(sections.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, lines]) => `## ${format(parseISO(date), 'yyyy-MM-dd (EEE)')}\n${lines.join('\n\n')}`)
    .join('\n\n')
}
