import { format, parseISO, subDays } from 'date-fns'
import type { AppData, Skill } from '../../domain/types'
import { getSkillTimeline } from '../../store/selectors'

interface SummaryStripProps {
  data: AppData
  skills: Skill[]
}

export function SummaryStrip({ data, skills }: SummaryStripProps) {
  const today = format(new Date(), 'yyyy-MM-dd')
  const monthStart = format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd')
  const threshold = data.settings.changeThresholdPp
  let improving = 0
  let declining = 0
  let stable = 0

  skills.forEach((skill) => {
    const timeline = getSkillTimeline(data, skill.id, today)
    const nowPoint = timeline.at(-1)
    const oldPoint = timeline.find((point) => point.date === subDays(parseISO(today), 30).toISOString().slice(0, 10))
      ?? timeline.at(-30)
    const change = ((nowPoint?.level ?? 0) - (oldPoint?.level ?? 0)) * 100
    if (change > threshold) improving += 1
    else if (change < -threshold) declining += 1
    else stable += 1
  })

  const practiceEvents = data.events.filter((event) =>
    event.type === 'practice_session' && event.date >= monthStart && event.date <= today,
  )
  const sessions = practiceEvents.filter((event) => event.type === 'practice_session')
  const minutes = sessions.reduce((total, event) => total + event.minutes, 0)

  const items = [
    ['Total Skills', String(skills.length)],
    ['Improving', String(improving)],
    ['Declining', String(declining)],
    ['Stable', String(stable)],
    ['Sessions This Month', String(sessions.length)],
    ['Practice Time', `${Math.floor(minutes / 60)}h ${minutes % 60}m`],
  ]

  return (
    <section className="summary-strip" aria-label="Skill summary">
      {items.map(([label, value]) => (
        <div key={label}><strong>{value}</strong><span>{label}</span></div>
      ))}
    </section>
  )
}
