import './index.css'
import { useEffect, useRef, useState } from 'react'
import { getRuntimeConfig, type RuntimeConfig } from './api/plane'
import { WeatherWallpaper } from './components/WeatherWallpaper'
import { KanbanBoard } from './components/KanbanBoard'

/**
 * Root application layout for a monitor-sized wallpaper viewport.
 */
function App() {
  const [runtimeConfig, setRuntimeConfig] = useState<RuntimeConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [providerDataReady, setProviderDataReady] = useState(false)
  const readyNotifiedRef = useRef(false)

  const handleProviderReady = () => {
    setProviderDataReady(true)
  }

  const notifyFrontendReady = (provider: RuntimeConfig['selectedProvider'], monitor: number) => {
    const params = new URLSearchParams({
      provider,
      monitor: String(monitor),
    })

    void fetch(`/api/frontend-ready?${params.toString()}`, {
      method: 'POST',
    }).catch(() => {
      // Startup signaling is best-effort; rendering should continue if unavailable.
    })
  }

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const config = await getRuntimeConfig()
        if (!cancelled) {
          setRuntimeConfig(config)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (loading || error || !runtimeConfig) {
      return
    }

    if (runtimeConfig.selectedProvider === 'none') {
      setProviderDataReady(true)
    }
  }, [loading, error, runtimeConfig])

  useEffect(() => {
    if (loading || !providerDataReady || !runtimeConfig || readyNotifiedRef.current) {
      return
    }

    readyNotifiedRef.current = true
    document.body.setAttribute('data-app-ready', 'true')

    notifyFrontendReady(runtimeConfig.selectedProvider, runtimeConfig.monitorIndex)
  }, [loading, providerDataReady, runtimeConfig])

  useEffect(() => {
    if (loading || !error || readyNotifiedRef.current) {
      return
    }

    readyNotifiedRef.current = true
    const params = new URLSearchParams(window.location.search)
    const providerParam = params.get('provider')
    const provider: RuntimeConfig['selectedProvider'] =
      providerParam === 'weather' || providerParam === 'plane' || providerParam === 'none'
        ? providerParam
        : 'plane'
    const monitor = Number.parseInt(params.get('monitor') ?? '0', 10)

    notifyFrontendReady(provider, Number.isFinite(monitor) && monitor >= 0 ? monitor : 0)
    document.body.setAttribute('data-app-ready', 'true')
  }, [loading, error])

  useEffect(() => {
    document.body.setAttribute('data-app-ready', 'false')
  }, [])

  const content = (() => {
    if (error) {
      return (
        <div style={{ width: '100vw', height: '100vh', display: 'grid', placeItems: 'center', color: '#ef4444' }}>
          {error}
        </div>
      )
    }

    if (runtimeConfig?.selectedProvider === 'weather') {
      return <WeatherWallpaper runtimeConfig={runtimeConfig} onInitialDataReady={handleProviderReady} />
    }

    if (runtimeConfig?.selectedProvider === 'none') {
      return (
        <div
          style={{
            width: '100vw',
            height: '100vh',
            background: 'linear-gradient(135deg, #0b1220, #111827)',
          }}
        />
      )
    }

    if (runtimeConfig?.selectedProvider === 'plane') {
      return (
        <div
          style={{
            display: 'flex',
            width: '100vw',
            height: '100vh',
            overflow: 'hidden',
            backgroundColor: 'var(--plane-bg)',
          }}
        >
          {/* Left spacer: reserved for desktop icons */}
          <div
            style={{
              width: 'clamp(120px, 10vw, 240px)',
              height: '100vh',
              flexShrink: 0,
            }}
            aria-hidden="true"
          />

          {/* Main board area */}
          <div style={{ flex: '1 1 0', minWidth: 0, height: '100vh' }}>
            <KanbanBoard onInitialDataReady={handleProviderReady} />
          </div>
        </div>
      )
    }

    return <div style={{ width: '100vw', height: '100vh', background: '#0f172a' }} />
  })()

  return content
}

export default App
