import type { View, ProgramEntry, ProgramSource } from '../App'
import { VERSION_LABEL } from '../version'

interface Props {
  view: View
  onView: (v: View) => void
  programs: ProgramEntry[]
  currentName: string | null
  currentSource: ProgramSource | null
  onNew: () => void
  onOpen: (name: string, source: ProgramSource) => void
  onDelete: (name: string, source: ProgramSource) => void
  lowercaseMod: boolean
  onToggleLowercase: () => void
}

// A real emulated TRS-80 Model I: bare Level II BASIC, or a genuine preserved
// program loaded from cassette.
const TRS80_NAV: { id: View; label: string; icon: string }[] = [
  { id: 'trs80', label: 'Level II BASIC', icon: '80' },
  { id: 'demon', label: 'Dancing Demon', icon: '♪' },
  { id: 'dogstar', label: 'Dog Star Adv.', icon: '✦' },
  { id: 'pyramid', label: 'Pyramid 2000', icon: '▲' },
  { id: 'haunted', label: 'Haunted House', icon: '⌂' }
]

export default function Sidebar({
  view,
  onView,
  programs,
  currentName,
  currentSource,
  onNew,
  onOpen,
  onDelete,
  lowercaseMod,
  onToggleLowercase
}: Props): JSX.Element {
  const userPrograms = programs.filter((p) => p.source === 'user')
  const factoryPrograms = programs.filter((p) => p.source === 'factory')
  // The BASIC IDE spans these views (Console / Editor / Quick Start / Syntax).
  const isBasic = view === 'console' || view === 'editor' || view === 'quickstart' || view === 'syntax'
  const isActive = (p: ProgramEntry): boolean =>
    currentName === p.name && currentSource === p.source

  return (
    <aside className="sidebar">
      <div className="sidebar-drag" />
      <div className="nav-group-label nav-group-first">LANGUAGES</div>
      <nav className="nav">
        <button
          className={'nav-item' + (isBasic ? ' active' : '')}
          onClick={() => onView('console')}
          title="Retro BASIC — vintage Level II BASIC: Console + Editor in one IDE"
        >
          <span className="nav-icon">80</span>
          Retro BASIC
        </button>
        <button
          className={'nav-item' + (view === 'python' ? ' active' : '')}
          onClick={() => onView('python')}
          title="RetroPython — learn real Python, vintage-styled"
        >
          <span className="nav-icon">py</span>
          RetroPython
        </button>
      </nav>

      <div className="nav-group-label">RETRO80 STUDIO</div>
      <nav className="nav">
        <button
          className={'nav-item' + (view === 'demonstudio' ? ' active' : '')}
          onClick={() => onView('demonstudio')}
          title="Our remixable native reproduction of the Dancing Demon"
        >
          <span className="nav-icon">☄</span>
          Dancing Demon
        </button>
      </nav>

      <div className="nav-group-label">TRS-80 MODEL I</div>
      <nav className="nav">
        {TRS80_NAV.map((n) => (
          <button
            key={n.id}
            className={'nav-item' + (view === n.id ? ' active' : '')}
            onClick={() => onView(n.id)}
          >
            <span className="nav-icon">{n.icon}</span>
            {n.label}
          </button>
        ))}
      </nav>

      <div className="sidebar-scroll">
        <div className="sidebar-section">
          <div className="sidebar-head">
            <span>MY PROGRAMS</span>
            <button className="icon-btn" title="New program" onClick={onNew}>
              +
            </button>
          </div>
          <ul className="program-list">
            {userPrograms.length === 0 && (
              <li className="program-empty">None yet — save a program to add one</li>
            )}
            {userPrograms.map((p) => (
              <li key={'u:' + p.name} className={'program-item' + (isActive(p) ? ' active' : '')}>
                <button
                  className="program-open"
                  onClick={() => onOpen(p.name, 'user')}
                  title="Open"
                >
                  <span className="program-dot">▸</span>
                  {p.name}
                </button>
                <button
                  className="program-del"
                  title="Delete"
                  onClick={() => {
                    if (confirm(`Delete program "${p.name}"?`)) onDelete(p.name, 'user')
                  }}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="sidebar-section">
          <div className="sidebar-head">
            <span>SAMPLES</span>
            <span className="sidebar-tag" title="Read-only factory presets — edits save as your own copy">
              factory
            </span>
          </div>
          <ul className="program-list">
            {factoryPrograms.map((p) => (
              <li key={'f:' + p.name} className={'program-item' + (isActive(p) ? ' active' : '')}>
                <button
                  className="program-open"
                  onClick={() => onOpen(p.name, 'factory')}
                  title="Open (read-only preset)"
                >
                  <span className="program-dot">◆</span>
                  {p.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <button
        className={'mod-toggle' + (lowercaseMod ? ' on' : '')}
        onClick={onToggleLowercase}
        title="Lowercase mod: show mixed case (off = stock Model I, uppercase-only)"
      >
        <span className={'mod-switch' + (lowercaseMod ? ' on' : '')} />
        <span className="mod-label">Lowercase mod</span>
        <span className="mod-state">{lowercaseMod ? 'ON' : 'OFF'}</span>
      </button>

      <div className="sidebar-footer">Retro80 {VERSION_LABEL}</div>
    </aside>
  )
}
