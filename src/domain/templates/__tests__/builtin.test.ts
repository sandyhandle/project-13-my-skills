import { describe, expect, it } from 'vitest'
import {
  BUILTIN_TEMPLATES,
  MARATHI_SUGGESTED_MILESTONES,
  getTemplateById,
} from '../index'

describe('built-in skill templates', () => {
  it('exports all eight templates with unique IDs', () => {
    expect(BUILTIN_TEMPLATES).toHaveLength(8)
    expect(new Set(BUILTIN_TEMPLATES.map((template) => template.id)).size).toBe(8)
    expect(BUILTIN_TEMPLATES.map((template) => template.id)).toEqual([
      'guitar',
      'sport',
      'gym',
      'language',
      'coding',
      'interview',
      'craft',
      'generic',
    ])
  })

  it('finds templates by ID and includes the generic fallback', () => {
    expect(getTemplateById('guitar')?.label).toBe('Music instrument (Guitar)')
    expect(getTemplateById('does-not-exist')).toBeUndefined()
    expect(getTemplateById('generic')?.fields).toEqual([])
  })

  it('defines the expected practice fields and performance factors', () => {
    expect(getTemplateById('guitar')?.fields.map((field) => field.id)).toEqual([
      'focus',
      'tempoBpm',
      'songs',
    ])
    expect(getTemplateById('interview')?.performanceTypes).toContainEqual({
      id: 'real_interview',
      label: 'Real interview',
      factor: 2.5,
      usesAudience: true,
    })
  })

  it('provides Marathi milestones at the required percentage boundaries', () => {
    expect(MARATHI_SUGGESTED_MILESTONES.map((item) => item.percent)).toEqual([
      0, 5, 10, 20, 30, 50, 70, 90, 100,
    ])
  })

  it('keeps every template rubric and performance configuration populated', () => {
    for (const template of BUILTIN_TEMPLATES) {
      expect(template.aiRubric.length).toBeGreaterThan(20)
      expect(template.notePlaceholder.length).toBeGreaterThan(20)
      if (template.id !== 'generic') {
        expect(template.performanceTypes.length).toBeGreaterThan(0)
      }
    }
  })
})
