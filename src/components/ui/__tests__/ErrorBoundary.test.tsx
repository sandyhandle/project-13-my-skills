import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ErrorBoundary } from '../ErrorBoundary'

const BrokenPage = () => {
  throw new Error('test render failure')
}

describe('ErrorBoundary', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows a recovery screen when a child throws during render', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    render(<ErrorBoundary><BrokenPage /></ErrorBoundary>)

    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reload app' })).toBeInTheDocument()
    expect(console.error).toHaveBeenCalled()
  })
})
