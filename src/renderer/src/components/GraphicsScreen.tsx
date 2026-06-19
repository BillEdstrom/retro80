import { useEffect, useRef, useState } from 'react'

interface Props {
  // Live 1024-cell screen buffer (64x16 cells; graphics codes 128-191).
  cells: number[]
  // Bumps whenever the buffer changes, to trigger a redraw.
  version: number
  onClose: () => void
  // Animation speed tuner: percent applied to PAUSE (100 = as written).
  speedPct: number
  onSpeed: (delta: number) => void
  // Current animation frame rate (frames/sec), measured from PAUSE calls.
  getFps: () => number
}

const COLS = 64
// Internal canvas is 128 x 96: each graphics pixel is 1 wide x 2 tall, which
// reproduces the TRS-80's tall, non-square pixels and a 4:3 screen.
const CW = 128
const CH = 96

// TRS-80 graphics-cell bit layout: bit = (x & 1) + 2 * (y % 3), bits 0..5
// covering the 2x3 sub-grid (top-left, top-right, mid-left, mid-right, ...).
export default function GraphicsScreen({
  cells,
  version,
  onClose,
  speedPct,
  onSpeed,
  getFps
}: Props): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [fps, setFps] = useState(0)

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
      else if (e.key === '[' || e.key === ',') onSpeed(-25) // slower
      else if (e.key === ']' || e.key === '.') onSpeed(25) // faster
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, onSpeed])

  // Poll the measured frame rate a few times a second (no per-frame re-render).
  useEffect(() => {
    const id = setInterval(() => setFps(getFps()), 250)
    return () => clearInterval(id)
  }, [getFps])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, CW, CH)
    ctx.fillStyle = '#e8e8e0'
    for (let idx = 0; idx < cells.length; idx++) {
      const v = cells[idx]
      if (v < 128) continue // text/blank cells aren't drawn (graphics-only here)
      const col = idx % COLS
      const row = (idx / COLS) | 0
      for (let bit = 0; bit < 6; bit++) {
        if ((v & (1 << bit)) === 0) continue
        const px = col * 2 + (bit & 1)
        const py = row * 3 + (bit >> 1)
        ctx.fillRect(px, py * 2, 1, 2) // 1 wide, 2 tall — tall TRS-80 pixels
      }
    }
  }, [cells, version])

  return (
    <div className="gfx-overlay">
      <div className="gfx-bar">
        <span>GRAPHICS</span>
        <div className="gfx-tools">
          <span className="gfx-fps">{fps} FPS</span>
          <span className="gfx-speed">
            SPEED
            <button className="gfx-step" onClick={() => onSpeed(-25)} title="Slower ( [ )">
              –
            </button>
            <span className="gfx-speed-val">{speedPct}%</span>
            <button className="gfx-step" onClick={() => onSpeed(25)} title="Faster ( ] )">
              +
            </button>
          </span>
          <button className="gfx-close" onClick={onClose} title="Exit graphics (Esc)">
            ESC TO EXIT
          </button>
        </div>
      </div>
      <div className="gfx-screen">
        <canvas ref={canvasRef} width={CW} height={CH} className="gfx-canvas" />
      </div>
    </div>
  )
}
