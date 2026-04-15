import './index.css'
import { KanbanBoard } from './components/KanbanBoard'

/**
 * Root application layout for the 1920×1080 live wallpaper.
 *
 * Layout:
 *   [Spacer – 200 px wide, reserved for desktop icons on the left]
 *   [KanbanBoard – fills the remaining 1720 px]
 */
function App() {
  return (
    <div
      style={{
        display: 'flex',
        width: '1920px',
        height: '1080px',
        overflow: 'hidden',
        backgroundColor: 'var(--plane-bg)',
      }}
    >
      {/* Left spacer: reserved for desktop icons */}
      <div
        style={{
          width: '200px',
          height: '1080px',
          flexShrink: 0,
        }}
        aria-hidden="true"
      />

      {/* Main board area */}
      <div style={{ flex: '1 1 0', minWidth: 0, height: '1080px' }}>
        <KanbanBoard />
      </div>
    </div>
  )
}

export default App
