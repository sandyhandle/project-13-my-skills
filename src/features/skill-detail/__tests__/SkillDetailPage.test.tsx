import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { SkillDetailPage } from '../SkillDetailPage'
import { useAppStore } from '../../../store/useAppStore'

describe('SkillDetailPage', () => {
  beforeEach(() => {
    useAppStore.setState({
      schemaVersion: 1,
      settings: { theme: 'system', aiModel: 'claude-sonnet-5-5', aiEnabled: true, changeThresholdPp: 0.5 },
      isLoading: false,
      storageError: null,
      skills: [{
        id: 'guitar-1',
        name: 'Guitar',
        emoji: '🎸',
        category: 'Creative',
        templateId: 'guitar',
        milestones: [{ id: 'm-5', percent: 5, description: 'Basic chords' }],
        createdOn: '2026-11-23',
        archived: false,
      }],
      events: [{
        id: 'created-1',
        skillId: 'guitar-1',
        date: '2026-11-23',
        createdAt: '2026-11-23T12:00:00.000Z',
        type: 'skill_created',
        initialLevel: 0.05,
        config: {
          baseGrowth: 0.002,
          graceDays: 7,
          halfLifeDays: 180,
          recoveryBoost: 2,
          referenceMinutes: 30,
          maxUnitsPerDay: 3,
          maintenanceDecayMultiplier: 0.5,
          dormantDecayMultiplier: 0.3,
          retentionFloorRatio: 0,
        },
        status: 'active',
      }],
    })
  })

  it('renders stats and history for a skill', () => {
    render(
      <MemoryRouter initialEntries={['/skills/guitar-1']}>
        <Routes><Route path="/skills/:id" element={<SkillDetailPage />} /></Routes>
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { name: 'Guitar' })).toBeInTheDocument()
    expect(screen.getByText('Capability over time')).toBeInTheDocument()
  })

  it('records a manual level adjustment', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/skills/guitar-1']}>
        <Routes><Route path="/skills/:id" element={<SkillDetailPage />} /></Routes>
      </MemoryRouter>,
    )
    await user.click(screen.getByRole('button', { name: 'Set level' }))
    await user.clear(screen.getByLabelText('Reason'))
    await user.type(screen.getByLabelText('Reason'), 'Calibration correction')
    await user.click(screen.getByRole('button', { name: 'Save adjustment' }))
    expect(useAppStore.getState().events.some((event) => event.type === 'manual_adjustment')).toBe(true)
  })
})
