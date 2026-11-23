import { useMemo } from 'react'
import { useReducedMotion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import type { AppData } from '../../domain/types'
import { getSkillTimeline, snapshot } from '../../store/selectors'

export interface SnapshotSeries {
  date: string
  label: string
}

interface RadarPanelProps {
  data: AppData
  skills: AppData['skills']
  series: SnapshotSeries[]
  showDormant: boolean
}

export function RadarPanel({ data, skills, series, showDormant }: RadarPanelProps) {
  const navigate = useNavigate()
  const reduceMotion = useReducedMotion()
  const visibleSkills = useMemo(
    () => skills.filter((skill) => {
      if (showDormant) return !skill.archived
      const point = getSkillTimeline(data, skill.id, series.at(-1)?.date ?? '')?.at(-1)
      return !skill.archived && point?.status !== 'dormant'
    }),
    [data, series, skills, showDormant],
  )

  const radarData = visibleSkills.map((skill) => {
    const row: Record<string, string | number | null> = {
      skill: `${skill.emoji ?? ''} ${skill.name}`.trim(),
      skillId: skill.id,
    }
    series.forEach((item) => {
      const values = snapshot(data, item.date)
      row[item.date] = values[skill.id] === null || values[skill.id] === undefined
        ? null
        : Math.round((values[skill.id] as number) * 1000) / 10
    })
    const current = snapshot(data, series.at(-1)?.date ?? '')
    row.current = current[skill.id] === null || current[skill.id] === undefined
      ? null
      : Math.round((current[skill.id] as number) * 1000) / 10
    return row
  })

  if (visibleSkills.length < 3) {
    return (
      <section className="radar-panel card" aria-label="Skill levels">
        <div className="horizontal-levels">
          {radarData.map((row) => (
            <button key={String(row.skillId)} type="button" className="level-row" onClick={() => navigate(`/skills/${String(row.skillId)}`)}>
              <span>{row.skill}</span>
              <span className="level-track"><span style={{ width: `${Number(row.current ?? 0)}%` }} /></span>
              <strong>{Number(row.current ?? 0).toFixed(1)}%</strong>
            </button>
          ))}
        </div>
        {visibleSkills.length === 0 && <p className="muted">No skills to display.</p>}
        <p className="radar-hint">Add at least 3 skills to use the radar chart.</p>
      </section>
    )
  }

  const latestDate = series.at(-1)?.date

  return (
    <section className="radar-panel card" aria-label="Skill radar comparison">
      <div className="radar-chart">
        <ResponsiveContainer width="100%" height={380}>
          <RadarChart data={radarData} outerRadius="72%">
            <PolarGrid gridType="polygon" />
            <PolarAngleAxis
              dataKey="skill"
              tick={({ x, y, payload, textAnchor }) => {
                const row = radarData.find((item) => item.skill === payload.value)
                const skillId = String(row?.skillId ?? '')
                const skill = visibleSkills.find((item) => item.id === skillId)
                const current = Number(row?.current ?? 0)
                return (
                  <text
                    x={x}
                    y={y}
                    textAnchor={textAnchor}
                    dominantBaseline="central"
                    className="radar-label"
                    role="button"
                    tabIndex={0}
                    aria-label={`Open ${skill?.name ?? 'skill'} details, ${current.toFixed(1)} percent`}
                    onClick={() => navigate(`/skills/${skillId}`)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') navigate(`/skills/${skillId}`)
                    }}
                  >
                    <tspan x={x}>{`${skill?.emoji ?? ''} ${skill?.name ?? ''}`}</tspan>
                    <tspan x={x} dy={14}>{`${current.toFixed(1)}%`}</tspan>
                  </text>
                )
              }}
            />
            {series.map((item, index) => (
              <Radar
                key={item.date}
                name={item.label}
                dataKey={item.date}
                stroke={index === series.length - 1 ? '#8b5cf6' : '#94a3b8'}
                fill={index === series.length - 1 ? '#8b5cf6' : '#94a3b8'}
                fillOpacity={index === series.length - 1 ? 0.22 : 0.07}
                strokeOpacity={0.25 + ((index + 1) / series.length) * 0.75}
                strokeDasharray={index === series.length - 1 ? undefined : '4 4'}
                isAnimationActive={!reduceMotion}
              />
            ))}
            <Tooltip
              formatter={(value, name) => [`${Number(value).toFixed(1)}%`, name]}
              contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12 }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <div className="radar-legend" aria-label="Radar legend">
        {series.map((item, index) => (
          <span key={item.date}>
            <i style={{ background: index === series.length - 1 ? '#8b5cf6' : '#94a3b8' }} />
            {item.label}{item.date === latestDate ? ' (now)' : ''}
          </span>
        ))}
      </div>
      <details className="radar-table">
        <summary>View as table</summary>
        <table>
          <thead><tr><th>Skill</th>{series.map((item) => <th key={item.date}>{item.label}</th>)}</tr></thead>
          <tbody>
            {radarData.map((row) => (
              <tr key={String(row.skillId)}>
                <th>{row.skill}</th>
                {series.map((item) => <td key={item.date}>{row[item.date] === null ? 'Not started' : `${Number(row[item.date]).toFixed(1)}%`}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  )
}
