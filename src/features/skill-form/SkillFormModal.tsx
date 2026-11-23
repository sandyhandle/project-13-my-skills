import { useEffect, useState, type FormEvent } from 'react'
import { X } from 'lucide-react'
import { showToast } from '../../components/ui/toast'
import { useDialogAccessibility } from '../../components/ui/useDialogAccessibility'
import type { Milestone, SeasonPlan, Skill, SkillConfig } from '../../domain/types'
import { defaultSkillConfig } from '../../domain/defaults'
import { builtinTemplates, getTemplateById } from '../../domain/templates'
import { draftMilestones } from '../../domain/ai/draftMilestones'
import { useAppStore } from '../../store/useAppStore'
import { GrowthPreview } from './GrowthPreview'
import { MilestoneEditor } from './MilestoneEditor'

interface SkillFormModalProps {
  open: boolean
  skill?: Skill
  onClose: () => void
}

export function SkillFormModal({ open, skill, onClose }: SkillFormModalProps) {
  const dialogRef = useDialogAccessibility(open, onClose)
  const addSkill = useAppStore((state) => state.addSkill)
  const updateSkill = useAppStore((state) => state.updateSkill)
  const changeConfig = useAppStore((state) => state.changeConfig)
  const startSeason = useAppStore((state) => state.startSeason)
  const skills = useAppStore((state) => state.skills)

  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('')
  const [category, setCategory] = useState('')
  const [templateId, setTemplateId] = useState('generic')
  const [startingLevel, setStartingLevel] = useState(0)
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [config, setConfig] = useState<SkillConfig>({ ...defaultSkillConfig })
  const [sessionsPerWeek, setSessionsPerWeek] = useState(5)
  const [targetGain, setTargetGain] = useState(10)
  const [dailyDecayPercent, setDailyDecayPercent] = useState(0.2)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [seasonEnabled, setSeasonEnabled] = useState(false)
  const [seasonGoal, setSeasonGoal] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [targetLevel, setTargetLevel] = useState(70)
  const [endCondition, setEndCondition] = useState('')
  const [revisitDate, setRevisitDate] = useState('')
  const [draftingMilestones, setDraftingMilestones] = useState(false)

  useEffect(() => {
    if (!open) return
    if (skill) {
      const event = useAppStore.getState().events.find((item) => item.skillId === skill.id && item.type === 'skill_created')
      setName(skill.name)
      setEmoji(skill.emoji ?? '')
      setCategory(skill.category ?? '')
      setTemplateId(skill.templateId)
      setMilestones(skill.milestones.map((item) => ({ ...item })))
      setStartingLevel(event?.type === 'skill_created' ? event.initialLevel : 0)
      setConfig(event?.type === 'skill_created' ? { ...event.config } : { ...defaultSkillConfig })
    } else {
      setName('')
      setEmoji('')
      setCategory('')
      setTemplateId('generic')
      setStartingLevel(0)
      setMilestones([])
      setConfig({ ...defaultSkillConfig })
      setSeasonEnabled(false)
    }
  }, [open, skill])

  useEffect(() => {
    const k = -Math.log(1 - dailyDecayPercent / 100)
    if (Number.isFinite(k) && k > 0) {
      setConfig((current) => ({ ...current, halfLifeDays: Math.log(2) / k }))
    }
  }, [dailyDecayPercent])

  if (!open) return null

  const categorySuggestions = Array.from(new Set([
    'Physical',
    'Technical',
    'Creative',
    'Communication',
    'Other',
    ...skills.map((item) => item.category).filter((item): item is string => Boolean(item)),
  ]))

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const nextErrors: Record<string, string> = {}
    if (!name.trim()) nextErrors.name = 'Enter a skill name.'
    if (startingLevel < 0 || startingLevel > 1) nextErrors.startingLevel = 'Starting level must be 0–100.'
    if (config.halfLifeDays <= 0) nextErrors.halfLife = 'Half-life must be greater than zero.'
    if (seasonEnabled && !seasonGoal.trim()) nextErrors.seasonGoal = 'Enter a season goal.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    if (skill) {
      updateSkill(skill.id, {
        name: name.trim(),
        emoji: emoji || undefined,
        category: category.trim() || undefined,
        templateId,
        milestones,
      })
      changeConfig(skill.id, new Date().toISOString().slice(0, 10), config)
      showToast(`${name.trim()} updated.`)
    } else {
      const today = new Date().toISOString().slice(0, 10)
      const created = addSkill({
        name: name.trim(),
        emoji: emoji || undefined,
        category: category.trim() || undefined,
        templateId,
        milestones,
        createdOn: today,
        archived: false,
        initialLevel: startingLevel,
        config,
      })
      if (seasonEnabled) {
        const plan: SeasonPlan = {
          goal: seasonGoal.trim(),
          targetDate: targetDate || undefined,
          targetLevel: targetLevel / 100,
          sessionsPerWeek,
          endCondition: endCondition.trim() || undefined,
          revisitDate: revisitDate || undefined,
        }
        startSeason(created.id, today, plan)
      }
      showToast(`${name.trim()} added.`)
    }
    onClose()
  }

  const selectedTemplate = getTemplateById(templateId) ?? getTemplateById('generic')

  const generateMilestones = async () => {
    const settings = useAppStore.getState().settings
    if (!settings.anthropicApiKey) {
      setErrors((current) => ({ ...current, milestones: 'Add an Anthropic API key in Settings to draft milestones.' }))
      return
    }
    if (!name.trim()) {
      setErrors((current) => ({ ...current, milestones: 'Enter a skill name first.' }))
      return
    }
    setDraftingMilestones(true)
    setErrors((current) => ({ ...current, milestones: '' }))
    try {
      const drafted = await draftMilestones({
        apiKey: settings.anthropicApiKey,
        model: settings.aiModel,
        skillName: name.trim(),
        rubric: selectedTemplate?.aiRubric ?? '',
      })
      setMilestones(drafted)
    } catch (error) {
      setErrors((current) => ({
        ...current,
        milestones: error instanceof Error ? error.message : 'Could not draft milestones.',
      }))
    } finally {
      setDraftingMilestones(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section ref={dialogRef} tabIndex={-1} className="modal-panel skill-form-modal" role="dialog" aria-modal="true" aria-label={skill ? 'Edit skill' : 'Add skill'}>
        <header className="modal-header">
          <div><span className="eyebrow">{skill ? 'Edit skill' : 'New skill'}</span><h2>{skill ? 'Update skill' : 'Add a skill'}</h2></div>
          <button type="button" className="icon-button" aria-label="Close" onClick={onClose}><X size={18} /></button>
        </header>
        <form onSubmit={submit}>
          <div className="form-grid">
            <label>Name<input value={name} aria-invalid={Boolean(errors.name)} onChange={(event) => setName(event.target.value)} />{errors.name && <small role="alert" className="form-error">{errors.name}</small>}</label>
            <label>Emoji<input value={emoji} maxLength={8} onChange={(event) => setEmoji(event.target.value)} placeholder="🎸" /></label>
            <label>Category
              <input list="category-suggestions" value={category} onChange={(event) => setCategory(event.target.value)} placeholder="Technical" />
              <datalist id="category-suggestions">{categorySuggestions.map((item) => <option key={item} value={item} />)}</datalist>
            </label>
            <label>Template
              <select value={templateId} onChange={(event) => {
                const nextId = event.target.value
                setTemplateId(nextId)
                const template = getTemplateById(nextId)
                if (template?.suggestedMilestones) setMilestones(template.suggestedMilestones.map((item) => ({ ...item })))
              }}>
                {builtinTemplates.map((template) => <option key={template.id} value={template.id}>{template.label}</option>)}
              </select>
            </label>
            {!skill && (
              <label>Starting level (%)
                <input type="number" min={0} max={100} value={startingLevel * 100} onChange={(event) => setStartingLevel(Math.max(0, Math.min(100, Number(event.target.value))) / 100)} />
                {errors.startingLevel && <small role="alert" className="form-error">{errors.startingLevel}</small>}
              </label>
            )}
          </div>

          <fieldset className="form-section">
            <legend>Growth</legend>
            <label>Base growth per standard unit
              <input type="number" min={0} max={0.1} step={0.0001} value={config.baseGrowth} onChange={(event) => setConfig({ ...config, baseGrowth: Number(event.target.value) })} />
            </label>
            <GrowthPreview
              startingLevel={startingLevel}
              baseGrowth={config.baseGrowth}
              onBaseGrowthChange={(baseGrowth) => setConfig({ ...config, baseGrowth })}
              sessionsPerWeek={sessionsPerWeek}
              onSessionsPerWeekChange={setSessionsPerWeek}
              targetGain={targetGain}
              onTargetGainChange={setTargetGain}
            />
          </fieldset>

          <fieldset className="form-section">
            <legend>Retention</legend>
            <div className="form-grid">
              <label>Grace period (days)<input type="number" min={0} value={config.graceDays} onChange={(event) => setConfig({ ...config, graceDays: Number(event.target.value) })} /></label>
              <label>Half-life (days)<input type="number" min={1} aria-invalid={Boolean(errors.halfLife)} value={config.halfLifeDays} onChange={(event) => setConfig({ ...config, halfLifeDays: Number(event.target.value) })} />{errors.halfLife && <small role="alert" className="form-error">{errors.halfLife}</small>}</label>
              <label>Loss per day (%)<input type="number" min={0} max={100} step={0.1} value={dailyDecayPercent} onChange={(event) => setDailyDecayPercent(Number(event.target.value))} /></label>
              <label>Recovery boost<input type="number" min={0} step={0.1} value={config.recoveryBoost} onChange={(event) => setConfig({ ...config, recoveryBoost: Number(event.target.value) })} /></label>
            </div>
          </fieldset>

          <fieldset className="form-section">
            <legend>Milestones</legend>
            <button type="button" className="text-button" disabled={draftingMilestones} onClick={() => void generateMilestones()}>
              {draftingMilestones ? 'Drafting…' : 'Draft milestones with AI'}
            </button>
            {errors.milestones && <small role="alert" className="form-error">{errors.milestones}</small>}
            <MilestoneEditor milestones={milestones} onChange={setMilestones} suggestions={selectedTemplate?.suggestedMilestones?.map((item) => ({ ...item }))} />
          </fieldset>

          <fieldset className="form-section">
            <legend>Season</legend>
            <label className="checkbox-label"><input type="checkbox" checked={seasonEnabled} onChange={(event) => setSeasonEnabled(event.target.checked)} /> Add an optional season plan</label>
            {seasonEnabled && (
              <div className="form-grid">
                <label>Goal<input value={seasonGoal} onChange={(event) => setSeasonGoal(event.target.value)} />{errors.seasonGoal && <small className="form-error">{errors.seasonGoal}</small>}</label>
                <label>Target date<input type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} /></label>
                <label>Target level (%)<input type="number" min={0} max={100} value={targetLevel} onChange={(event) => setTargetLevel(Number(event.target.value))} /></label>
                <label>End condition<input value={endCondition} onChange={(event) => setEndCondition(event.target.value)} /></label>
                <label>Revisit date<input type="date" value={revisitDate} onChange={(event) => setRevisitDate(event.target.value)} /></label>
              </div>
            )}
          </fieldset>

          <footer className="modal-footer">
            <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
            <button type="submit" className="primary-button">{skill ? 'Save changes' : 'Add skill'}</button>
          </footer>
        </form>
      </section>
    </div>
  )
}
