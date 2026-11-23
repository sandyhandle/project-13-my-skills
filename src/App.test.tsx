import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import App from './App'
import { defaultAppData } from './domain/defaults'
import { useAppStore } from './store/useAppStore'

describe('app shell', () => {
  beforeEach(() => {
    localStorage.clear()
    useAppStore.setState({ ...defaultAppData, isLoading: true, storageError: null })
  })

  it('renders the dashboard tagline and navigation', async () => {
    render(<App />)

    expect(await screen.findByText(/Habits measure whether I showed up/)).toBeInTheDocument()
  })

  it('toggles the theme', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: /Switch to dark theme|Switch to light theme/i }))

    expect(document.documentElement.dataset.theme).toBeTruthy()
  })

  it('opens the session form with the L shortcut', async () => {
    const user = userEvent.setup()
    render(<App />)

    await screen.findByText(/Habits measure whether I showed up/)
    await user.keyboard('l')

    expect(await screen.findByRole('dialog', { name: 'Log practice session' })).toBeInTheDocument()
  })

  it('offers an add-skill action when the saved tracker is empty', async () => {
    localStorage.setItem('skill-progress-tracker:v1', JSON.stringify(defaultAppData))
    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: 'Add a skill' }))

    expect(await screen.findByRole('dialog', { name: 'Add skill' })).toBeInTheDocument()
  })
})
