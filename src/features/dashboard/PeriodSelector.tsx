export type PeriodKey = 'Current' | 'Day' | 'Week' | 'Month' | '3 Months' | '6 Months' | 'Year'

interface PeriodSelectorProps {
  value: PeriodKey
  onChange: (period: PeriodKey) => void
}

const periods: PeriodKey[] = ['Current', 'Day', 'Week', 'Month', '3 Months', '6 Months', 'Year']

export function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  return (
    <div className="period-selector" role="group" aria-label="Dashboard period">
      {periods.map((period) => (
        <button
          key={period}
          type="button"
          className={period === value ? 'active' : ''}
          aria-pressed={period === value}
          onClick={() => onChange(period)}
        >
          {period}
        </button>
      ))}
    </div>
  )
}
