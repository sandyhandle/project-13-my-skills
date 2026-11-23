import { format, parseISO } from 'date-fns'
import { motion, useReducedMotion } from 'framer-motion'
import type { CSSProperties } from 'react'
import { Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { AppData, Skill } from '../../domain/types'
import { getSkillTimeline } from '../../store/selectors'

interface SkillCardGridProps {
  data: AppData
  skills: Skill[]
  periodStart: string
  onLog: (skillId: string) => void
}

export function SkillCardGrid({ data, skills, periodStart, onLog }: SkillCardGridProps) {
  const navigate = useNavigate()
  const reduceMotion = useReducedMotion()
  const today = format(new Date(), 'yyyy-MM-dd')

  return (
    <section className="skill-card-grid" aria-label="Skills">
      {skills.map((skill, index) => {
        const timeline = getSkillTimeline(data, skill.id, today)
        const current = timeline.at(-1)?.level ?? 0
        const old = timeline.find((point) => point.date === periodStart)?.level
          ?? timeline.find((point) => point.date >= periodStart)?.level
          ?? current
        const change = (current - old) * 100
        const currentPoint = timeline.at(-1)
        const practiceEvents = data.events
          .filter((event) => event.skillId === skill.id && event.type === 'practice_session')
          .sort((a, b) => b.date.localeCompare(a.date))
        const lastPractice = practiceEvents[0]?.date
        const status = currentPoint?.status ?? 'active'
        const percent = current * 100

        const sparkValues = timeline.slice(-12)
        const sparkMax = Math.max(...sparkValues.map((point) => point.level), 0.01)
        const sparkMin = Math.min(...sparkValues.map((point) => point.level), sparkMax)
        const points = sparkValues.map((point, pointIndex) => {
          const x = sparkValues.length === 1 ? 0 : (pointIndex / (sparkValues.length - 1)) * 100
          const y = 30 - ((point.level - sparkMin) / (sparkMax - sparkMin || 1)) * 28
          return `${x},${y}`
        }).join(' ')

        return (
          <motion.article
            key={skill.id}
            className="skill-card card"
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduceMotion ? { duration: 0 } : { delay: index * 0.04 }}
          >
            <button className="skill-card-main" type="button" onClick={() => navigate(`/skills/${skill.id}`)}>
              <div className="skill-card-heading">
                <span className="skill-emoji">{skill.emoji ?? '◇'}</span>
                <div><strong>{skill.name}</strong>{skill.category && <span className="category-badge">{skill.category}</span>}</div>
              </div>
              <div className="skill-card-value">
                <span className="progress-ring" style={{ '--ring': `${percent * 3.6}deg` } as CSSProperties}>
                  <strong>{percent.toFixed(1)}%</strong>
                </span>
                <span className={change > 0.05 ? 'change-up' : change < -0.05 ? 'change-down' : 'change-flat'}>
                  {change > 0.05 ? '▲' : change < -0.05 ? '▼' : '•'} {Math.abs(change).toFixed(1)} pp
                </span>
              </div>
              <div className="skill-card-meta">
                <span className={`status-badge status-${status}`}>{status}</span>
                {currentPoint?.recovering && <span className="recovering-badge">Recovering</span>}
              </div>
              <svg className="sparkline" viewBox="0 0 100 32" aria-label={`${skill.name} recent skill level trend`} role="img">
                <polyline points={points} fill="none" stroke="var(--accent)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
              </svg>
              <p className="last-practice">
                {lastPractice ? `Last practiced ${format(parseISO(lastPractice), 'MMM d')}` : 'No practice sessions'}
              </p>
            </button>
            <button className="card-log-button" type="button" onClick={() => onLog(skill.id)}><Plus size={16} /> Log</button>
          </motion.article>
        )
      })}
    </section>
  )
}
