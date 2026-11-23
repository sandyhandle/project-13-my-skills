import { Component, type ErrorInfo, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Application render error:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <main className="page">
          <section className="empty-card" role="alert">
            <h1>Something went wrong</h1>
            <p>The page could not be displayed. Your saved data has not been changed.</p>
            <button type="button" className="primary-button" onClick={() => window.location.reload()}>Reload app</button>
          </section>
        </main>
      )
    }
    return this.props.children
  }
}
