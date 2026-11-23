import type { AppData, PracticeSessionEvent } from '../types'
import type { ExportOptions } from './notionMarkdown'
import { getSkillTimeline } from '../../store/selectors'
import { getTemplateById } from '../templates'

const columns = ['Date', 'Skill', 'Category', 'Minutes', 'Performed', 'Performance Type', 'Audience', 'Notes', 'Points', 'Level Before', 'Level After', 'Change (pp)']

function csvCell(value: string | number | boolean | null | undefined): string {
  const text = value === null || value === undefined ? '' : String(value)
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

function sessionLevels(data: AppData, event: PracticeSessionEvent): { before: number | null; after: number | null } {
  const skill = data.skills.find((item) => item.id === event.skillId)
  if (!skill) return { before: null, after: null }
  const relevant = data.events.filter((candidate) =>
    candidate.skillId === event.skillId &&
    (candidate.date < event.date || (candidate.date === event.date && (
      candidate.type !== 'practice_session' || candidate.createdAt <= event.createdAt
    ))),
  )
  const after = getSkillTimeline({ ...data, events: relevant }, skill.id, event.date).find((point) => point.date === event.date)?.level ?? null
  const priorEvents = relevant.filter((candidate) => candidate.id !== event.id)
  const before = getSkillTimeline({ ...data, events: priorEvents }, skill.id, event.date).find((point) => point.date === event.date)?.level ?? null
  return { before, after }
}

export function generateNotionCsv(data: AppData, options: ExportOptions): string {
  const selected = new Set(options.skillIds)
  const sessions = data.events.filter((event): event is PracticeSessionEvent =>
    event.type === 'practice_session' &&
    selected.has(event.skillId) &&
    event.date >= options.fromDate &&
    event.date <= options.toDate,
  ).sort((a, b) => a.date.localeCompare(b.date))

  const rows = sessions.map((event) => {
    const skill = data.skills.find((item) => item.id === event.skillId)
    const typeLabel = getTemplateById(skill?.templateId ?? 'generic')
      ?.performanceTypes.find((item) => item.id === event.performance.typeId)?.label
    const levels = sessionLevels(data, event)
    const points = event.pointsOverride ?? event.ai?.points
    const change = levels.before !== null && levels.after !== null ? (levels.after - levels.before) * 100 : null
    return [
      event.date,
      skill?.name ?? '',
      skill?.category ?? '',
      event.minutes,
      event.performance.performed,
      typeLabel ?? '',
      event.performance.audienceSize,
      event.notes,
      points,
      levels.before === null ? '' : (levels.before * 100).toFixed(1),
      levels.after === null ? '' : (levels.after * 100).toFixed(1),
      change === null ? '' : change.toFixed(1),
    ].map(csvCell).join(',')
  })
  return [columns.map(csvCell).join(','), ...rows].join('\r\n')
}
