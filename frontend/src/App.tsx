import './index.css'
import { useEffect, useRef, useState } from 'react'
import { getRuntimeConfig, type RuntimeConfig } from './api/plane'
import { WidgetWallpaper } from './components/WidgetWallpaper'
import { KanbanBoard } from './components/KanbanBoard'
import { Settings } from './components/Settings'

// Standard splash message log simulation
const SPLASH_LOGS = [
  'Initializing core modules...',
  'Connecting to OS display services...',
  'Detecting multi-monitor layouts...',
  'Loading configuration variables...',
  'Connecting to Frankfurt currency server...',
  'Querying local OpenWeatherMap forecast data...',
  'Composing monitor wallpaper viewports...',
  'Ready.'
];

function App() {
  const [runtimeConfig, setRuntimeConfig] = useState<RuntimeConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [providerDataReady, setProviderDataReady] = useState(false)
  const readyNotifiedRef = useRef(false)

  // Wails-specific states
  const [showSplash, setShowSplash] = useState(true)
  const [splashFade, setSplashFade] = useState(false)
  const [splashLogIndex, setSplashLogIndex] = useState(0)

  const params = new URLSearchParams(window.location.search)
  // If 'provider' or 'monitor' is present in URL, we are rendering a wallpaper image to be captured
  const isWallpaperCaptureMode = params.has('provider') || params.has('monitor')

  const handleProviderReady = () => {
    setProviderDataReady(true)
  }

  const notifyFrontendReady = (providers: RuntimeConfig['providers'], monitor: number) => {
    const primaryProvider = providers.find(p => p !== 'none') || 'none'
    const queryParams = new URLSearchParams({
      provider: primaryProvider,
      monitor: String(monitor),
    })

    void fetch(`/api/frontend-ready?${queryParams.toString()}`, {
      method: 'POST',
    }).catch(() => {
      // Best-effort callback
    })
  }

  // Wails Init Complete Listener
  useEffect(() => {
    if (isWallpaperCaptureMode) {
      setShowSplash(false);
      return;
    }

    // Step through splash log items
    const logInterval = setInterval(() => {
      setSplashLogIndex((prev) => (prev < SPLASH_LOGS.length - 1 ? prev + 1 : prev));
    }, 350);

    const handleInitComplete = () => {
      setSplashLogIndex(SPLASH_LOGS.length - 1);
      setTimeout(() => {
        setSplashFade(true);
        setTimeout(() => {
          setShowSplash(false);
        }, 800); // fade duration
      }, 300);
    };

    const registerWailsListener = (): boolean => {
      const runtime = (window as any).runtime;
      if (runtime && typeof runtime.EventsOn === 'function') {
        runtime.EventsOn('init-complete', () => {
          handleInitComplete();
        });
        return true;
      }
      return false;
    };

    // Try immediately
    const registered = registerWailsListener();
    
    if (!registered) {
      // Listen for delayed wails injection
      const handleWailsBind = () => {
        registerWailsListener();
      };
      window.addEventListener('wailsbind', handleWailsBind);

      // Web fallback timer
      const fallbackTimeout = setTimeout(() => {
        window.removeEventListener('wailsbind', handleWailsBind);
        handleInitComplete();
      }, 3500);

      return () => {
        clearInterval(logInterval);
        window.removeEventListener('wailsbind', handleWailsBind);
        clearTimeout(fallbackTimeout);
      };
    }

    return () => {
      clearInterval(logInterval);
    };
  }, [isWallpaperCaptureMode]);

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

    if (runtimeConfig.providers.every(p => p === 'none')) {
      setProviderDataReady(true)
    }
  }, [loading, error, runtimeConfig])

  useEffect(() => {
    if (loading || !providerDataReady || !runtimeConfig || readyNotifiedRef.current) {
      return
    }

    readyNotifiedRef.current = true
    document.body.setAttribute('data-app-ready', 'true')

    notifyFrontendReady(runtimeConfig.providers, runtimeConfig.monitorIndex)
  }, [loading, providerDataReady, runtimeConfig])

  useEffect(() => {
    if (loading || !error || readyNotifiedRef.current) {
      return
    }

    readyNotifiedRef.current = true
    const queryParams = new URLSearchParams(window.location.search)
    const providerParam = queryParams.get('provider')
    const provider: RuntimeConfig['providers'][0] =
      providerParam === 'weather' || providerParam === 'plane' || providerParam === 'none' || providerParam === 'currency'
        ? (providerParam as any)
        : 'plane'
    const monitor = Number.parseInt(queryParams.get('monitor') ?? '0', 10)

    notifyFrontendReady([provider], Number.isFinite(monitor) && monitor >= 0 ? monitor : 0)
    document.body.setAttribute('data-app-ready', 'true')
  }, [loading, error])

  useEffect(() => {
    document.body.setAttribute('data-mode', isWallpaperCaptureMode ? 'wallpaper' : 'settings')
  }, [isWallpaperCaptureMode])

  useEffect(() => {
    document.body.setAttribute('data-app-ready', 'false')
  }, [])

  // 1. Render Adobe-Style Splash Screen
  if (showSplash) {
    return (
      <div
        className={`w-screen h-screen flex flex-col justify-between p-8 select-none font-sans overflow-hidden transition-opacity duration-700 ease-in-out ${
          splashFade ? 'opacity-0' : 'opacity-100'
        }`}
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0b0f19 100%)',
          border: '1px solid #334155',
          borderRadius: '16px',
        }}
      >
        <div className="flex justify-between items-start">
          <div className="flex gap-4 items-center">
            {/* Logo Mark */}
            <img 
              src="/icon.png" 
              alt="Live Wallpaper" 
              className="w-16 h-16 rounded-lg object-cover shadow-lg shadow-sky-500/20"
            />
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white leading-none">Live Wallpaper</h1>
              <p className="text-xs text-sky-400 font-semibold mt-1">Version 2.0.0</p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest animate-pulse">
              System Loader
            </p>
            <p className="text-sm font-medium text-slate-200 h-5 overflow-hidden">
              {SPLASH_LOGS[splashLogIndex]}
            </p>
          </div>
          {/* Progress Bar */}
          <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-linear-to-r from-sky-400 to-blue-500 transition-all duration-300 ease-out rounded-full"
              style={{
                width: `${((splashLogIndex + 1) / SPLASH_LOGS.length) * 100}%`
              }}
            />
          </div>
        </div>

        <div className="flex justify-between items-center text-[10px] text-slate-500 font-medium">
          <p>© 2026 Live Wallpaper. All Rights Reserved.</p>
          <p>Created by Jürgen Jacobsen</p>
        </div>
      </div>
    );
  }

  // 2. Render Settings Native Window View
  if (!isWallpaperCaptureMode) {
    return <Settings />
  }

  // 3. Render Capture Wallpaper Layouts
  if (error) {
    return (
      <div style={{ width: '100vw', height: '100vh', display: 'grid', placeItems: 'center', color: '#ef4444' }}>
        {error}
      </div>
    )
  }

  if (!runtimeConfig) return null

  if (runtimeConfig.providers.includes('plane')) {
    const isDarkSlate = runtimeConfig.kanbanTheme === 'dark-slate';
    const customThemeStyles = isDarkSlate ? {
      backgroundColor: "#141515",
      color: "#E4E6E7",
      "--plane-bg": "#141515",
      "--plane-surface": "#181A1B",
      "--plane-surface-2": "#1D1F20",
      "--plane-text": "#E4E6E7",
      "--plane-text-muted": "rgba(228, 230, 231, 0.6)",
      "--plane-text-secondary": "rgba(228, 230, 231, 0.8)",
      "--plane-border": "rgba(228, 230, 231, 0.12)",
    } as any : {};

    return (
      <div
        style={{
          display: 'flex',
          width: '100vw',
          height: '100vh',
          overflow: 'hidden',
          backgroundColor: 'var(--plane-bg)',
          ...customThemeStyles
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
          <KanbanBoard runtimeConfig={runtimeConfig} onInitialDataReady={handleProviderReady} />
        </div>
      </div>
    )
  }

  if (runtimeConfig.providers.includes('weather') || runtimeConfig.providers.includes('currency')) {
    return <WidgetWallpaper runtimeConfig={runtimeConfig} onInitialDataReady={handleProviderReady} />
  }

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

export default App
