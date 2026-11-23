import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { testAnthropicKey } from '../../domain/ai/client'
import { useAppStore } from '../../store/useAppStore'

export function SettingsPage() {
  const settings = useAppStore((state) => state.settings)
  const updateSettings = useAppStore((state) => state.updateSettings)
  const loadDemoHistory = useAppStore((state) => state.loadDemoHistory)
  const [apiKey, setApiKey] = useState(settings.anthropicApiKey ?? '')
  const [showKey, setShowKey] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState('')

  const saveKey = (value: string) => {
    setApiKey(value)
    updateSettings({ anthropicApiKey: value || undefined })
  }

  const testKey = async () => {
    setTesting(true)
    setTestResult('')
    try {
      await testAnthropicKey(apiKey, settings.aiModel)
      setTestResult('Connection successful.')
    } catch (error) {
      setTestResult(error instanceof Error ? error.message : 'Connection test failed.')
    } finally {
      setTesting(false)
    }
  }

  return (
    <main className="settings-page">
      <header><span className="eyebrow">Preferences</span><h1>Settings</h1></header>
      <section className="card settings-section">
        <span className="eyebrow">AI scoring</span>
        <h2>Anthropic API</h2>
        <p className="settings-notice">Your notes and API key are sent from this browser directly to Anthropic. The key is stored only in this browser's localStorage. Use only on your personal device.</p>
        <label>API key
          <div className="key-entry">
            <input type={showKey ? 'text' : 'password'} autoComplete="off" value={apiKey} onChange={(event) => saveKey(event.target.value)} placeholder="sk-ant-..." />
            <button type="button" className="icon-button" aria-label={showKey ? 'Hide API key' : 'Show API key'} onClick={() => setShowKey(!showKey)}>{showKey ? <EyeOff size={17} /> : <Eye size={17} />}</button>
          </div>
        </label>
        <label>AI model
          <input value={settings.aiModel} onChange={(event) => updateSettings({ aiModel: event.target.value })} />
        </label>
        <label className="checkbox-label"><input type="checkbox" checked={settings.aiEnabled} onChange={(event) => updateSettings({ aiEnabled: event.target.checked })} /> Enable AI scoring</label>
        <button type="button" className="primary-button" disabled={testing || !apiKey} onClick={() => void testKey()}>{testing ? 'Testing…' : 'Test API key'}</button>
        {testResult && <p role="status" className={testResult === 'Connection successful.' ? 'settings-success' : 'form-error'}>{testResult}</p>}
      </section>

      <section className="card settings-section">
        <span className="eyebrow">Dashboard</span>
        <h2>Change threshold</h2>
        <label>Improving / declining threshold (pp)
          <input type="number" min={0} step={0.1} value={settings.changeThresholdPp} onChange={(event) => updateSettings({ changeThresholdPp: Math.max(0, Number(event.target.value)) })} />
        </label>
      </section>

      <section className="card settings-section">
        <span className="eyebrow">Demo</span>
        <h2>Explore sample history</h2>
        <p>Generate synthetic practice events across the last year. Demo data is labelled in the dashboard.</p>
        <button type="button" className="secondary-button" onClick={loadDemoHistory}>Load demo history</button>
      </section>
    </main>
  )
}
