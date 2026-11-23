import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SkillFormModal } from '../SkillFormModal'
import { useAppStore } from '../../../store/useAppStore'

describe('SkillFormModal', () => {
  beforeEach(() => {
    useAppStore.setState({
      schemaVersion: 1,
      settings: { theme: 'system', aiModel: 'claude-sonnet-5-5', aiEnabled: true, changeThresholdPp: 0.5 },
      skills: [],
      events: [],
      isLoading: false,
      storageError: null,
    })
  })

  it('adds a validated skill and closes', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<SkillFormModal open onClose={onClose} />)

    await user.type(screen.getByLabelText('Name'), 'Piano')
    fireEvent.submit(screen.getByRole('dialog').querySelector('form')!)

    expect(useAppStore.getState().skills).toHaveLength(1)
    expect(useAppStore.getState().skills[0].name).toBe('Piano')
    expect(onClose).toHaveBeenCalled()
  })

  it('shows validation when the name is missing', () => {
    render(<SkillFormModal open onClose={() => undefined} />)

    fireEvent.submit(screen.getByRole('dialog').querySelector('form')!)
    expect(screen.getByText('Enter a skill name.')).toBeInTheDocument()
  })

  it('requires a season goal when season mode is enabled', async () => {
    const user = userEvent.setup()
    render(<SkillFormModal open onClose={() => undefined} />)

    await user.type(screen.getByLabelText('Name'), 'Interview')
    await user.click(screen.getByLabelText(/Add an optional season plan/))
    fireEvent.submit(screen.getByRole('dialog').querySelector('form')!)

    expect(screen.getByText('Enter a season goal.')).toBeInTheDocument()
  })
})
