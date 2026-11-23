import { useEffect, useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import { showToast } from '../../components/ui/toast'
import { useDialogAccessibility } from '../../components/ui/useDialogAccessibility'
import type { AiScore, PracticeSessionEvent } from '../../domain/types'
import { scoreSession } from '../../domain/ai/scoreSession'
import { fallbackScore } from '../../domain/ai/fallbackScore'
import { getTemplateById } from '../../domain/templates'
import { getSkillTimeline } from '../../store/selectors'
import { useAppStore } from '../../store/useAppStore'
import { AiScorePanel } from './AiScorePanel'

interface LogSessionModalProps {
  open: boolean
  skillId?: string
  session?: PracticeSessionEvent
  onClose: () => void
}

function parseDuration(value: string): number | null {
  const plain = value.trim()
  if (/^\d+$/.test(plain)) return Number(plain)
  const hourMinute = plain.match(/^(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?$/i)
  if (!hourMinute) return null
  const hours = Number(hourMinute[1] ?? 0)
  const minutes = Number(hourMinute[2] ?? 0)
  return hours * 60 + minutes || null
}

export function LogSessionModal({ open, skillId, session, onClose }: LogSessionModalProps) {
  const skills = useAppStore((state) => state.skills)
  const logSession = useAppStore((state) => state.logSession)
  const updateSession = useAppStore((state) => state.updateSession)
  const deleteEvent = useAppStore((state) => state.deleteEvent)
  const state = useAppStore()

  const [selectedSkillId, setSelectedSkillId] = useState(skillId ?? '')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [duration, setDuration] = useState('30')
  const [notes, setNotes] = useState('')
  const [templateFields, setTemplateFields] = useState<Record<string, string | number | boolean | string[]>>({})
  const [performed, setPerformed] = useState(false)
  const [performanceTypeId, setPerformanceTypeId] = useState('')
  const [audienceSize, setAudienceSize] = useState(0)
  const [performanceLink, setPerformanceLink] = useState('')
  const [performanceNotes, setPerformanceNotes] = useState('')
  const [selfRating, setSelfRating] = useState<1 | 2 | 3 | 4 | 5 | undefined>()
  const [error, setError] = useState('')
  const [score, setScore] = useState<number | null>(null)
  const [pointsOverride, setPointsOverride] = useState<number | undefined>()
  const [fallback, setFallback] = useState(false)
  const [aiScore, setAiScore] = useState<AiScore | null>(null)
  const [scoreError, setScoreError] = useState('')
  const [isScoring, setIsScoring] = useState(false)
  const [activeSessionId, setActiveSessionId] = useState<string | undefined>()
  const dialogRef = useDialogAccessibility(open, onClose, score === null ? 'form' : 'result')

  useEffect(() => {
    if (!open) return
    if (session) {
      setSelectedSkillId(session.skillId)
      setDate(session.date)
      setDuration(String(session.minutes))
      setNotes(session.notes)
      setTemplateFields(session.templateFields)
      setPerformed(session.performance.performed)
      setPerformanceTypeId(session.performance.typeId ?? '')
      setAudienceSize(session.performance.audienceSize ?? 0)
      setPerformanceLink(session.performance.link ?? '')
      setPerformanceNotes(session.performance.notes ?? '')
      setSelfRating(session.selfRating)
      setPointsOverride(session.pointsOverride)
      setScore(null)
      setAiScore(session.ai ?? null)
      setFallback(!session.ai)
      setActiveSessionId(session.id)
    } else {
      setSelectedSkillId(skillId ?? skills[0]?.id ?? '')
      setDate(new Date().toISOString().slice(0, 10))
      setDuration('30')
      setNotes('')
      setTemplateFields({})
      setPerformed(false)
      setPerformanceTypeId('')
      setAudienceSize(0)
      setPerformanceLink('')
      setPerformanceNotes('')
      setSelfRating(undefined)
      setScore(null)
      setPointsOverride(undefined)
      setFallback(false)
      setAiScore(null)
      setScoreError('')
      setActiveSessionId(undefined)
      setError('')
    }
  }, [open, session, skillId, skills])

  if (!open) return null

  const selectedSkill = skills.find((skill) => skill.id === selectedSkillId)
  const template = getTemplateById(selectedSkill?.templateId ?? 'generic')

  const save = async (scoreMode: 'without' | 'fallback' | 'ai') => {
    const minutes = parseDuration(duration)
    if (!selectedSkillId) {
      setError('Select a skill.')
      return
    }
    if (minutes === null || minutes <= 0) {
      setError('Enter a valid duration.')
      return
    }
    if (date > new Date().toISOString().slice(0, 10)) {
      setError('Future sessions are not allowed.')
      return
    }
    if (!notes.trim()) {
      setError('Describe what you practiced.')
      return
    }

    const draft: Omit<PracticeSessionEvent, 'id' | 'createdAt'> = {
      skillId: selectedSkillId,
      date,
      type: 'practice_session',
      minutes,
      notes: notes.trim(),
      performance: {
        performed,
        typeId: performed ? performanceTypeId || undefined : undefined,
        audienceSize: performed ? audienceSize : undefined,
        link: performed ? performanceLink || undefined : undefined,
        notes: performed ? performanceNotes || undefined : undefined,
      },
      templateFields,
      selfRating,
      ai: undefined,
      pointsOverride,
    }

    if (scoreMode === 'without') {
      if (session) updateSession(session.id, draft)
      else logSession(draft)
      showToast(session ? 'Practice session updated.' : 'Practice session saved.')
      onClose()
      return
    }

    setError('')
    setScoreError('')
    setIsScoring(scoreMode === 'ai')
    let result: Awaited<ReturnType<typeof scoreSession>> | undefined
    try {
      if (scoreMode === 'ai') {
        const timeline = getSkillTimeline(state, selectedSkillId, date)
        const currentLevel = timeline.at(-1)?.level ?? 0
        const nextMilestone = selectedSkill?.milestones
          .slice()
          .sort((a, b) => a.percent - b.percent)
          .find((item) => item.percent > currentLevel * 100)
        const recentSessions = state.events
          .filter((item): item is PracticeSessionEvent => item.skillId === selectedSkillId && item.type === 'practice_session')
          .sort((a, b) => a.date.localeCompare(b.date))
          .slice(-10)
        result = await scoreSession({
          apiKey: state.settings.aiEnabled ? state.settings.anthropicApiKey : undefined,
          model: state.settings.aiModel,
          skill: selectedSkill!,
          template: template!,
          currentLevel,
          nextMilestone,
          recentSessions,
          session: draft,
        })
      } else {
        result = {
          score: {
            points: fallbackScore(draft),
            difficulty: 50,
            novelty: 50,
            focus: (draft.selfRating ?? 3) * 20,
            performanceImpact: draft.performance.performed ? 50 : null,
            summary: 'Estimated using the session notes, self-rating, and performance input.',
            strengths: [],
            improvements: [],
            nextSessionSuggestion: 'Choose one specific challenge to focus on next time.',
            milestoneEvidence: null,
            model: 'fallback',
            scoredAt: new Date().toISOString(),
          },
          usedFallback: true,
        }
      }

      const savedDraft = { ...draft, ai: scoreMode === 'ai' ? result.score : undefined }
      let savedId = session?.id
      if (session) updateSession(session.id, savedDraft)
      else savedId = logSession(savedDraft).id
      setActiveSessionId(savedId)
      setAiScore(result.score)
      setFallback(result.usedFallback)
      setScoreError(result.error ?? '')
      setScore(pointsOverride ?? result.score.points)
      showToast(session ? 'Practice session updated.' : 'Practice session saved.')
      setPointsOverride(undefined)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not score this session.')
    } finally {
      setIsScoring(false)
    }
  }

  const submit = (event: FormEvent) => event.preventDefault()

  const rerunAi = async () => {
    if (!selectedSkill || !template || !activeSessionId) return
    const saved = state.events.find((event) => event.id === activeSessionId)
    if (!saved || saved.type !== 'practice_session') return
    setIsScoring(true)
    setScoreError('')
    try {
      const timeline = getSkillTimeline(state, selectedSkill.id, date)
      const nextMilestone = selectedSkill.milestones.slice().sort((a, b) => a.percent - b.percent)
        .find((item) => item.percent > (timeline.at(-1)?.level ?? 0) * 100)
      const recentSessions = state.events
        .filter((item): item is PracticeSessionEvent => item.skillId === selectedSkill.id && item.type === 'practice_session' && item.id !== saved.id)
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-10)
      const result = await scoreSession({
        apiKey: state.settings.aiEnabled ? state.settings.anthropicApiKey : undefined,
        model: state.settings.aiModel,
        skill: selectedSkill,
        template,
        currentLevel: timeline.at(-1)?.level ?? 0,
        nextMilestone,
        recentSessions,
        session: saved,
      })
      updateSession(saved.id, { ai: result.score })
      setAiScore(result.score)
      setFallback(result.usedFallback)
      setScoreError(result.error ?? '')
      setScore(pointsOverride ?? result.score.points)
    } catch (caught) {
      setScoreError(caught instanceof Error ? caught.message : 'Could not score this session.')
    } finally {
      setIsScoring(false)
    }
  }

  const growthPp = (() => {
    if (score === null || !selectedSkill || !activeSessionId) return undefined
    const appData = {
      schemaVersion: state.schemaVersion,
      settings: state.settings,
      skills: state.skills,
      events: state.events,
    }
    const fullTimeline = getSkillTimeline(appData, selectedSkill.id, date)
    const baselineTimeline = getSkillTimeline({
      ...appData,
      events: state.events.filter((event) => event.id !== activeSessionId),
    }, selectedSkill.id, date)
    const fullLevel = fullTimeline.find((point) => point.date === date)?.level
    const baselineLevel = baselineTimeline.find((point) => point.date === date)?.level
    if (fullLevel === undefined || baselineLevel === undefined) return undefined
    return Math.max(0, (fullLevel - baselineLevel) * 100)
  })()

  if (score !== null) {
    return (
      <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
        <section ref={dialogRef} tabIndex={-1} className="modal-panel score-modal" role="dialog" aria-modal="true" aria-label="Session result">
          <header className="modal-header"><div><span className="eyebrow">Session saved</span><h2>Practice score</h2></div><button type="button" className="icon-button" aria-label="Close" onClick={onClose}><X size={18} /></button></header>
          <AiScorePanel
            points={pointsOverride ?? score}
            fallback={fallback}
            difficulty={aiScore?.difficulty}
            novelty={aiScore?.novelty}
            focus={aiScore?.focus}
            performanceImpact={aiScore?.performanceImpact}
            summary={aiScore?.summary}
            strengths={aiScore?.strengths}
            improvements={aiScore?.improvements}
            nextSuggestion={aiScore?.nextSessionSuggestion}
            milestoneEvidence={aiScore?.milestoneEvidence}
            growthPp={growthPp}
            error={scoreError}
            isScoring={isScoring}
            onRerun={() => void rerunAi()}
            onOverride={(points) => {
              setPointsOverride(points)
              setScore(points)
              if (activeSessionId) updateSession(activeSessionId, { pointsOverride: points })
            }}
            onClose={onClose}
          />
        </section>
      </div>
    )
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section ref={dialogRef} tabIndex={-1} className="modal-panel session-modal" role="dialog" aria-modal="true" aria-label={session ? 'Edit practice session' : 'Log practice session'}>
        <header className="modal-header">
          <div><span className="eyebrow">{session ? 'Edit session' : 'Practice input'}</span><h2>{session ? 'Update session' : 'Log session'}</h2></div>
          <button type="button" className="icon-button" aria-label="Close" onClick={onClose}><X size={18} /></button>
        </header>
        <form onSubmit={submit}>
          <div className="form-grid">
            <label>Skill
              <select value={selectedSkillId} onChange={(event) => setSelectedSkillId(event.target.value)}>
                <option value="">Select a skill</option>
                {skills.filter((skill) => !skill.archived).map((skill) => <option key={skill.id} value={skill.id}>{skill.emoji} {skill.name}</option>)}
              </select>
            </label>
            <label>Date<input type="date" max={new Date().toISOString().slice(0, 10)} value={date} onChange={(event) => setDate(event.target.value)} /></label>
            <label>Duration
              <input value={duration} onChange={(event) => setDuration(event.target.value)} placeholder="30 or 1h 20m" />
              <div className="duration-buttons">{[15, 30, 45, 60, 90].map((minutes) => <button key={minutes} type="button" className={duration === String(minutes) ? 'active' : ''} onClick={() => setDuration(String(minutes))}>{minutes}</button>)}</div>
            </label>
          </div>

          <label className="notes-field">What did you do?
            <textarea rows={5} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={template?.notePlaceholder} />
          </label>

          {template?.fields.map((field) => (
            <label className="template-field" key={field.id}>
              {field.label}
              {field.type === 'select' ? (
                <select value={String(templateFields[field.id] ?? '')} onChange={(event) => setTemplateFields({ ...templateFields, [field.id]: event.target.value })}>
                  <option value="">Select</option>{field.options?.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              ) : field.type === 'boolean' ? (
                <input type="checkbox" checked={Boolean(templateFields[field.id])} onChange={(event) => setTemplateFields({ ...templateFields, [field.id]: event.target.checked })} />
              ) : field.type === 'multiselect' ? (
                <input value={Array.isArray(templateFields[field.id]) ? (templateFields[field.id] as string[]).join(', ') : ''} placeholder="Separate values with commas" onChange={(event) => setTemplateFields({ ...templateFields, [field.id]: event.target.value.split(',').map((value) => value.trim()).filter(Boolean) })} />
              ) : field.type === 'rating' ? (
                <input type="number" min={1} max={5} value={Number(templateFields[field.id] ?? 0)} onChange={(event) => setTemplateFields({ ...templateFields, [field.id]: Number(event.target.value) })} />
              ) : (
                <input type={field.type === 'number' ? 'number' : 'text'} value={String(templateFields[field.id] ?? '')} placeholder={field.placeholder} onChange={(event) => setTemplateFields({ ...templateFields, [field.id]: field.type === 'number' ? Number(event.target.value) : event.target.value })} />
              )}
            </label>
          ))}

          <label className="checkbox-label"><input type="checkbox" checked={performed} onChange={(event) => setPerformed(event.target.checked)} /> Did I perform or share this?</label>
          {performed && (
            <div className="performance-grid">
              {template?.performanceTypes.length ? (
                <label>Performance type<select value={performanceTypeId} onChange={(event) => setPerformanceTypeId(event.target.value)}><option value="">Select</option>{template.performanceTypes.map((type) => <option key={type.id} value={type.id}>{type.label}</option>)}</select></label>
              ) : null}
              <label>Audience size<input type="number" min={0} value={audienceSize} onChange={(event) => setAudienceSize(Math.max(0, Number(event.target.value)))} /></label>
              <label>Recording link<input type="url" value={performanceLink} onChange={(event) => setPerformanceLink(event.target.value)} /></label>
              <label>How did it go?<input value={performanceNotes} onChange={(event) => setPerformanceNotes(event.target.value)} /></label>
            </div>
          )}

          <fieldset className="rating-field">
            <legend>How focused was I?</legend>
            <div>{([1, 2, 3, 4, 5] as const).map((rating) => <button key={rating} type="button" aria-label={`${rating} out of 5`} aria-pressed={selfRating === rating} className={selfRating === rating ? 'active' : ''} onClick={() => setSelfRating(rating)}>{rating}</button>)}</div>
          </fieldset>

          {error && <p role="alert" className="form-error">{error}</p>}
          {session && <button type="button" className="danger-button" onClick={() => { deleteEvent(session.id); showToast('Practice session deleted.'); onClose() }}>Delete session</button>}
          <footer className="modal-footer">
            <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
            <button type="button" className="secondary-button" disabled={isScoring} onClick={() => void save('without')}>Save without scoring</button>
            <button type="button" className="secondary-button" disabled={isScoring} onClick={() => void save('fallback')}>Save (fallback score)</button>
            <button type="button" className="primary-button" disabled={isScoring} onClick={() => void save('ai')}>{isScoring ? 'Scoring…' : 'Save & score with AI'}</button>
          </footer>
        </form>
      </section>
    </div>
  )
}
