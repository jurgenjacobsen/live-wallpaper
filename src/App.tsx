import './index.css'
import { useEffect, useState } from 'react'
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

  if (loading) {
    return <div style={{ width: '100vw', height: '100vh', display: 'grid', placeItems: 'center' }}>Loading…</div>
  }

  if (error) {
    return (
      <div style={{ width: '100vw', height: '100vh', display: 'grid', placeItems: 'center', color: '#ef4444' }}>
        {error}
      </div>
    )
  }

  if (runtimeConfig?.selectedProvider === 'weather') {
    return <WeatherWallpaper runtimeConfig={runtimeConfig} />
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
        <KanbanBoard />
      </div>
    </div>
  )
}

export default App
