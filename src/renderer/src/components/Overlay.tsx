import { useEffect } from 'react'
import { DEVLOG } from '../devlog'
import { VERSION, BUILD, BUILD_DATE } from '../version'

export type OverlayKind = 'about' | 'devlog'

interface Props {
  kind: OverlayKind
  onClose: () => void
}

// The tech stack shown in About (mirrors package.json).
const STACK: { name: string; detail: string }[] = [
  { name: 'Electron 33', detail: 'desktop shell (Chromium + Node)' },
  { name: 'TypeScript 5', detail: 'application + interpreter' },
  { name: 'React 18', detail: 'user interface' },
  { name: 'electron-vite / Vite 5', detail: 'build & dev server' },
  { name: 'electron-builder', detail: 'macOS packaging (.dmg / .zip)' },
  { name: 'Node.js 24', detail: 'toolchain & test runner' },
  { name: 'Interpreter', detail: 'hand-written tokenizer → parser → tree-walking evaluator (no dependencies)' },
  { name: 'TRS-80 emulator', detail: "Lawrence Kesteloot's MIT-licensed Z80 / Model I emulator — runs the real 1979 Dancing Demon" }
]

export default function Overlay({ kind, onClose }: Props): JSX.Element {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="overlay-backdrop" onClick={onClose}>
      <div className="overlay-panel" onClick={(e) => e.stopPropagation()}>
        <div className="overlay-head">
          <span className="overlay-title">
            {kind === 'about' ? 'About Retro80' : 'Development Log'}
          </span>
          <button className="overlay-close" onClick={onClose} title="Close (Esc)">
            ×
          </button>
        </div>
        <div className="overlay-body">
          {kind === 'about' ? <About /> : <DevLog />}
        </div>
      </div>
    </div>
  )
}

function About(): JSX.Element {
  return (
    <div className="about">
      <div className="about-name">Retro80</div>
      <div className="about-version">
        v{VERSION} · build {BUILD} · {BUILD_DATE}
      </div>
      <p className="about-desc">
        An ’80s home-computer playground for the desktop. Write and RUN vintage
        Microsoft / TRS-80–style BASIC in a retro terminal — or step into a real,
        emulated TRS-80 Model I and watch Leo Christopherson’s 1979 Dancing Demon
        tap-dance to “Ain’t She Sweet.”
      </p>

      <h3>Tech stack</h3>
      <table className="about-stack">
        <tbody>
          {STACK.map((s) => (
            <tr key={s.name}>
              <td className="about-stack-name">{s.name}</td>
              <td className="about-stack-detail">{s.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="about-foot">William Edstrom · MIT License</div>
    </div>
  )
}

function DevLog(): JSX.Element {
  return (
    <div className="devlog">
      {DEVLOG.map((e) => (
        <div className="devlog-entry" key={e.version}>
          <div className="devlog-entry-head">
            <span className="devlog-version">v{e.version}</span>
            <span className="devlog-title">{e.title}</span>
            <span className="devlog-date">{e.date}</span>
          </div>
          <ul className="devlog-notes">
            {e.notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
