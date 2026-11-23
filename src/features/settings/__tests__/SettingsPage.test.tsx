import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SettingsPage } from '../SettingsPage'
import { useAppStore } from '../../../store/useAppStore'

describe('SettingsPage', () => {
  beforeEach(() => {
    useAppStore.setState({
      schemaVersion: 1,
      settings: { theme: 'system', aiModel: 'test-model', aiEnabled: true, changeThresholdPp: 0.5 },
      skills: [],
      events: [],
      isLoading: false,
      storageError: null,
    })
  })

  it('stores the key in app settings and tests the connection', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ content: [{ type: 'text', text: 'OK' }] }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )))
    render(<SettingsPage />)

    await user.type(screen.getByLabelText('API key'), 'test-key')
    expect(useAppStore.getState().settings.anthropicApiKey).toBe('test-key')
    await user.click(screen.getByRole('button', { name: 'Test API key' }))

    expect(await screen.findByText('Connection successful.')).toBeInTheDocument()
    vi.unstubAllGlobals()
  })
})
