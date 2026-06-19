import { useEffect, useState } from 'react'

// Floating toast that surfaces auto-update status. It listens for events the
// main process pushes over `window.api.updater.onEvent` and lets the user opt
// in to downloading and installing — nothing happens without a click.
type State =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'available'; version: string; notes?: string }
  | { kind: 'downloading'; percent: number }
  | { kind: 'downloaded'; version: string }
  | { kind: 'uptodate'; version: string }
  | { kind: 'error'; message: string }

interface UpdaterEvent {
  status: 'checking' | 'available' | 'none' | 'progress' | 'downloaded' | 'error'
  version?: string
  notes?: string
  percent?: number
  message?: string
  userInitiated?: boolean
}

export default function UpdateBanner(): JSX.Element | null {
  const [state, setState] = useState<State>({ kind: 'idle' })

  useEffect(() => {
    const off = window.api.updater.onEvent((raw) => {
      const e = raw as UpdaterEvent
      switch (e.status) {
        case 'checking':
          // Background launch checks are silent; only show when the user asked.
          setState(e.userInitiated ? { kind: 'checking' } : { kind: 'idle' })
          break
        case 'available':
          setState({ kind: 'available', version: e.version || '', notes: e.notes })
          break
        case 'progress':
          setState({ kind: 'downloading', percent: e.percent ?? 0 })
          break
        case 'downloaded':
          setState({ kind: 'downloaded', version: e.version || '' })
          break
        case 'none':
          setState(
            e.userInitiated ? { kind: 'uptodate', version: e.version || '' } : { kind: 'idle' }
          )
          break
        case 'error':
          // Only surface errors the user is waiting on; silent background-check
          // failures (offline, no release yet) just stay quiet.
          setState(
            e.userInitiated ? { kind: 'error', message: e.message || 'Update check failed' } : { kind: 'idle' }
          )
          break
      }
    })
    return off
  }, [])

  // Auto-dismiss the transient "up to date" message.
  useEffect(() => {
    if (state.kind === 'uptodate') {
      const t = setTimeout(() => setState({ kind: 'idle' }), 3500)
      return () => clearTimeout(t)
    }
    return undefined
  }, [state])

  if (state.kind === 'idle') return null

  const dismiss = (): void => setState({ kind: 'idle' })
  const download = (): void => {
    setState({ kind: 'downloading', percent: 0 })
    window.api.updater.download()
  }
  const install = (): void => {
    window.api.updater.install()
  }

  return (
    <div className="update-toast" role="status">
      {state.kind === 'checking' && <span className="update-msg">Checking for updates…</span>}

      {state.kind === 'uptodate' && (
        <span className="update-msg">You're up to date — v{state.version}</span>
      )}

      {state.kind === 'available' && (
        <>
          <span className="update-msg">
            <strong>Update available — v{state.version}</strong>
            {state.notes ? <span className="update-notes">{state.notes}</span> : null}
          </span>
          <span className="update-actions">
            <button className="btn btn-run btn-sm" onClick={download}>
              Download
            </button>
            <button className="btn btn-sm" onClick={dismiss}>
              Later
            </button>
          </span>
        </>
      )}

      {state.kind === 'downloading' && (
        <span className="update-msg">
          Downloading update… {state.percent}%
          <span className="update-bar">
            <span className="update-bar-fill" style={{ width: `${state.percent}%` }} />
          </span>
        </span>
      )}

      {state.kind === 'downloaded' && (
        <>
          <span className="update-msg">
            <strong>Update ready — v{state.version}</strong>
          </span>
          <span className="update-actions">
            <button className="btn btn-run btn-sm" onClick={install}>
              Restart &amp; Install
            </button>
            <button className="btn btn-sm" onClick={dismiss}>
              Later
            </button>
          </span>
        </>
      )}

      {state.kind === 'error' && (
        <>
          <span className="update-msg update-err">Update failed: {state.message}</span>
          <span className="update-actions">
            <button className="btn btn-sm" onClick={dismiss}>
              Dismiss
            </button>
          </span>
        </>
      )}
    </div>
  )
}
