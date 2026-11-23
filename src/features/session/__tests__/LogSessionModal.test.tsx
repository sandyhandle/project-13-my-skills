import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LogSessionModal } from '../LogSessionModal'
import { useAppStore } from '../../../store/useAppStore'

describe('LogSessionModal', () => {
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
        milestones: [],
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

  it('logs a fallback-scored session', async () => {
    const user = userEvent.setup()
    render(<LogSessionModal open skillId="guitar-1" onClose={() => undefined} />)

    await user.type(screen.getByLabelText('What did you do?'), 'Practiced chord changes and reviewed a recording')
    await user.click(screen.getByRole('button', { name: 'Save (fallback score)' }))

    expect(screen.getByLabelText('Session result')).toBeInTheDocument()
    expect(screen.getByText('Estimated · no AI')).toBeInTheDocument()
    expect(useAppStore.getState().events.some((event) => event.type === 'practice_session')).toBe(true)
  })

  it('validates duration and notes', () => {
    render(<LogSessionModal open skillId="guitar-1" onClose={() => undefined} />)
    fireEvent.change(screen.getByLabelText('Duration'), { target: { value: 'invalid' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save without scoring' }))
    expect(screen.getByText('Enter a valid duration.')).toBeInTheDocument()
  })

  it('traps keyboard focus and closes with Escape', () => {
    const onClose = vi.fn()
    render(<LogSessionModal open skillId="guitar-1" onClose={onClose} />)

    const dialog = screen.getByRole('dialog', { name: 'Log practice session' })
    const lastAction = screen.getByRole('button', { name: 'Save & score with AI' })
    screen.getByRole('button', { name: 'Close' }).focus()
    fireEvent.keyDown(document.activeElement!, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(lastAction)

    fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
    expect(dialog).toBeInTheDocument()
  })

  it('sends an enabled session to AI and stores the validated score', async () => {
    const user = userEvent.setup()
    useAppStore.setState((state) => ({
      ...state,
      settings: { ...state.settings, anthropicApiKey: 'test-key', aiEnabled: true },
    }))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({
        content: [{
          type: 'text',
          text: JSON.stringify({
            points: 64,
            difficulty: 60,
            novelty: 55,
            focus: 70,
            performanceImpact: null,
            summary: 'Focused session.',
            strengths: ['Reviewed feedback'],
            improvements: ['Slow transitions'],
            nextSessionSuggestion: 'Repeat slowly.',
            milestoneEvidence: null,
          }),
        }],
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )))
    render(<LogSessionModal open skillId="guitar-1" onClose={() => undefined} />)

    await user.type(screen.getByLabelText('What did you do?'), 'Practiced chord changes and reviewed a recording')
    await user.click(screen.getByRole('button', { name: 'Save & score with AI' }))

    expect(await screen.findByText('AI score')).toBeInTheDocument()
    expect(useAppStore.getState().events.some((event) => event.type === 'practice_session' && event.ai?.points === 64)).toBe(true)
    vi.unstubAllGlobals()
  })

  it('deletes an existing session', async () => {
    const user = userEvent.setup()
    const session = {
      id: 'session-1',
      skillId: 'guitar-1',
      date: '2026-11-23',
      createdAt: '2026-11-23T12:00:00.000Z',
      type: 'practice_session' as const,
      minutes: 30,
      notes: 'Practice',
      performance: { performed: false },
      templateFields: {},
    }
    useAppStore.setState((state) => ({ ...state, events: [...state.events, session] }))
    render(<LogSessionModal open session={session} onClose={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Delete session' }))
    expect(useAppStore.getState().events.some((event) => event.id === 'session-1')).toBe(false)
  })
})
