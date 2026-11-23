import { RotateCcw } from 'lucide-react'
import type { CSSProperties } from 'react'

interface AiScorePanelProps {
  points: number
  fallback: boolean
  difficulty?: number
  novelty?: number
  focus?: number
  performanceImpact?: number | null
  summary?: string
  strengths?: string[]
  improvements?: string[]
  nextSuggestion?: string
  milestoneEvidence?: string | null
  growthPp?: number
  error?: string
  isScoring?: boolean
  onOverride: (points: number) => void
  onRerun?: () => void
  onClose: () => void
}

export function AiScorePanel({
  points,
  fallback,
  difficulty,
  novelty,
  focus,
  performanceImpact,
  summary,
  strengths = [],
  improvements = [],
  nextSuggestion,
  milestoneEvidence,
  growthPp,
  error,
  isScoring = false,
  onOverride,
  onRerun,
  onClose,
}: AiScorePanelProps) {
  const bars = [
    ['Difficulty', difficulty],
    ['Novelty', novelty],
    ['Focus', focus],
  ]

  return (
    <section className="ai-score-panel" aria-label="Session score">
      <div className="score-heading">
        <div className="points-ring" style={{ '--ring': `${points * 3.6}deg` } as CSSProperties}>
          <strong>{points}</strong><span>/100</span>
        </div>
        <div>
          <span className={fallback ? 'score-badge fallback' : 'score-badge'}>{fallback ? 'Estimated · no AI' : 'AI score'}</span>
          {growthPp !== undefined && <p className="growth-result">Growth from this session: <strong>+{growthPp.toFixed(2)} pp</strong></p>}
        </div>
      </div>

      {bars.every(([, value]) => typeof value === 'number') && (
        <div className="score-bars">
          {bars.map(([label, value]) => (
            <label key={String(label)}>{label}<span><i style={{ width: `${Number(value)}%` }} /></span><strong>{value}</strong></label>
          ))}
        </div>
      )}
      {performanceImpact != null && <p><strong>Performance impact:</strong> {performanceImpact}/100</p>}
      {summary && <p><strong>Summary:</strong> {summary}</p>}
      {strengths.length > 0 && <p><strong>Strengths:</strong> {strengths.join(' · ')}</p>}
      {improvements.length > 0 && <p><strong>Improve:</strong> {improvements.join(' · ')}</p>}
      {nextSuggestion && <p><strong>Next session:</strong> {nextSuggestion}</p>}
      {milestoneEvidence && <p><strong>Milestone evidence:</strong> {milestoneEvidence}</p>}
      {error && <p role="alert" className="form-error">{error}</p>}

      <label className="override-control">
        Override points
        <input type="range" min={0} max={100} value={points} onChange={(event) => onOverride(Number(event.target.value))} />
      </label>
      <div className="score-actions">
        {onRerun && <button type="button" className="secondary-button" disabled={isScoring} onClick={onRerun}>{isScoring ? 'Scoring…' : 'Re-run AI'}</button>}
        <button type="button" className="secondary-button" onClick={onClose}><RotateCcw size={16} /> Done</button>
      </div>
    </section>
  )
}
