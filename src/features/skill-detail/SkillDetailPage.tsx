import { useMemo, useState } from 'react'
import { format, subDays } from 'date-fns'
import { useReducedMotion } from 'framer-motion'
import { Area, AreaChart, CartesianGrid, Line, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Archive, Edit3, Plus, Trash2 } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { showToast } from '../../components/ui/toast'
import { useDialogAccessibility } from '../../components/ui/useDialogAccessibility'
import type { AppData, PracticeSessionEvent, SkillConfig } from '../../domain/types'
import { analyzePlan } from '../../domain/engine/planProgress'
import { getSkillTimeline } from '../../store/selectors'
import { useAppStore } from '../../store/useAppStore'
import { SkillFormModal } from '../skill-form/SkillFormModal'

type RangeKey = '1M' | '3M' | '6M' | '1Y' | 'All'

export function SkillDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const state = useAppStore()
  const reduceMotion = useReducedMotion()
  const [editOpen, setEditOpen] = useState(false)
  const [range, setRange] = useState<RangeKey>('3M')
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [adjustLevel, setAdjustLevel] = useState(50)
  const [adjustReason, setAdjustReason] = useState('')
  const [lowerPeak, setLowerPeak] = useState(false)
  const [endOpen, setEndOpen] = useState(false)
  const [endOutcome, setEndOutcome] = useState('')
  const [endStatus, setEndStatus] = useState<'maintenance' | 'dormant'>('dormant')
  const [revisitDate, setRevisitDate] = useState('')
  const adjustDialogRef = useDialogAccessibility(adjustOpen, () => setAdjustOpen(false))
  const endDialogRef = useDialogAccessibility(endOpen, () => setEndOpen(false))

  const skill = state.skills.find((item) => item.id === id)
  const today = format(new Date(), 'yyyy-MM-dd')
  const data = useMemo<AppData>(() => ({
    schemaVersion: state.schemaVersion,
    settings: state.settings,
    skills: state.skills,
    events: state.events,
  }), [state.schemaVersion, state.settings, state.skills, state.events])
  const timeline = useMemo(() => skill ? getSkillTimeline(data, skill.id, today) : [], [data, skill, today])
  const currentPoint = timeline.at(-1)
  const currentLevel = currentPoint?.level ?? 0
  const peak = currentPoint?.peak ?? 0

  const rangeStart = useMemo(() => {
    if (range === 'All' || !timeline.length) return timeline[0]?.date ?? today
    const offset = range === '1M' ? 30 : range === '3M' ? 90 : range === '6M' ? 180 : 365
    return format(subDays(new Date(`${today}T12:00:00`), offset), 'yyyy-MM-dd')
  }, [range, timeline, today])
  const chartData = timeline.filter((point) => point.date >= rangeStart).map((point) => ({
    ...point,
    levelPct: point.level * 100,
    peakPct: point.peak * 100,
  }))

  const skillEvents = state.events.filter((event) => event.skillId === id)
  const sessions = skillEvents
    .filter((event): event is PracticeSessionEvent => event.type === 'practice_session')
    .sort((a, b) => b.date.localeCompare(a.date))
  const adjustments = skillEvents.filter((event) => event.type === 'manual_adjustment')
  const monthSessions = sessions.filter((event) => event.date >= format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd'))
  const monthMinutes = monthSessions.reduce((sum, event) => sum + event.minutes, 0)
  const averagePoints = monthSessions
    .map((event) => event.pointsOverride ?? event.ai?.points)
    .filter((value): value is number => value !== undefined)
  const averageSessionPoints = averagePoints.length ? averagePoints.reduce((sum, value) => sum + value, 0) / averagePoints.length : null
  const performanceCount = monthSessions.filter((event) => event.performance.performed).length

  const previousMonth = (() => {
    const date = format(subDays(new Date(`${today}T12:00:00`), 30), 'yyyy-MM-dd')
    return timeline.find((point) => point.date === date)?.level
      ?? timeline.find((point) => point.date >= date)?.level
      ?? currentLevel
  })()
  const change = (currentLevel - previousMonth) * 100
  const created = skillEvents.find((event) => event.type === 'skill_created')
  const config = created?.type === 'skill_created' ? created.config : undefined
  const sortedMilestones = [...(skill?.milestones ?? [])].sort((a, b) => a.percent - b.percent)
  const currentMilestone = [...sortedMilestones].reverse().find((milestone) => milestone.percent <= currentLevel * 100)
  const nextMilestone = sortedMilestones.find((milestone) => milestone.percent > currentLevel * 100)
  const milestoneProgress = nextMilestone
    ? ((currentLevel * 100 - (currentMilestone?.percent ?? 0)) / (nextMilestone.percent - (currentMilestone?.percent ?? 0))) * 100
    : 100

  const activeSeasonStart = [...skillEvents].reverse().find((event) => event.type === 'season_started')
  const endedAfterStart = [...skillEvents].reverse().find((event) => event.type === 'season_ended')
  const activeSeason = activeSeasonStart?.type === 'season_started' && (!endedAfterStart || endedAfterStart.date < activeSeasonStart.date)
    ? activeSeasonStart
    : undefined
  const planProgress = activeSeason?.type === 'season_started'
    ? analyzePlan(skill?.id ?? '', activeSeason.plan, activeSeason.date, skillEvents, currentLevel)
    : null

  if (state.isLoading) return <main className="page"><section className="empty-card"><p>Loading skill…</p></section></main>
  if (!skill) return <main className="page"><section className="empty-card"><h1>Skill not found</h1><button type="button" onClick={() => navigate('/')}>Back to dashboard</button></section></main>

  const saveAdjustment = () => {
    if (!adjustReason.trim()) return
    state.adjustLevel(skill.id, today, adjustLevel / 100, adjustReason.trim(), lowerPeak)
    setAdjustOpen(false)
    setAdjustReason('')
    showToast('Skill level adjusted.')
  }

  const saveConfig = (configPatch: Partial<SkillConfig>) => {
    if (!config) return
    state.changeConfig(skill.id, today, { ...config, ...configPatch })
  }

  const endSeason = () => {
    state.endSeason(skill.id, today, endOutcome.trim(), endStatus, revisitDate || undefined)
    setEndOpen(false)
    showToast('Season ended.')
  }

  return (
    <main className="skill-detail-page">
      <header className="detail-header card">
        <div className="detail-title">
          <span className="detail-emoji">{skill.emoji ?? '◇'}</span>
          <div><span className="eyebrow">{skill.category ?? 'Skill'}</span><h1>{skill.name}</h1><span className={`status-badge status-${currentPoint?.status ?? 'active'}`}>{currentPoint?.status ?? 'active'}</span></div>
        </div>
        <div className="detail-actions">
          <button type="button" className="secondary-button" onClick={() => setEditOpen(true)}><Edit3 size={16} /> Edit</button>
          <button type="button" className="secondary-button" onClick={() => { state.archiveSkill(skill.id, !skill.archived); showToast(skill.archived ? 'Skill restored.' : 'Skill archived.') }}><Archive size={16} /> {skill.archived ? 'Restore' : 'Archive'}</button>
          <button type="button" className="danger-button" onClick={() => { if (window.confirm('Delete this skill and all of its history?')) { state.deleteSkill(skill.id); showToast('Skill and history deleted.'); navigate('/') } }}><Trash2 size={16} /> Delete</button>
        </div>
      </header>

      <section className="detail-stats">
        <div className="card"><span>Current</span><strong>{(currentLevel * 100).toFixed(1)}%</strong></div>
        <div className="card"><span>Previous month</span><strong>{(previousMonth * 100).toFixed(1)}%</strong></div>
        <div className="card"><span>Change</span><strong className={change >= 0 ? 'change-up' : 'change-down'}>{change >= 0 ? '+' : ''}{change.toFixed(1)} pp</strong></div>
        <div className="card"><span>Peak</span><strong>{(peak * 100).toFixed(1)}%</strong></div>
      </section>

      <section className="detail-grid">
        <div className="detail-main">
          <section className="card history-panel">
            <div className="section-heading"><div><span className="eyebrow">History</span><h2>Capability over time</h2></div><div className="range-buttons">{(['1M', '3M', '6M', '1Y', 'All'] as RangeKey[]).map((item) => <button key={item} type="button" className={range === item ? 'active' : ''} onClick={() => setRange(item)}>{item}</button>)}</div></div>
            <div className="history-chart">
              <ResponsiveContainer width="100%" height={340}>
                <AreaChart data={chartData}>
                  <defs><linearGradient id="levelFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.28}/><stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/></linearGradient></defs>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickFormatter={(value) => format(new Date(`${value}T12:00:00`), 'MMM d')} stroke="var(--muted)" />
                  <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} stroke="var(--muted)" />
                  <Tooltip formatter={(value, name) => [`${Number(value).toFixed(1)}%`, name]} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12 }} />
                  <Area type="monotone" dataKey="levelPct" name="Skill level" stroke="#8b5cf6" fill="url(#levelFill)" strokeWidth={2} isAnimationActive={!reduceMotion} />
                  <Line type="monotone" dataKey="peakPct" name="Peak" stroke="var(--warning)" strokeDasharray="5 5" dot={false} isAnimationActive={!reduceMotion} />
                  {chartData.filter((point) => point.decaying).map((point) => <ReferenceLine key={point.date} x={point.date} stroke="var(--danger)" strokeOpacity={0.18} />)}
                  {sessions.filter((event) => event.date >= rangeStart).map((event) => {
                    const point = chartData.find((item) => item.date === event.date)
                    return point ? <ReferenceDot key={event.id} x={event.date} y={point.levelPct} r={event.performance.performed ? 5 : 3} fill={event.performance.performed ? 'var(--warning)' : '#8b5cf6'} stroke="var(--surface)" /> : null
                  })}
                  {adjustments.filter((event) => event.date >= rangeStart).map((event) => <ReferenceLine key={event.id} x={event.date} stroke="var(--text)" strokeDasharray="2 4" />)}
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <p className="chart-key"><span>● Practice</span><span>★ Performance</span><span>— Manual adjustment</span><span>Peak</span></p>
          </section>

          <section className="card session-list-panel">
            <div className="section-heading"><div><span className="eyebrow">Practice</span><h2>Sessions</h2></div><button type="button" className="primary-button" onClick={() => window.dispatchEvent(new CustomEvent('open-log-session', { detail: { skillId: skill.id } }))}><Plus size={16} /> Log session</button></div>
            {sessions.length === 0 ? <p className="muted">No practice sessions yet.</p> : sessions.map((session) => (
              <div className="session-row" key={session.id}>
                <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('open-edit-session', { detail: { session } }))}>
                  <div><strong>{format(new Date(`${session.date}T12:00:00`), 'MMM d, yyyy')}</strong><span>{session.minutes} min{session.performance.performed ? ' · Performed' : ''}</span></div>
                  <p>{session.notes}</p>
                </button>
                <strong>{session.pointsOverride ?? session.ai?.points ?? '—'}</strong>
              </div>
            ))}
          </section>

          <section className="card adjustments-panel">
            <div className="section-heading"><div><span className="eyebrow">Corrections</span><h2>Manual adjustments</h2></div><button type="button" className="secondary-button" onClick={() => setAdjustOpen(true)}>Set level</button></div>
            {adjustments.length === 0 ? <p className="muted">No manual adjustments.</p> : adjustments.map((event) => event.type === 'manual_adjustment' ? <div className="adjustment-row" key={event.id}><strong>{(event.newLevel * 100).toFixed(1)}%</strong><div><p>{event.reason}</p><span>{event.date}{event.lowerPeakToo ? ' · peak lowered' : ''}</span></div></div> : null)}
          </section>
        </div>

        <aside className="detail-sidebar">
          <section className="card milestone-panel">
            <span className="eyebrow">Milestones</span>
            {nextMilestone ? <><strong className="milestone-next">{nextMilestone.percent}%</strong><p>{currentMilestone?.description ?? 'Building capability'}</p><div className="milestone-progress"><span style={{ width: `${Math.max(0, Math.min(100, milestoneProgress))}%` }} /></div><p className="muted">Next: {nextMilestone.description}</p></> : <><strong className="milestone-next">Complete</strong><p>{currentMilestone?.description ?? 'No milestone set'}</p></>}
            {sortedMilestones.length > 0 && <details><summary>All milestones</summary>{sortedMilestones.map((milestone) => <div className="milestone-row-detail" key={milestone.id}><strong>{milestone.percent}%</strong><span>{milestone.description}</span></div>)}</details>}
          </section>

          <section className="card practice-stats">
            <span className="eyebrow">This month</span>
            <div><strong>{monthSessions.length}</strong><span>Sessions</span></div>
            <div><strong>{Math.floor(monthMinutes / 60)}h {monthMinutes % 60}m</strong><span>Practice time</span></div>
            <div><strong>{averageSessionPoints?.toFixed(1) ?? '—'}</strong><span>Average points</span></div>
            <div><strong>{performanceCount}</strong><span>Performances</span></div>
          </section>

          {planProgress && activeSeason?.type === 'season_started' && (
            <section className="card plan-panel">
              <span className="eyebrow">Active season</span><h3>{activeSeason.plan.goal}</h3>
              <div className="plan-grid"><div><strong>{planProgress.adherence.toFixed(2)}×</strong><span>Adherence</span></div><div><strong>{planProgress.paceRecent.toFixed(1)} pp/wk</strong><span>Pace</span></div></div>
              {planProgress.projectedLevelAtTarget !== null && <p>Projected: {(planProgress.projectedLevelAtTarget * 100).toFixed(1)}%</p>}
              <span className={`plan-verdict verdict-${planProgress.verdict}`}>{planProgress.verdict.replace('_', ' ')}</span>
              <button type="button" className="secondary-button" onClick={() => setEndOpen(true)}>End season</button>
            </section>
          )}

          {config && (
            <section className="card config-panel">
              <span className="eyebrow">Config</span>
              <label>Base growth<input type="number" step={0.0001} value={config.baseGrowth} onChange={(event) => saveConfig({ baseGrowth: Number(event.target.value) })} /></label>
              <label>Grace days<input type="number" value={config.graceDays} onChange={(event) => saveConfig({ graceDays: Number(event.target.value) })} /></label>
              <label>Half-life days<input type="number" value={config.halfLifeDays} onChange={(event) => saveConfig({ halfLifeDays: Number(event.target.value) })} /></label>
              <label>Recovery boost<input type="number" step={0.1} value={config.recoveryBoost} onChange={(event) => saveConfig({ recoveryBoost: Number(event.target.value) })} /></label>
            </section>
          )}
        </aside>
      </section>

      {adjustOpen && (
        <div className="modal-backdrop"><section ref={adjustDialogRef} tabIndex={-1} className="modal-panel compact-modal" role="dialog" aria-modal="true" aria-label="Manual adjust">
          <header className="modal-header"><h2>Set level</h2><button type="button" className="icon-button" aria-label="Close adjustment dialog" onClick={() => setAdjustOpen(false)}>×</button></header>
          <div className="compact-form"><label>Level (%)<input type="number" min={0} max={100} value={adjustLevel} onChange={(event) => setAdjustLevel(Number(event.target.value))} /></label><label>Reason<input value={adjustReason} onChange={(event) => setAdjustReason(event.target.value)} /></label><label className="checkbox-label"><input type="checkbox" checked={lowerPeak} onChange={(event) => setLowerPeak(event.target.checked)} /> Also lower my peak</label><button type="button" className="primary-button" onClick={saveAdjustment}>Save adjustment</button></div>
        </section></div>
      )}
      {endOpen && (
        <div className="modal-backdrop"><section ref={endDialogRef} tabIndex={-1} className="modal-panel compact-modal" role="dialog" aria-modal="true" aria-label="End season">
          <header className="modal-header"><h2>End season</h2><button type="button" className="icon-button" aria-label="Close end season dialog" onClick={() => setEndOpen(false)}>×</button></header>
          <div className="compact-form"><label>Outcome<textarea value={endOutcome} onChange={(event) => setEndOutcome(event.target.value)} /></label><label>Next status<select value={endStatus} onChange={(event) => setEndStatus(event.target.value as 'maintenance' | 'dormant')}><option value="dormant">Dormant</option><option value="maintenance">Maintenance</option></select></label><label>Revisit date<input type="date" value={revisitDate} onChange={(event) => setRevisitDate(event.target.value)} /></label><button type="button" className="primary-button" onClick={endSeason}>End season</button></div>
        </section></div>
      )}
      <SkillFormModal open={editOpen} skill={skill} onClose={() => setEditOpen(false)} />
    </main>
  )
}
