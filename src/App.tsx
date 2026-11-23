import { lazy, Suspense, useEffect, useState } from 'react'
import { Moon, Plus, Sun } from 'lucide-react'
import { BrowserRouter, NavLink, Navigate, Route, Routes } from 'react-router-dom'
import type { PracticeSessionEvent } from './domain/types'
import { ErrorBoundary } from './components/ui/ErrorBoundary'
import { ToastRegion } from './components/ui/ToastRegion'
import { useAppStore } from './store/useAppStore'

const DashboardPage = lazy(() => import('./features/dashboard/DashboardPage').then((module) => ({ default: module.DashboardPage })))
const SkillFormModal = lazy(() => import('./features/skill-form/SkillFormModal').then((module) => ({ default: module.SkillFormModal })))
const LogSessionModal = lazy(() => import('./features/session/LogSessionModal').then((module) => ({ default: module.LogSessionModal })))
const SkillDetailPage = lazy(() => import('./features/skill-detail/SkillDetailPage').then((module) => ({ default: module.SkillDetailPage })))
const SettingsPage = lazy(() => import('./features/settings/SettingsPage').then((module) => ({ default: module.SettingsPage })))
const ExportPage = lazy(() => import('./features/export/ExportPage').then((module) => ({ default: module.ExportPage })))

const App = () => {
  const isLoading = useAppStore((state) => state.isLoading)
  const storageError = useAppStore((state) => state.storageError)
  const hydrate = useAppStore((state) => state.hydrate)
  const [skillFormOpen, setSkillFormOpen] = useState(false)
  const [sessionFormOpen, setSessionFormOpen] = useState(false)
  const [sessionSkillId, setSessionSkillId] = useState<string | undefined>()
  const [editingSession, setEditingSession] = useState<PracticeSessionEvent | undefined>()

  useEffect(() => {
    if (isLoading) void hydrate()
  }, [hydrate, isLoading])
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme')
    if (saved === 'light' || saved === 'dark') return saved
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('theme', theme)
  }, [theme])

  useEffect(() => {
    const openLog = (event: Event) => {
      const custom = event as CustomEvent<{ skillId?: string }>
      setEditingSession(undefined)
      setSessionSkillId(custom.detail?.skillId)
      setSessionFormOpen(true)
    }
    const openEdit = (event: Event) => {
      const custom = event as CustomEvent<{ session: PracticeSessionEvent }>
      setEditingSession(custom.detail.session)
      setSessionSkillId(custom.detail.session.skillId)
      setSessionFormOpen(true)
    }
    const openAddSkill = () => setSkillFormOpen(true)
    window.addEventListener('open-log-session', openLog)
    window.addEventListener('open-edit-session', openEdit)
    window.addEventListener('open-add-skill', openAddSkill)
    return () => {
      window.removeEventListener('open-log-session', openLog)
      window.removeEventListener('open-edit-session', openEdit)
      window.removeEventListener('open-add-skill', openAddSkill)
    }
  }, [])

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'l' || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
      if (event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]')) return
      event.preventDefault()
      setEditingSession(undefined)
      setSessionSkillId(undefined)
      setSessionFormOpen(true)
    }
    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [])

  return (
    <BrowserRouter>
      <ErrorBoundary>
        <div className="app-shell">
        <header className="topbar">
          <NavLink to="/" className="brand" aria-label="Skill Progress Tracker dashboard">
            <span className="brand-mark">SP</span>
            <span>Skill Progress</span>
          </NavLink>
          <nav className="desktop-nav" aria-label="Primary navigation">
            <NavLink to="/">Dashboard</NavLink>
            <NavLink to="/export">Export</NavLink>
            <NavLink to="/settings">Settings</NavLink>
          </nav>
          <div className="topbar-actions">
            <button className="icon-button" type="button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button className="primary-button" type="button" title="Keyboard shortcut: L" onClick={() => { setSessionSkillId(undefined); setSessionFormOpen(true) }}><Plus size={18} /> Log session</button>
            <button className="secondary-button" type="button" onClick={() => setSkillFormOpen(true)}><Plus size={18} /> Add skill</button>
          </div>
        </header>

        {storageError && <aside className="storage-error" role="alert"><span>Could not load saved data: {storageError}</span><button type="button" className="secondary-button" onClick={() => void hydrate()}>Retry</button></aside>}
          <Suspense fallback={<main className="page"><section className="empty-card" role="status">Loading page…</section></main>}>
            {isLoading ? (
              <main className="page"><section className="empty-card" role="status">Loading saved data…</section></main>
            ) : storageError ? (
              <main className="page"><section className="empty-card"><h1>Saved data is unavailable</h1><p>Retry loading your local data before continuing.</p></section></main>
            ) : (
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/skills/:id" element={<SkillDetailPage />} />
                <Route path="/export" element={<ExportPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            )}
          </Suspense>

        <nav className="bottom-nav" aria-label="Mobile navigation">
          <NavLink to="/">Dashboard</NavLink>
          <button type="button" onClick={() => { setSessionSkillId(undefined); setSessionFormOpen(true) }}>Log</button>
          <NavLink to="/export">Export</NavLink>
          <NavLink to="/settings">Settings</NavLink>
        </nav>
        <Suspense fallback={null}>
          <SkillFormModal open={skillFormOpen} onClose={() => setSkillFormOpen(false)} />
          <LogSessionModal open={sessionFormOpen} skillId={sessionSkillId} session={editingSession} onClose={() => { setSessionFormOpen(false); setEditingSession(undefined) }} />
        </Suspense>
        <ToastRegion />
        </div>
      </ErrorBoundary>
    </BrowserRouter>
  )
}

export default App
