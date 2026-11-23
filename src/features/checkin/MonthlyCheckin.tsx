import { useMemo, useState } from 'react'
import { differenceInCalendarDays, format, parseISO, subDays } from 'date-fns'
import { monthlyReview } from '../../domain/ai/monthlyReview'
import type { PracticeSessionEvent, Skill } from '../../domain/types'
import { useAppStore } from '../../store/useAppStore'
import { getSkillTimeline } from '../../store/selectors'

export function MonthlyCheckin() {
  const state = useAppStore()
  const [busySkillId, setBusySkillId] = useState('')
  const [message, setMessage] = useState('')
  const today = format(new Date(), 'yyyy-MM-dd')
  const showBanner = !state.settings.lastCheckinAt
    || differenceInCalendarDays(new Date(), parseISO(state.settings.lastCheckinAt.slice(0, 10))) > 30

  const skills = useMemo(
    () => state.skills.filter((skill) => !skill.archived).filter((skill) => {
      const current = getSkillTimeline(state, skill.id, today).at(-1)
      return current?.status === 'active' || current?.status === 'maintenance'
    }),
    [state, today],
  )

  if (!showBanner || !skills.length) return null

  const markCheckedIn = () => {
    state.updateSettings({ lastCheckinAt: new Date().toISOString() })
    setMessage('Check-in saved.')
  }

  const calibrate = async (skill: Skill) => {
    if (!state.settings.anthropicApiKey) {
      setMessage('Add an Anthropic API key in Settings to request calibration suggestions.')
      return
    }
    setBusySkillId(skill.id)
    setMessage('')
    try {
      const timeline = getSkillTimeline(state, skill.id, today)
      const currentLevel = timeline.at(-1)?.level ?? 0
      const recentFrom = format(subDays(new Date(`${today}T12:00:00`), 30), 'yyyy-MM-dd')
      const sessions = state.events.filter((event): event is PracticeSessionEvent =>
        event.skillId === skill.id && event.type === 'practice_session' && event.date >= recentFrom,
      )
      const result = await monthlyReview({
        apiKey: state.settings.anthropicApiKey,
        model: state.settings.aiModel,
        skill,
        currentLevel,
        milestones: skill.milestones,
        sessions,
      })
      const target = Math.round(result.suggestedLevel * 1000) / 10
      const current = Math.round(currentLevel * 1000) / 10
      const reason = `Monthly AI calibration (${Math.round(result.confidence * 100)}% confidence): ${result.reasoning}`
      if (window.confirm(`AI suggests ${target}% (currently ${current}%). Apply this as a manual adjustment?\n\n${result.reasoning}`)) {
        state.adjustLevel(skill.id, today, result.suggestedLevel, reason, false)
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Monthly review failed.')
    } finally {
      setBusySkillId('')
    }
  }

  return (
    <aside className="monthly-checkin card">
      <div className="section-heading">
        <div><span className="eyebrow">Monthly reflection</span><h2>Does your current level still feel right?</h2></div>
        <button type="button" className="secondary-button" onClick={markCheckedIn}>Feels right</button>
      </div>
      <p className="muted">Review current levels against your recent practice. Suggestions never change a level unless you confirm.</p>
      <div className="checkin-skills">
        {skills.map((skill) => {
          const current = getSkillTimeline(state, skill.id, today).at(-1)?.level ?? 0
          const sessions = state.events.filter((event): event is PracticeSessionEvent =>
            event.skillId === skill.id && event.type === 'practice_session' && event.date >= format(subDays(new Date(`${today}T12:00:00`), 30),
              'yyyy-MM-dd',
            ),
          ).sort((a, b) => b.date.localeCompare(a.date))
          const milestone = skill.milestones.slice().sort((a, b) => a.percent - b.percent)
            .reverse().find((item) => item.percent <= current * 100)
          return (
            <div className="checkin-skill" key={skill.id}>
              <div>
                <strong>{skill.emoji} {skill.name} · {(current * 100).toFixed(1)}%</strong>
                <span>{milestone ? `Current milestone: ${milestone.description}` : 'No milestone reached yet'} · {sessions.length} sessions in 30 days</span>
                {sessions.map((session) => <small key={session.id}>{session.date} · {session.minutes} min · {session.notes}</small>)}
              </div>
              <button type="button" className="text-button" disabled={busySkillId !== ''} onClick={() => void calibrate(skill)}>
                {busySkillId === skill.id ? 'Reviewing…' : 'Adjust to AI suggestion'}
              </button>
            </div>
          )
        })}
      </div>
      {message && <p role="status" className="muted">{message}</p>}
    </aside>
  )
}
