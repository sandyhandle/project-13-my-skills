import { differenceInCalendarDays, format, subDays } from 'date-fns'
import { useMemo, useState } from 'react'
import { getSkillTimeline } from '../../store/selectors'
import { useAppStore } from '../../store/useAppStore'
import { PeriodSelector, type PeriodKey } from './PeriodSelector'
import { RadarPanel, type SnapshotSeries } from './RadarPanel'
import { SkillCardGrid } from './SkillCardGrid'
import { SummaryStrip } from './SummaryStrip'
import { MonthlyCheckin } from '../checkin/MonthlyCheckin'
import { Link } from 'react-router-dom'

const periodOffsets: Record<PeriodKey, number[]> = {
  Current: [0],
  Day: [1, 0],
  Week: [7, 0],
  Month: [30, 15, 0],
  '3 Months': [90, 60, 30, 0],
  '6 Months': [180, 120, 60, 0],
  Year: [365, 270, 180, 90, 0],
}

function periodSeries(period: PeriodKey, today: string): SnapshotSeries[] {
  const now = new Date(`${today}T12:00:00`)
  return periodOffsets[period].map((offset) => {
    const date = format(offset === 0 ? now : subDays(now, offset), 'yyyy-MM-dd')
    const label = offset === 0 ? 'Now' : format(new Date(`${date}T12:00:00`), 'MMM d')
    return { date, label }
  })
}

export function DashboardPage() {
  const state = useAppStore()
  const [period, setPeriod] = useState<PeriodKey>('Current')
  const [comparisonDate, setComparisonDate] = useState('')
  const [category, setCategory] = useState('All')
  const [showDormant, setShowDormant] = useState(false)

  const today = format(new Date(), 'yyyy-MM-dd')
  const generatedSeries = useMemo(() => periodSeries(period, today), [period, today])
  const series = useMemo(() => {
    if (!comparisonDate) return generatedSeries
    return [
      ...generatedSeries.filter((item) => item.date !== today),
      { date: comparisonDate, label: 'Compared' },
      { date: today, label: 'Now' },
    ].sort((a, b) => a.date.localeCompare(b.date))
  }, [comparisonDate, generatedSeries, today])

  const categories = useMemo(
    () => ['All', ...Array.from(new Set(state.skills.map((skill) => skill.category).filter((value): value is string => Boolean(value))))],
    [state.skills],
  )

  const data = useMemo(() => ({
    schemaVersion: state.schemaVersion,
    settings: state.settings,
    skills: state.skills,
    events: state.events,
  }), [state.schemaVersion, state.settings, state.skills, state.events])

  const visibleSkills = useMemo(() => state.skills.filter((skill) => {
    if (skill.archived) return false
    if (category !== 'All' && skill.category !== category) return false
    if (!showDormant) {
      const point = getSkillTimeline(data, skill.id, today).at(-1)
      if (point?.status === 'dormant') return false
    }
    return true
  }), [category, data, showDormant, state.skills, today])

  const periodStart = series[0]?.date ?? format(subDays(new Date(`${today}T12:00:00`), 30), 'yyyy-MM-dd')
  const lastExportAt = state.settings.lastExportAt
  const shouldRemindBackup = !lastExportAt || differenceInCalendarDays(new Date(), new Date(lastExportAt)) > 14

  const onLog = (skillId: string) => {
    window.dispatchEvent(new CustomEvent('open-log-session', { detail: { skillId } }))
  }

  if (state.isLoading) return <main className="page"><section className="empty-card"><p>Loading skill history…</p></section></main>
  if (state.storageError) return <main className="page"><section className="empty-card"><h1>Could not load data</h1><p>{state.storageError}</p></section></main>

  return (
    <main className="dashboard-page">
      {state.skills.some((skill) => skill.demo) && (
        <aside className="demo-banner">This is demo data — edit anything, or explore the chart freely.</aside>
      )}
      <section className="tagline">
        <p>Habits measure whether I showed up. Skills measure what I became capable of.</p>
      </section>
      {shouldRemindBackup && <aside className="backup-reminder">Keep your history safe. <Link to="/export">Download a backup</Link></aside>}
      <MonthlyCheckin />

      <section className="dashboard-toolbar">
        <PeriodSelector value={period} onChange={setPeriod} />
        <label className="compare-control">
          <span>Compare with</span>
          <input type="date" value={comparisonDate} max={today} onChange={(event) => setComparisonDate(event.target.value)} />
        </label>
      </section>

      <div className="category-row" role="group" aria-label="Category filter">
        {categories.map((item) => (
          <button key={item} type="button" className={category === item ? 'active' : ''} aria-pressed={category === item} onClick={() => setCategory(item)}>
            {item}
          </button>
        ))}
        <label className="show-dormant">
          <input type="checkbox" checked={showDormant} onChange={(event) => setShowDormant(event.target.checked)} />
          Show dormant
        </label>
      </div>

      {visibleSkills.length === 0 ? (
        <section className="empty-card dashboard-empty">
          <span className="eyebrow">{state.skills.length === 0 ? 'Start building capability' : 'Nothing to show'}</span>
          <h1>{state.skills.length === 0 ? 'Add your first skill' : 'No skills match these filters'}</h1>
          <p>{state.skills.length === 0 ? 'Track practice, growth, and retention for a skill you care about.' : 'Try another category or include dormant skills.'}</p>
          {state.skills.length === 0
            ? <button type="button" className="primary-button" onClick={() => window.dispatchEvent(new CustomEvent('open-add-skill'))}>Add a skill</button>
            : <button type="button" className="secondary-button" onClick={() => { setCategory('All'); setShowDormant(true) }}>Clear filters</button>}
        </section>
      ) : (
        <div className="dashboard-grid">
          <RadarPanel data={data} skills={visibleSkills} series={series} showDormant={showDormant} />
          <div className="dashboard-right">
            <SummaryStrip data={data} skills={visibleSkills} />
            <SkillCardGrid data={data} skills={visibleSkills} periodStart={periodStart} onLog={onLog} />
          </div>
        </div>
      )}
    </main>
  )
}
