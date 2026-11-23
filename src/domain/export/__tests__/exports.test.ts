import { describe, expect, it } from 'vitest'
import { defaultAppData, defaultAppSettings, defaultSkillConfig } from '../../defaults'
import type { AppData } from '../../types'
import { exportBackupJson, mergeAppData, parseBackupJson } from '../backupJson'
import { generateNotionCsv } from '../notionCsv'
import { generateNotionMarkdown, type ExportOptions } from '../notionMarkdown'
import { generateWeeklySummary } from '../weeklySummary'

const data: AppData = {
  ...defaultAppData,
  settings: { ...defaultAppSettings },
  skills: [{
    id: 'guitar-1',
    name: 'Guitar',
    category: 'Creative',
    templateId: 'guitar',
    milestones: [],
    createdOn: '2026-11-20',
    archived: false,
  }],
  events: [
    {
      id: 'create-1',
      skillId: 'guitar-1',
      date: '2026-11-20',
      createdAt: '2026-11-20T08:00:00.000Z',
      type: 'skill_created',
      initialLevel: 0.1,
      config: { ...defaultSkillConfig },
      status: 'active',
    },
    {
      id: 'practice-1',
      skillId: 'guitar-1',
      date: '2026-11-21',
      createdAt: '2026-11-21T08:00:00.000Z',
      type: 'practice_session',
      minutes: 45,
      notes: 'Practiced "Autumn Leaves",\nreviewed recording',
      performance: { performed: true, typeId: 'recorded_video', audienceSize: 1 },
      templateFields: {},
      selfRating: 4,
      ai: {
        points: 72,
        difficulty: 60,
        novelty: 50,
        focus: 80,
        performanceImpact: 50,
        summary: 'Focused work.',
        strengths: ['Review'],
        improvements: ['Timing'],
        nextSessionSuggestion: 'Try slower tempo.',
        milestoneEvidence: null,
        model: 'test',
        scoredAt: '2026-11-21T08:00:00.000Z',
      },
    },
    {
      id: 'adjust-1',
      skillId: 'guitar-1',
      date: '2026-11-22',
      createdAt: '2026-11-22T08:00:00.000Z',
      type: 'manual_adjustment',
      newLevel: 0.12,
      reason: 'Corrected estimate',
      lowerPeakToo: false,
    },
  ],
}

const options: ExportOptions = {
  fromDate: '2026-11-20',
  toDate: '2026-11-30',
  skillIds: ['guitar-1'],
  includeAiFeedback: true,
  includeLevelChanges: true,
  includeDecayNotes: true,
  includeAdjustments: true,
}

describe('export formatters', () => {
  it('creates dated Markdown with AI feedback, levels, and adjustments', () => {
    const markdown = generateNotionMarkdown(data, options)
    expect(markdown).toContain('## 2026-11-21')
    expect(markdown).toContain('**What I did:** Practiced "Autumn Leaves"')
    expect(markdown).toContain('**AI feedback:** Focused work.')
    expect(markdown).toContain('**Skill level:**')
    expect(markdown).toContain('**Adjusted Guitar:**')
  })

  it('emits valid CSV with headers and quotes commas, quotes, and newlines', () => {
    const csv = generateNotionCsv(data, options)
    expect(csv.split('\r\n')[0]).toBe('Date,Skill,Category,Minutes,Performed,Performance Type,Audience,Notes,Points,Level Before,Level After,Change (pp)')
    expect(csv).toContain('"Practiced ""Autumn Leaves"",\nreviewed recording"')
    expect(csv).toContain('Recorded video')
  })

  it('groups weekly summaries with session count, time, and levels', () => {
    const summary = generateWeeklySummary(data, options)
    expect(summary).toContain('Weekly practice summary')
    expect(summary).toContain('Guitar')
    expect(summary).toContain('1 sessions, 45 min')
    expect(summary).toContain('→')
  })

  it('round-trips full JSON and merges records by ID', () => {
    const restored = parseBackupJson(exportBackupJson(data))
    expect(restored).toEqual(data)
    const merged = mergeAppData(data, {
      ...data,
      skills: [{ ...data.skills[0], name: 'Guitar updated' }],
      events: [data.events[0]],
    })
    expect(merged.skills).toHaveLength(1)
    expect(merged.skills[0].name).toBe('Guitar updated')
    expect(merged.events).toHaveLength(data.events.length)
  })

  it('rejects invalid and newer-version backup JSON', () => {
    expect(() => parseBackupJson('{broken')).toThrow(/valid JSON/)
    expect(() => parseBackupJson(JSON.stringify({ ...data, schemaVersion: 999 }))).toThrow(/cannot read data/)
  })
})
