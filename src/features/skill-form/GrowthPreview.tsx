import { calibrateBaseGrowth, previewMonthlyGrowth } from '../../domain/engine/growth'

interface GrowthPreviewProps {
  startingLevel: number
  baseGrowth: number
  onBaseGrowthChange: (value: number) => void
  sessionsPerWeek: number
  onSessionsPerWeekChange: (value: number) => void
  targetGain: number
  onTargetGainChange: (value: number) => void
}

export function GrowthPreview({
  startingLevel,
  baseGrowth,
  onBaseGrowthChange,
  sessionsPerWeek,
  onSessionsPerWeekChange,
  targetGain,
  onTargetGainChange,
}: GrowthPreviewProps) {
  const preview = previewMonthlyGrowth(startingLevel, baseGrowth, sessionsPerWeek)

  const applyTarget = () => {
    onBaseGrowthChange(calibrateBaseGrowth(startingLevel, targetGain, sessionsPerWeek))
  }

  return (
    <div className="growth-preview">
      <strong>Practicing a standard session {sessionsPerWeek}× per week for 30 days:</strong>
      <p>{Math.round(startingLevel * 100)}% → {(preview * 100).toFixed(1)}%</p>
      <label>
        Sessions per week
        <input type="number" min={1} max={7} value={sessionsPerWeek} onChange={(event) => onSessionsPerWeekChange(Math.max(1, Math.min(7, Number(event.target.value))))} />
      </label>
      <div className="calibration-row">
        <label>
          Expected gain per month (pp)
          <input type="number" min={0} max={100} step={0.1} value={targetGain} onChange={(event) => onTargetGainChange(Number(event.target.value))} />
        </label>
        <button type="button" onClick={applyTarget}>Calibrate growth</button>
      </div>
      <small>Calibrating updates baseGrowth to {baseGrowth.toFixed(5)}.</small>
    </div>
  )
}
