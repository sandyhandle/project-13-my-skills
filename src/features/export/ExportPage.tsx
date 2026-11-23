import { useMemo, useRef, useState } from 'react'
import { differenceInCalendarDays, format, subDays } from 'date-fns'
import { Download } from 'lucide-react'
import type { AppData } from '../../domain/types'
import { exportBackupJson, mergeAppData, parseBackupJson } from '../../domain/export/backupJson'
import { generateNotionCsv } from '../../domain/export/notionCsv'
import { generateNotionMarkdown, type ExportOptions } from '../../domain/export/notionMarkdown'
import { generateWeeklySummary } from '../../domain/export/weeklySummary'
import { useAppStore } from '../../store/useAppStore'

type ExportTab = 'markdown' | 'csv' | 'weekly' | 'json'

const today = () => format(new Date(), 'yyyy-MM-dd')
const defaultFrom = () => format(subDays(new Date(), 30), 'yyyy-MM-dd')

export function ExportPage() {
  const state = useAppStore()
  const importData = useAppStore((store) => store.importData)
  const updateSettings = useAppStore((store) => store.updateSettings)
  const fileInput = useRef<HTMLInputElement>(null)
  const [tab, setTab] = useState<ExportTab>('markdown')
  const [fromDate, setFromDate] = useState(defaultFrom)
  const [toDate, setToDate] = useState(today)
  const [selectedSkills, setSelectedSkills] = useState<string[] | null>(null)
  const [includeAiFeedback, setIncludeAiFeedback] = useState(true)
  const [includeLevelChanges, setIncludeLevelChanges] = useState(true)
  const [includeDecayNotes, setIncludeDecayNotes] = useState(false)
  const [includeAdjustments, setIncludeAdjustments] = useState(true)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [pendingImport, setPendingImport] = useState<AppData | null>(null)

  const skills = state.skills
  const defaultSkillIds = useMemo(() => skills.filter((skill) => !skill.archived).map((skill) => skill.id), [skills])
  const effectiveSelected = selectedSkills ?? defaultSkillIds
  const options = useMemo<ExportOptions>(() => ({
    fromDate,
    toDate,
    skillIds: effectiveSelected,
    includeAiFeedback,
    includeLevelChanges,
    includeDecayNotes,
    includeAdjustments,
  }), [
    fromDate,
    toDate,
    effectiveSelected,
    includeAiFeedback,
    includeLevelChanges,
    includeDecayNotes,
    includeAdjustments,
  ])
  const data = useMemo<AppData>(() => ({
    schemaVersion: state.schemaVersion,
    settings: state.settings,
    skills: state.skills,
    events: state.events,
  }), [state.schemaVersion, state.settings, state.skills, state.events])
  const outputs = useMemo(() => ({
    markdown: generateNotionMarkdown(data, options),
    csv: generateNotionCsv(data, options),
    weekly: generateWeeklySummary(data, options),
    json: exportBackupJson(data),
  }), [data, options])
  const output = outputs[tab]

  const markExported = () => updateSettings({ lastExportAt: new Date().toISOString() })

  const copyOutput = async () => {
    try {
      await navigator.clipboard.writeText(output)
      markExported()
      setError('')
      setMessage('Copied to clipboard.')
    } catch (caught) {
      setError(caught instanceof Error ? `Copy failed: ${caught.message}` : 'Copy failed. Clipboard access is unavailable.')
      setMessage('')
    }
  }

  const downloadOutput = () => {
    const extension = tab === 'csv' ? 'csv' : tab === 'json' ? 'json' : 'md'
    const mime = tab === 'csv' ? 'text/csv' : tab === 'json' ? 'application/json' : 'text/markdown'
    const blob = new Blob([output], { type: `${mime};charset=utf-8` })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `skill-progress-${tab}-${today()}.${extension}`
    link.click()
    URL.revokeObjectURL(url)
    markExported()
    setError('')
    setMessage('Download started.')
  }

  const selectAllSkills = () => {
    setSelectedSkills(effectiveSelected.length === skills.filter((skill) => !skill.archived).length
      ? []
      : skills.filter((skill) => !skill.archived).map((skill) => skill.id))
  }

  const loadImportFile = async (file?: File) => {
    if (!file) return
    setError('')
    setMessage('')
    try {
      setPendingImport(parseBackupJson(await file.text()))
    } catch (caught) {
      setPendingImport(null)
      setError(caught instanceof Error ? caught.message : 'Could not read the backup file.')
    }
  }

  const applyImport = (mode: 'replace' | 'merge') => {
    if (!pendingImport) return
    try {
      const imported = mode === 'replace' ? pendingImport : mergeAppData(data, pendingImport)
      importData(imported)
      setPendingImport(null)
      setMessage(mode === 'replace' ? 'Backup restored.' : 'Backup merged with current data.')
      setError('')
      if (fileInput.current) fileInput.current.value = ''
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Import could not be applied.')
    }
  }

  const lastExportDays = state.settings.lastExportAt
    ? differenceInCalendarDays(new Date(), new Date(state.settings.lastExportAt))
    : null

  return (
    <main className="export-page">
      <header className="export-header">
        <div><span className="eyebrow">Take your data with you</span><h1>Export</h1></div>
        {lastExportDays !== null && <span className="muted">Last backup: {lastExportDays === 0 ? 'today' : `${lastExportDays} days ago`}</span>}
      </header>

      <section className="card export-controls">
        <div className="export-filter-grid">
          <label>From<input type="date" value={fromDate} max={toDate} onChange={(event) => setFromDate(event.target.value)} /></label>
          <label>To<input type="date" value={toDate} min={fromDate} max={today()} onChange={(event) => setToDate(event.target.value)} /></label>
          <div className="skill-filter">
            <div className="filter-heading"><strong>Skills</strong><button type="button" className="text-button" onClick={selectAllSkills}>Toggle all</button></div>
            <div className="skill-checkbox-list">
              {skills.map((skill) => (
                <label key={skill.id}><input type="checkbox" checked={effectiveSelected.includes(skill.id)} onChange={(event) => {
                  setSelectedSkills((current) => {
                    const selected = current ?? skills.filter((item) => !item.archived).map((item) => item.id)
                    return event.target.checked
                      ? [...new Set([...selected, skill.id])]
                      : selected.filter((item) => item !== skill.id)
                  })
                }} />{skill.emoji} {skill.name}{skill.archived ? ' (archived)' : ''}</label>
              ))}
            </div>
          </div>
        </div>
        <div className="export-options">
          <label><input type="checkbox" checked={includeAiFeedback} onChange={(event) => setIncludeAiFeedback(event.target.checked)} /> Include AI feedback</label>
          <label><input type="checkbox" checked={includeLevelChanges} onChange={(event) => setIncludeLevelChanges(event.target.checked)} /> Include level changes</label>
          <label><input type="checkbox" checked={includeDecayNotes} onChange={(event) => setIncludeDecayNotes(event.target.checked)} /> Include decay notes</label>
          <label><input type="checkbox" checked={includeAdjustments} onChange={(event) => setIncludeAdjustments(event.target.checked)} /> Include adjustments / status changes</label>
        </div>
      </section>

      <section className="card export-output">
        <div className="export-output-header">
          <div className="export-tabs" role="group" aria-label="Export format">
            {([
              ['markdown', 'Markdown'],
              ['csv', 'CSV'],
              ['weekly', 'Weekly summary'],
              ['json', 'Full JSON backup'],
            ] as const).map(([key, label]) => (
              <button key={key} type="button" aria-pressed={tab === key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{label}</button>
            ))}
          </div>
          <div className="export-actions">
            {tab !== 'json' && <button type="button" className="secondary-button" onClick={() => void copyOutput()}>Copy</button>}
            <button type="button" className="primary-button" onClick={downloadOutput}><Download size={15} /> Download</button>
          </div>
        </div>
        <pre className="export-preview" aria-label={`${tab} export preview`}>{output || 'No data in this date range.'}</pre>

        {tab === 'json' && (
          <div className="import-section">
            <h2>Import JSON backup</h2>
            <p className="muted">The file is validated before import. Choose whether to replace all data or merge by record ID.</p>
            <input ref={fileInput} type="file" accept="application/json,.json" onChange={(event) => void loadImportFile(event.target.files?.[0])} />
            {pendingImport && (
              <div className="import-preview">
                <strong>Backup preview</strong>
                <span>{pendingImport.skills.length} skills · {pendingImport.events.length} events</span>
                <div><button type="button" className="danger-button" onClick={() => applyImport('replace')}>Replace current data</button><button type="button" className="primary-button" onClick={() => applyImport('merge')}>Merge with current data</button></div>
              </div>
            )}
          </div>
        )}
        {error && <p role="alert" className="form-error">{error}</p>}
        {message && <p role="status" className="settings-success">{message}</p>}
      </section>
    </main>
  )
}
