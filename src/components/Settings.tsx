import { useEffect, useState } from 'react'

interface MonitorAssignment {
  monitorIndex: number
  provider: 'none' | 'plane' | 'weather'
}

interface FullConfig {
  runOnStartup: boolean
  planeUpdateIntervalMinutes: number
  weatherUpdateIntervalMinutes: number
  plane: {
    apiKey: string
    workspaceSlug: string
    projectId: string
  }
  weather: {
    apiKey: string
    city: string
    corner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
    backgroundImagePath: string
  }
  monitorAssignments: MonitorAssignment[]
}

export function Settings() {
  const [config, setConfig] = useState<FullConfig | null>(null)
  const [monitors, setMonitors] = useState<number[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const [configRes, monitorsRes] = await Promise.all([
          fetch('/api/full-config'),
          fetch('/api/monitors')
        ])
        
        if (!configRes.ok || !monitorsRes.ok) throw new Error('Failed to load settings')
        
        const configData = await configRes.json()
        const monitorsData = await monitorsRes.json()
        
        setConfig(configData)
        setMonitors(monitorsData)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }
    load()

    const handleUnload = () => {
      // Notify backend that the settings window is closing so it can release the lock.
      // Use sendBeacon for reliability during unload.
      navigator.sendBeacon('/api/settings-closed')
    }
    window.addEventListener('beforeunload', handleUnload)
    return () => window.removeEventListener('beforeunload', handleUnload)
  }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!config) return

    setSaving(true)
    setMessage('')
    setError('')

    try {
      const res = await fetch('/api/full-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      })

      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || 'Failed to save settings')
      }

      setMessage('Settings saved successfully. This window will close shortly.')
      setTimeout(() => window.close(), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-8 text-slate-400">Loading settings...</div>
  if (!config) return <div className="p-8 text-red-400">{error || 'No config loaded'}</div>

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 p-8 font-sans select-none overflow-x-hidden overflow-y-auto">
      <div className="max-w-3xl mx-auto bg-slate-900/50 border border-slate-800 rounded-2xl p-8 backdrop-blur-sm shadow-2xl">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold bg-linear-to-r from-sky-400 to-blue-500 bg-clip-text text-transparent">
            Live Wallpaper Settings
          </h1>
          <button 
            onClick={() => window.close()}
            className="text-slate-500 hover:text-slate-300 transition-colors"
          >
            ✕
          </button>
        </div>

        {message && <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">{message}</div>}
        {error && <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl">{error}</div>}

        <form onSubmit={handleSave} className="space-y-8">
          <section className="space-y-4">
            <h2 className="text-xl font-semibold border-b border-slate-800 pb-2">Application</h2>
            <label className="flex items-center gap-3 cursor-pointer group">
              <input 
                type="checkbox" 
                checked={config.runOnStartup}
                onChange={e => setConfig({...config, runOnStartup: e.target.checked})}
                className="w-5 h-5 rounded border-slate-700 bg-slate-950 text-sky-500 focus:ring-sky-500 focus:ring-offset-slate-900"
              />
              <span className="text-slate-300 group-hover:text-white transition-colors">Run on system startup</span>
            </label>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold border-b border-slate-800 pb-2 text-sky-400">Plane Provider</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-400">Update Interval (min)</label>
                <input 
                  type="number" 
                  value={config.planeUpdateIntervalMinutes}
                  onChange={e => setConfig({...config, planeUpdateIntervalMinutes: parseInt(e.target.value)})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 focus:ring-2 focus:ring-sky-500 outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-400">API Key</label>
                <input 
                  type="password" 
                  value={config.plane.apiKey}
                  onChange={e => setConfig({...config, plane: {...config.plane, apiKey: e.target.value}})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 focus:ring-2 focus:ring-sky-500 outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-400">Workspace Slug</label>
                <input 
                  type="text" 
                  value={config.plane.workspaceSlug}
                  onChange={e => setConfig({...config, plane: {...config.plane, workspaceSlug: e.target.value}})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 focus:ring-2 focus:ring-sky-500 outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-400">Project ID</label>
                <input 
                  type="text" 
                  value={config.plane.projectId}
                  onChange={e => setConfig({...config, plane: {...config.plane, projectId: e.target.value}})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 focus:ring-2 focus:ring-sky-500 outline-none"
                />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold border-b border-slate-800 pb-2 text-amber-400">Weather Provider</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-400">Update Interval (min)</label>
                <input 
                  type="number" 
                  value={config.weatherUpdateIntervalMinutes}
                  onChange={e => setConfig({...config, weatherUpdateIntervalMinutes: parseInt(e.target.value)})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-400">OpenWeatherMap API Key</label>
                <input 
                  type="password" 
                  value={config.weather.apiKey}
                  onChange={e => setConfig({...config, weather: {...config.weather, apiKey: e.target.value}})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-400">City</label>
                <input 
                  type="text" 
                  value={config.weather.city}
                  onChange={e => setConfig({...config, weather: {...config.weather, city: e.target.value}})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-400">Widget Corner</label>
                <select 
                  value={config.weather.corner}
                  onChange={e => setConfig({...config, weather: {...config.weather, corner: e.target.value as any}})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 focus:ring-2 focus:ring-amber-500 outline-none"
                >
                  <option value="top-left">Top Left</option>
                  <option value="top-right">Top Right</option>
                  <option value="bottom-left">Bottom Left</option>
                  <option value="bottom-right">Bottom Right</option>
                </select>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold border-b border-slate-800 pb-2">Monitor Assignments</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {monitors.map(idx => {
                const assignment = config.monitorAssignments.find(a => a.monitorIndex === idx) || { monitorIndex: idx, provider: 'none' }
                return (
                  <div key={idx} className="bg-slate-950/50 border border-slate-800 p-4 rounded-xl space-y-2">
                    <div className="text-sm font-semibold text-slate-500 uppercase">Monitor {idx}</div>
                    <select 
                      value={assignment.provider}
                      onChange={e => {
                        const newAssignments = [...config.monitorAssignments]
                        const existingIdx = newAssignments.findIndex(a => a.monitorIndex === idx)
                        if (existingIdx >= 0) {
                          newAssignments[existingIdx] = { ...newAssignments[existingIdx], provider: e.target.value as any }
                        } else {
                          newAssignments.push({ monitorIndex: idx, provider: e.target.value as any })
                        }
                        setConfig({...config, monitorAssignments: newAssignments})
                      }}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 outline-none focus:border-slate-500"
                    >
                      <option value="none">None</option>
                      <option value="plane">Plane Board</option>
                      <option value="weather">Weather</option>
                    </select>
                  </div>
                )
              })}
            </div>
          </section>

          <div className="pt-4">
            <button 
              type="submit"
              disabled={saving}
              className="w-full bg-sky-600 hover:bg-sky-500 disabled:bg-slate-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-sky-900/20 active:scale-[0.98]"
            >
              {saving ? 'Saving...' : 'Save All Settings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
