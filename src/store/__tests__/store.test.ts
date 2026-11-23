import { beforeEach, describe, expect, it } from 'vitest'
import { defaultSkillConfig } from '../../domain/defaults'
import { useAppStore } from '../useAppStore'
import { getSkillTimeline, snapshot } from '../selectors'

describe('application store', () => {
  beforeEach(() => {
    localStorage.clear()
    useAppStore.setState({
      isLoading: false,
      storageError: null,
      skills: [],
      events: [],
      settings: { theme: 'system', aiModel: 'claude-sonnet-5-5', aiEnabled: true, changeThresholdPp: 0.5 },
      schemaVersion: 1,
    })
  })

  it('loads first-run seed data with seven skills', async () => {
    await useAppStore.getState().hydrate()
    expect(useAppStore.getState().skills).toHaveLength(7)
    expect(localStorage.getItem('skill-progress-tracker:v1')).not.toBeNull()
  })

  it('coalesces overlapping hydration requests', async () => {
    const first = useAppStore.getState().hydrate()
    const second = useAppStore.getState().hydrate()

    expect(second).toBe(first)
    await Promise.all([first, second])
    expect(useAppStore.getState().skills).toHaveLength(7)
  })

  it('adds and deletes a skill with its events', () => {
    const skill = useAppStore.getState().addSkill({
      name: 'Piano',
      emoji: '🎹',
      category: 'Creative',
      templateId: 'guitar',
      milestones: [],
      createdOn: '2026-11-23',
      archived: false,
    })

    expect(useAppStore.getState().skills).toHaveLength(1)
    expect(useAppStore.getState().events.some((event) => event.skillId === skill.id)).toBe(true)

    useAppStore.getState().deleteSkill(skill.id)
    expect(useAppStore.getState().skills).toHaveLength(0)
    expect(useAppStore.getState().events).toHaveLength(0)
  })

  it('generates demo history and archives status without removing history', async () => {
    await useAppStore.getState().hydrate()
    const originalEventCount = useAppStore.getState().events.length

    useAppStore.getState().loadDemoHistory()
    expect(useAppStore.getState().events.length).toBeGreaterThan(originalEventCount)
    expect(useAppStore.getState().skills.every((skill) => skill.demo)).toBe(true)
  })

  it('memoizes timelines and produces snapshots', () => {
    useAppStore.getState().hydrate = async () => undefined
    const skill = useAppStore.getState().addSkill({
      name: 'Test',
      templateId: 'generic',
      milestones: [],
      createdOn: '2026-11-23',
      archived: false,
    })
    useAppStore.getState().changeConfig(skill.id, '2026-11-23', { ...defaultSkillConfig })

    const state = useAppStore.getState()
    const first = getSkillTimeline({
      schemaVersion: state.schemaVersion,
      settings: state.settings,
      skills: state.skills,
      events: state.events,
    }, skill.id, '2026-11-23')
    const second = getSkillTimeline({
      schemaVersion: state.schemaVersion,
      settings: state.settings,
      skills: state.skills,
      events: state.events,
    }, skill.id, '2026-11-23')

    expect(first).toBe(second)
    expect(snapshot({
      schemaVersion: state.schemaVersion,
      settings: state.settings,
      skills: state.skills,
      events: state.events,
    }, '2026-11-23')[skill.id]).toBe(0)
  })
})
