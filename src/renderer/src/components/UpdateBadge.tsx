import { useEffect, useState } from 'react'

// Persistent update indicator in the sidebar, modeled on Claude Desktop's
// bottom-left "update available / restart to update" pill. Unlike the transient
// UpdateBanner toast (which can be dismissed), this stays put as long as an
// update is pending, so the user can act on it whenever they like.
type State =
  | { kind: 'idle' }
  | { kind: 'available'; version: string }
  | { kind: 'downloading'; percent: number }
  | { kind: 'downloaded'; version: string }

interface UpdaterEvent {
  status: 'checking' | 'available' | 'none' | 'progress' | 'downloaded' | 'error'
  version?: string
  percent?: number
}

export default function UpdateBadge(): JSX.Element | null {
  const [state, setState] = useState<State>({ kind: 'idle' })

  useEffect(() => {
    const off = window.api.updater.onEvent((raw) => {
      const e = raw as UpdaterEvent
      switch (e.status) {
        case 'available':
          setState({ kind: 'available', version: e.version || '' })
          break
        case 'progress':
          setState({ kind: 'downloading', percent: e.percent ?? 0 })
          break
        case 'downloaded':
          setState({ kind: 'downloaded', version: e.version || '' })
          break
        // 'checking' / 'none' / 'error' don't change the persistent badge —
        // it only reflects a genuinely pending update.
      }
    })
    return off
  }, [])

  if (state.kind === 'idle') return null

  if (state.kind === 'downloading') {
    return (
      <div className="update-badge update-badge-busy" title={`Downloading update… ${state.percent}%`}>
        <span className="update-badge-spinner" />
        <span className="update-badge-label">Downloading… {state.percent}%</span>
      </div>
    )
  }

  if (state.kind === 'downloaded') {
    return (
      <button
        className="update-badge update-badge-ready"
        onClick={() => window.api.updater.install()}
        title={`Restart to update to v${state.version}`}
      >
        <span className="update-badge-icon">↻</span>
        <span className="update-badge-label">Restart to update</span>
      </button>
    )
  }

  // available — click to start the download
  return (
    <button
      className="update-badge update-badge-avail"
      onClick={() => {
        setState({ kind: 'downloading', percent: 0 })
        window.api.updater.download()
      }}
      title={`Download update v${state.version}`}
    >
      <span className="update-badge-dot" />
      <span className="update-badge-label">Update available</span>
    </button>
  )
}
