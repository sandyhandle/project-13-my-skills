import { Plus, Trash2 } from 'lucide-react'
import type { Milestone } from '../../domain/types'

interface MilestoneEditorProps {
  milestones: Milestone[]
  onChange: (milestones: Milestone[]) => void
  suggestions?: Milestone[]
}

export function MilestoneEditor({ milestones, onChange, suggestions }: MilestoneEditorProps) {
  const update = (id: string, patch: Partial<Milestone>) => {
    onChange(milestones.map((milestone) => milestone.id === id ? { ...milestone, ...patch } : milestone))
  }

  return (
    <div className="milestone-editor">
      {suggestions && (
        <button type="button" className="text-button" onClick={() => onChange(suggestions.map((item) => ({ ...item })))}>Use template suggestions</button>
      )}
      {milestones.map((milestone) => (
        <div className="milestone-row" key={milestone.id}>
          <input
            type="number"
            min={0}
            max={100}
            aria-label="Milestone percent"
            value={milestone.percent}
            onChange={(event) => update(milestone.id, { percent: Math.max(0, Math.min(100, Number(event.target.value))) })}
          />
          <input
            type="text"
            aria-label="Milestone description"
            value={milestone.description}
            onChange={(event) => update(milestone.id, { description: event.target.value })}
          />
          <button type="button" aria-label="Remove milestone" onClick={() => onChange(milestones.filter((item) => item.id !== milestone.id))}>
            <Trash2 size={16} />
          </button>
        </div>
      ))}
      <button
        type="button"
        className="text-button"
        onClick={() => onChange([...milestones, { id: crypto.randomUUID(), percent: 50, description: '' }])}
      >
        <Plus size={15} /> Add milestone
      </button>
    </div>
  )
}
