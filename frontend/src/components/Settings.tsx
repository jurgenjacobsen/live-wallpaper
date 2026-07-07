import { useEffect, useState } from 'react'

interface WidgetPositionAssignment {
  widget: 'weather' | 'currency'
  corner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
}

interface MonitorAssignment {
  monitorIndex: number
  provider: 'none' | 'plane' | 'weather'
  widgets: ('weather' | 'currency')[]
  widgetPositions?: WidgetPositionAssignment[]
  stackWidgets: boolean
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
    enableMetar?: boolean
    enableTaf?: boolean
    airports?: string
  }
  currency: {
    baseCurrency: string
    targets: string[]
  }
  monitorAssignments: MonitorAssignment[]
  kanbanTheme: string
}

const DEFAULT_WIDGET_POSITIONS: WidgetPositionAssignment[] = [
  { widget: 'weather', corner: 'top-right' },
  { widget: 'currency', corner: 'top-right' }
]

export function Settings() {
  const [config, setConfig] = useState<FullConfig | null>(null)
  const [monitors, setMonitors] = useState<number[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [targetsInput, setTargetsInput] = useState('')
  const [selectedMonitor, setSelectedMonitor] = useState<number>(0)

  // Theme support: Light as default
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('theme')
    return saved === 'dark'
  })

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }, [darkMode])

  // Native Bindings & API Loader
  useEffect(() => {
    async function load() {
      try {
        let configData: FullConfig
        let monitorsData: number[]

        const app = (window as any).go?.main?.App
        if (app) {
          configData = await app.GetFullConfig()
          monitorsData = await app.GetMonitors()
        } else {
          // Standard browser dev fallback
          const [configRes, monitorsRes] = await Promise.all([
            fetch('/api/full-config'),
            fetch('/api/monitors')
          ])
          if (!configRes.ok || !monitorsRes.ok) throw new Error('Failed to load settings from server')
          configData = (await configRes.json()) as FullConfig
          monitorsData = await monitorsRes.json()
        }

        // Initialize missing positional parameters if loading legacy config
        configData.monitorAssignments = configData.monitorAssignments.map(assignment => {
          if (!assignment.widgetPositions) {
            assignment.widgetPositions = [
              { widget: 'weather', corner: configData.weather.corner || 'top-right' },
              { widget: 'currency', corner: configData.weather.corner || 'top-right' }
            ] as WidgetPositionAssignment[]
          }
          if (assignment.stackWidgets === undefined) {
            assignment.stackWidgets = true
          }
          return assignment
        })

        if (!configData.currency) {
          configData.currency = {
            baseCurrency: 'USD',
            targets: ['EUR', 'GBP', 'JPY']
          }
        } else if (!configData.currency.targets) {
          configData.currency.targets = ['EUR', 'GBP', 'JPY']
        }
        if (!configData.kanbanTheme) {
          configData.kanbanTheme = 'light'
        }

        setConfig(configData)
        setMonitors(monitorsData)
        setTargetsInput(configData.currency?.targets?.join(', ') || '')
        if (monitorsData.length > 0) {
          setSelectedMonitor(monitorsData[0])
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown initialization error')
      } finally {
        setLoading(false)
      }
    }
    load()

    const handleUnload = () => {
      void fetch('/api/settings-closed', { method: 'POST', keepalive: true })
    }
    window.addEventListener('beforeunload', handleUnload)
    return () => window.removeEventListener('beforeunload', handleUnload)
  }, [])

  // Load Base64 wallpaper image preview to bypass WebView2 local resource restrictions
  const [backgroundImagePreview, setBackgroundImagePreview] = useState<string>('')

  useEffect(() => {
    async function loadPreview() {
      if (!config?.weather?.backgroundImagePath) {
        setBackgroundImagePreview('')
        return
      }
      try {
        const app = (window as any).go?.main?.App
        if (app && typeof app.GetBackgroundImageBase64 === 'function') {
          const base64Url = await app.GetBackgroundImageBase64(config.weather.backgroundImagePath)
          setBackgroundImagePreview(base64Url)
        } else {
          // Fallback if testing in web browser
          setBackgroundImagePreview('/api/weather-background')
        }
      } catch (err) {
        console.error("Failed to load background preview:", err)
        setBackgroundImagePreview('')
      }
    }
    loadPreview()
  }, [config?.weather?.backgroundImagePath])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!config) return

    setSaving(true)
    setMessage('')
    setError('')

    try {
      const app = (window as any).go?.main?.App
      if (app) {
        await app.SaveFullConfig(config)
      } else {
        const res = await fetch('/api/full-config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(config)
        })
        if (!res.ok) {
          const text = await res.text()
          throw new Error(text || 'Failed to save settings')
        }
      }

      setMessage('Settings saved successfully. Wallpapers will refresh in the background.')
      setTimeout(() => {
        handleClose()
      }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save configurations')
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    const app = (window as any).go?.main?.App
    if (app && typeof app.CloseSettings === 'function') {
      app.CloseSettings()
    } else {
      window.close()
    }
  }

  // Upload Weather Background via Native Dialog
  const handleSelectBackground = async () => {
    if (!config) return
    try {
      const app = (window as any).go?.main?.App
      if (app && typeof app.SelectBackgroundImage === 'function') {
        const filePath = await app.SelectBackgroundImage()
        if (filePath) {
          setConfig({
            ...config,
            weather: { ...config.weather, backgroundImagePath: filePath }
          })
          setMessage('Background image loaded and scaled to fit monitor resolution successfully.')
          setTimeout(() => setMessage(''), 3000)
        }
      } else {
        setError('Native file selection is only available when running inside the desktop application.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to select image')
    }
  }

  if (loading) return <div className="p-8 text-slate-400 dark:text-slate-500 font-sans">Loading settings...</div>
  if (!config) return <div className="p-8 text-red-500 dark:text-red-400 font-sans">{error || 'No config loaded'}</div>

  // Active assignment helper
  const activeAssignment = config.monitorAssignments.find(a => a.monitorIndex === selectedMonitor) || {
    monitorIndex: selectedMonitor,
    provider: 'none',
    widgets: [],
    widgetPositions: DEFAULT_WIDGET_POSITIONS,
    stackWidgets: true
  }

  const updateActiveAssignment = (updated: Partial<MonitorAssignment>) => {
    const newAssignments = config.monitorAssignments.map(a => {
      if (a.monitorIndex === selectedMonitor) {
        return { ...a, ...updated } as MonitorAssignment
      }
      return a
    })

    // If monitor index isn't in assignments yet, add it
    if (!config.monitorAssignments.some(a => a.monitorIndex === selectedMonitor)) {
      newAssignments.push({
        monitorIndex: selectedMonitor,
        provider: 'none',
        widgets: [],
        widgetPositions: DEFAULT_WIDGET_POSITIONS,
        stackWidgets: true,
        ...updated
      } as MonitorAssignment)
    }

    setConfig({ ...config, monitorAssignments: newAssignments })
  }

  const getWidgetCorner = (widgetName: 'weather' | 'currency') => {
    const found = activeAssignment.widgetPositions?.find(p => p.widget === widgetName)
    return found ? found.corner : 'top-right'
  }

  const updateWidgetCorner = (widgetName: 'weather' | 'currency', corner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right') => {
    let positions = activeAssignment.widgetPositions ? [...activeAssignment.widgetPositions] : [...DEFAULT_WIDGET_POSITIONS]

    const idx = positions.findIndex(p => p.widget === widgetName)
    if (idx >= 0) {
      positions[idx] = { widget: widgetName, corner }
    } else {
      positions.push({ widget: widgetName, corner })
    }

    // Validation: if stacking is disabled, ensure no collision
    if (!activeAssignment.stackWidgets) {
      const otherWidget = widgetName === 'weather' ? 'currency' : 'weather'
      const otherIdx = positions.findIndex(p => p.widget === otherWidget)
      if (otherIdx >= 0 && positions[otherIdx].corner === corner) {
        // Move other widget to an alternative corner
        const corners: ('top-left' | 'top-right' | 'bottom-left' | 'bottom-right')[] = [
          'top-left', 'top-right', 'bottom-left', 'bottom-right'
        ]
        const emptyCorner = corners.find(c => c !== corner) || 'top-left'
        positions[otherIdx] = { widget: otherWidget, corner: emptyCorner }
      }
    }

    updateActiveAssignment({ widgetPositions: positions })
  }

  return (
    <div className="w-screen h-screen flex flex-col font-sans select-none overflow-hidden bg-slate-100 text-slate-800 dark:bg-slate-950 dark:text-slate-200">
      {/* Draggable Title Header (Adobe App Style) */}
      <div 
        className="w-full h-12 flex justify-between items-center px-4 bg-slate-200 dark:bg-slate-900 border-b border-slate-300 dark:border-slate-800 cursor-grab active:cursor-grabbing shrink-0"
        style={{ '--wails-draggable': 'drag' } as any}
      >
        <div className="flex items-center gap-3">
          <img 
            src="/icon.png" 
            alt="Live Wallpaper Logo" 
            className="w-6 h-6 rounded-md object-cover"
          />
          <span className="text-sm font-semibold tracking-wide">Live Wallpaper Settings</span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2" style={{ '--wails-draggable': 'no-drag' } as any}>
          {/* Light/Dark Toggle */}
          <button
            type="button"
            onClick={() => setDarkMode(!darkMode)}
            className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-800 transition-colors"
            title="Toggle theme"
          >
            {darkMode ? (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464a1 1 0 10-1.414-1.414l.707.707a1 1 0 001.414-1.414l-.707-.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 100 2h1z"/></svg>
            ) : (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"/></svg>
            )}
          </button>

          {/* Minimize Window */}
          <button
            type="button"
            onClick={() => {
              const runtime = (window as any).runtime;
              if (runtime && typeof runtime.WindowMinimise === 'function') {
                runtime.WindowMinimise();
              }
            }}
            className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-800 transition-colors"
            title="Minimize"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>

          {/* Maximize Window */}
          <button
            type="button"
            onClick={() => {
              const runtime = (window as any).runtime;
              if (runtime && typeof runtime.WindowToggleMaximise === 'function') {
                runtime.WindowToggleMaximise();
              }
            }}
            className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-800 transition-colors"
            title="Maximize"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <rect x="4" y="4" width="16" height="16" rx="1.5" />
            </svg>
          </button>

          {/* Close Window */}
          <button 
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-100 transition-colors font-bold text-sm leading-none"
            title="Close"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Main Form Content Scrollable */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {message && <div className="mb-4 p-3 text-xs bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-lg">{message}</div>}
        {error && <div className="mb-4 p-3 text-xs bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-lg">{error}</div>}

        <form onSubmit={handleSave} className="space-y-6">
          
          {/* 1. MONITOR PREVIEW WORKSPACE */}
          <section className="bg-slate-200/50 dark:bg-slate-900/40 border border-slate-300 dark:border-slate-800/80 rounded-xl p-4 space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Display Layout Preview</h2>
                <p className="text-xs text-slate-400 mt-0.5">Select a monitor below to customize its background and widget overlay positions</p>
              </div>
              <div className="flex gap-1.5">
                {monitors.map(idx => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedMonitor(idx)}
                    className={`px-3 py-1 text-xs font-semibold rounded-md border transition-all ${
                      selectedMonitor === idx
                        ? 'bg-sky-500 border-sky-500 text-white shadow-md'
                        : 'bg-white border-slate-300 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:hover:bg-slate-750'
                    }`}
                  >
                    Monitor {idx}
                  </button>
                ))}
              </div>
            </div>

            {/* Simulated Desktop Preview Box */}
            <div className="relative w-full aspect-video max-w-xl mx-auto rounded-lg border border-slate-400 dark:border-slate-800 shadow-lg overflow-hidden bg-slate-950">
              {/* Wallpaper Canvas Background */}
              {activeAssignment.provider === 'weather' && backgroundImagePreview ? (
                <div 
                  className="absolute inset-0 bg-cover bg-center transition-all opacity-85"
                  style={{ backgroundImage: `url(${backgroundImagePreview})` }}
                />
              ) : activeAssignment.provider === 'plane' ? (
                <div className="absolute inset-0 bg-slate-900 flex items-center justify-center opacity-40">
                  <div className="text-[10px] font-bold text-slate-500 tracking-widest uppercase">Plane Kanban Board</div>
                </div>
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-slate-900 to-slate-950 opacity-90" />
              )}

              {/* Desktop Icons Spacer */}
              {activeAssignment.provider === 'plane' && (
                <div className="absolute left-0 top-0 w-[15%] h-full border-r border-dashed border-slate-700/50 bg-slate-950/20 flex flex-col justify-start p-2 gap-1.5 z-10">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="w-5 h-5 rounded bg-slate-600/20 border border-slate-700/30" />
                  ))}
                </div>
              )}

              {/* 2x2 Corner Grid for Widgets */}
              <div className="absolute inset-0 p-4 grid grid-cols-2 grid-rows-2 gap-2 z-20 pointer-events-none">
                
                {/* Top-Left Corner */}
                <div className="flex flex-col justify-start items-start gap-1">
                  {activeAssignment.widgets.includes('weather') && getWidgetCorner('weather') === 'top-left' && (
                    <div className="px-2 py-1 text-[9px] font-bold bg-slate-950/80 border border-amber-500/30 text-amber-400 rounded shadow-md pointer-events-auto">Weather Widget</div>
                  )}
                  {activeAssignment.widgets.includes('currency') && getWidgetCorner('currency') === 'top-left' && (
                    <div className="px-2 py-1 text-[9px] font-bold bg-slate-950/80 border border-emerald-500/30 text-emerald-400 rounded shadow-md pointer-events-auto">Currency Widget</div>
                  )}
                </div>

                {/* Top-Right Corner */}
                <div className="flex flex-col justify-start items-end gap-1">
                  {activeAssignment.widgets.includes('weather') && getWidgetCorner('weather') === 'top-right' && (
                    <div className="px-2 py-1 text-[9px] font-bold bg-slate-950/80 border border-amber-500/30 text-amber-400 rounded shadow-md pointer-events-auto">Weather Widget</div>
                  )}
                  {activeAssignment.widgets.includes('currency') && getWidgetCorner('currency') === 'top-right' && (
                    <div className="px-2 py-1 text-[9px] font-bold bg-slate-950/80 border border-emerald-500/30 text-emerald-400 rounded shadow-md pointer-events-auto">Currency Widget</div>
                  )}
                </div>

                {/* Bottom-Left Corner */}
                <div className="flex flex-col justify-end items-start gap-1">
                  {activeAssignment.widgets.includes('weather') && getWidgetCorner('weather') === 'bottom-left' && (
                    <div className="px-2 py-1 text-[9px] font-bold bg-slate-950/80 border border-amber-500/30 text-amber-400 rounded shadow-md pointer-events-auto">Weather Widget</div>
                  )}
                  {activeAssignment.widgets.includes('currency') && getWidgetCorner('currency') === 'bottom-left' && (
                    <div className="px-2 py-1 text-[9px] font-bold bg-slate-950/80 border border-emerald-500/30 text-emerald-400 rounded shadow-md pointer-events-auto">Currency Widget</div>
                  )}
                </div>

                {/* Bottom-Right Corner */}
                <div className="flex flex-col justify-end items-end gap-1">
                  {activeAssignment.widgets.includes('weather') && getWidgetCorner('weather') === 'bottom-right' && (
                    <div className="px-2 py-1 text-[9px] font-bold bg-slate-950/80 border border-amber-500/30 text-amber-400 rounded shadow-md pointer-events-auto">Weather Widget</div>
                  )}
                  {activeAssignment.widgets.includes('currency') && getWidgetCorner('currency') === 'bottom-right' && (
                    <div className="px-2 py-1 text-[9px] font-bold bg-slate-950/80 border border-emerald-500/30 text-emerald-400 rounded shadow-md pointer-events-auto">Currency Widget</div>
                  )}
                </div>

              </div>

              {/* Monitor bezel base mockup */}
              <div className="absolute bottom-0 w-full h-1.5 bg-slate-800 dark:bg-slate-700 z-30" />
            </div>

            {/* Monitor Settings Controls */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase">Wallpaper Mode</label>
                <select
                  value={activeAssignment.provider}
                  onChange={e => {
                    const val = e.target.value as any
                    const update: Partial<MonitorAssignment> = { provider: val }
                    if (val === 'plane') {
                      update.widgets = []
                    }
                    updateActiveAssignment(update)
                  }}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg p-2 outline-none focus:border-sky-500 text-xs font-medium"
                >
                  <option value="plane">Plane.so Board View</option>
                  <option value="none">Solo Color Gradient</option>
                  <option value="weather">Custom Image</option>
                </select>
              </div>

              {/* Stacking Rule */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase">Widget Placement Layout</label>
                <select
                  value={activeAssignment.stackWidgets ? 'stack' : 'single'}
                  onChange={e => {
                    const isStack = e.target.value === 'stack'
                    const newUpdate: Partial<MonitorAssignment> = { stackWidgets: isStack }
                    
                    if (!isStack) {
                      // Validate corners; if they conflict, reset one
                      const positions = activeAssignment.widgetPositions ? [...activeAssignment.widgetPositions] : [...DEFAULT_WIDGET_POSITIONS]
                      if (positions[0]?.corner === positions[1]?.corner) {
                        positions[1].corner = 'top-left'
                        newUpdate.widgetPositions = positions
                      }
                    }
                    updateActiveAssignment(newUpdate)
                  }}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg p-2 outline-none focus:border-sky-500 text-xs font-medium"
                >
                  <option value="stack">Stack multiple widgets in the same corner</option>
                  <option value="single">Single widget per corner (prevent overlaps)</option>
                </select>
              </div>

              {/* Select widgets to display */}
              <div className={`md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-850 ${
                activeAssignment.provider === 'plane' ? 'opacity-40 pointer-events-none select-none' : ''
              }`}>
                {/* Weather widget configuration */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={activeAssignment.widgets.includes('weather')}
                      onChange={e => {
                        const next = e.target.checked
                          ? [...activeAssignment.widgets, 'weather' as const]
                          : activeAssignment.widgets.filter(w => w !== 'weather')
                        updateActiveAssignment({ widgets: next })
                      }}
                      className="w-4 h-4 rounded border-slate-300 bg-slate-50 text-sky-500 focus:ring-sky-500"
                    />
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Enable Weather Widget</span>
                  </label>
                  
                  {activeAssignment.widgets.includes('weather') && (
                    <div className="pl-6 space-y-1">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase">Weather Corner Position</label>
                      <select
                        value={getWidgetCorner('weather')}
                        onChange={e => updateWidgetCorner('weather', e.target.value as any)}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md p-1.5 text-xs outline-none"
                      >
                        <option value="top-left">Top Left</option>
                        <option value="top-right">Top Right</option>
                        <option value="bottom-left">Bottom Left</option>
                        <option value="bottom-right">Bottom Right</option>
                      </select>
                    </div>
                  )}
                </div>

                {/* Currency widget configuration */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={activeAssignment.widgets.includes('currency')}
                      onChange={e => {
                        const next = e.target.checked
                          ? [...activeAssignment.widgets, 'currency' as const]
                          : activeAssignment.widgets.filter(w => w !== 'currency')
                        updateActiveAssignment({ widgets: next })
                      }}
                      className="w-4 h-4 rounded border-slate-300 bg-slate-50 text-sky-500 focus:ring-sky-500"
                    />
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Enable Currency Widget</span>
                  </label>
                  
                  {activeAssignment.widgets.includes('currency') && (
                    <div className="pl-6 space-y-1">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase">Currency Corner Position</label>
                      <select
                        value={getWidgetCorner('currency')}
                        onChange={e => updateWidgetCorner('currency', e.target.value as any)}
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md p-1.5 text-xs outline-none"
                      >
                        <option value="top-left">Top Left</option>
                        <option value="top-right">Top Right</option>
                        <option value="bottom-left">Bottom Left</option>
                        <option value="bottom-right">Bottom Right</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* 2. GENERAL APPLICATION SETTINGS */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-xl p-4">
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-sky-500">System Integration</h3>
              <label className="flex items-center gap-3 cursor-pointer group pt-1">
                <input 
                  type="checkbox" 
                  checked={config.runOnStartup}
                  onChange={e => setConfig({...config, runOnStartup: e.target.checked})}
                  className="w-5 h-5 rounded border-slate-300 bg-slate-50 text-sky-500 focus:ring-sky-500"
                />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">Start app on Windows startup</span>
              </label>
            </div>

            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-500">Weather Wallpaper Background</h3>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={config.weather.backgroundImagePath}
                  readOnly
                  placeholder="No background image loaded"
                  className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs outline-none font-medium truncate"
                />
                <button
                  type="button"
                  onClick={handleSelectBackground}
                  className="px-3 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-xs font-semibold rounded-lg transition-all"
                >
                  Browse...
                </button>
              </div>
            </div>
          </section>

          {/* 3. PROVIDERS CONFIGURATION */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Plane.so Configuration */}
            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-xl p-4 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-sky-400 border-b border-slate-100 dark:border-slate-800 pb-1">Plane.so Settings</h3>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1 col-span-2">
                  <label className="text-[10px] font-semibold text-slate-400 uppercase">Workspace Slug</label>
                  <input 
                    type="text" 
                    value={config.plane.workspaceSlug}
                    onChange={e => setConfig({...config, plane: {...config.plane, workspaceSlug: e.target.value}})}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-1.5 text-xs outline-none focus:border-sky-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-400 uppercase">Project ID</label>
                  <input 
                    type="text" 
                    value={config.plane.projectId}
                    onChange={e => setConfig({...config, plane: {...config.plane, projectId: e.target.value}})}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-1.5 text-xs outline-none focus:border-sky-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-400 uppercase">Update Interval (min)</label>
                  <input 
                    type="number" 
                    value={config.planeUpdateIntervalMinutes}
                    onChange={e => setConfig({...config, planeUpdateIntervalMinutes: parseInt(e.target.value) || 30})}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-1.5 text-xs outline-none focus:border-sky-500"
                  />
                </div>
                <div className="space-y-1 col-span-2">
                  <label className="text-[10px] font-semibold text-slate-400 uppercase">API Key</label>
                  <input 
                    type="password" 
                    value={config.plane.apiKey}
                    onChange={e => setConfig({...config, plane: {...config.plane, apiKey: e.target.value}})}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-1.5 text-xs outline-none focus:border-sky-500"
                  />
                </div>
                <div className="space-y-1 col-span-2">
                  <label className="text-[10px] font-semibold text-slate-400 uppercase">Kanban Board Theme</label>
                  <select
                    value={config.kanbanTheme || 'light'}
                    onChange={e => setConfig({...config, kanbanTheme: e.target.value})}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-1.5 text-xs outline-none focus:border-sky-500 font-medium"
                  >
                    <option value="light">Light Theme</option>
                    <option value="dark-slate">Dark Slate Theme</option>
                  </select>
                </div>
              </div>
            </section>

            {/* Weather Configuration */}
            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-xl p-4 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-500 border-b border-slate-100 dark:border-slate-800 pb-1">Weather Settings</h3>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-400 uppercase">City</label>
                  <input 
                    type="text" 
                    value={config.weather.city}
                    onChange={e => setConfig({...config, weather: {...config.weather, city: e.target.value}})}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-1.5 text-xs outline-none focus:border-amber-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-400 uppercase">Update Interval (min)</label>
                  <input 
                    type="number" 
                    value={config.weatherUpdateIntervalMinutes}
                    onChange={e => setConfig({...config, weatherUpdateIntervalMinutes: parseInt(e.target.value) || 30})}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-1.5 text-xs outline-none focus:border-amber-500"
                  />
                </div>
                <div className="space-y-1 col-span-2">
                  <label className="text-[10px] font-semibold text-slate-400 uppercase">OpenWeatherMap API Key</label>
                  <input 
                    type="password" 
                    value={config.weather.apiKey}
                    onChange={e => setConfig({...config, weather: {...config.weather, apiKey: e.target.value}})}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-1.5 text-xs outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            </section>

            {/* Aviation Weather Settings */}
            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-xl p-4 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-violet-400 border-b border-slate-100 dark:border-slate-800 pb-1">Aviation Weather</h3>
              <div className="space-y-2">
                <div className="flex gap-4 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input 
                      type="checkbox" 
                      checked={config.weather.enableMetar || false}
                      onChange={e => setConfig({...config, weather: {...config.weather, enableMetar: e.target.checked}})}
                      className="w-4 h-4 rounded border-slate-300 bg-slate-50 text-violet-500 focus:ring-violet-500"
                    />
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 group-hover:text-slate-950 dark:group-hover:text-white transition-colors">METAR</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input 
                      type="checkbox" 
                      checked={config.weather.enableTaf || false}
                      onChange={e => setConfig({...config, weather: {...config.weather, enableTaf: e.target.checked}})}
                      className="w-4 h-4 rounded border-slate-300 bg-slate-50 text-violet-500 focus:ring-violet-500"
                    />
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 group-hover:text-slate-950 dark:group-hover:text-white transition-colors">TAF</span>
                  </label>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-400 uppercase">Airports (ICAO codes, comma separated)</label>
                  <input 
                    type="text" 
                    value={config.weather.airports || ''}
                    onChange={e => setConfig({...config, weather: {...config.weather, airports: e.target.value}})}
                    placeholder="e.g. LPPR, EGLL"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-1.5 text-xs outline-none focus:border-violet-500"
                  />
                </div>
              </div>
            </section>

            {/* Currency Market Settings */}
            <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-xl p-4 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 border-b border-slate-100 dark:border-slate-800 pb-1">Currency Market</h3>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-400 uppercase">Base Currency</label>
                  <input 
                    type="text" 
                    value={config.currency.baseCurrency}
                    onChange={e => setConfig({...config, currency: {...config.currency, baseCurrency: e.target.value.toUpperCase()}})}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-1.5 text-xs outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-400 uppercase">Target Currencies (comma separated)</label>
                  <input 
                    type="text" 
                    value={targetsInput}
                    onChange={e => {
                      setTargetsInput(e.target.value)
                      const targets = e.target.value.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
                      setConfig({...config, currency: {...config.currency, targets}})
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-1.5 text-xs outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </section>

          </div>

          <div className="pt-2">
            <button 
              type="submit"
              disabled={saving}
              className="w-full bg-sky-600 hover:bg-sky-500 disabled:bg-slate-400 text-white font-bold py-2.5 rounded-xl transition-all shadow-md hover:shadow-lg active:scale-[0.99] text-xs font-sans uppercase tracking-wider"
            >
              {saving ? 'Saving...' : 'Save Rework Settings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
