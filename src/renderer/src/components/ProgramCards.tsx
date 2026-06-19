import { useState } from 'react'

// A clean, responsive list of programs (Examples / Demos). Each card shows a
// title + one-line description with Load/Run buttons, and an optional
// collapsible "Show code" so curious kids can peek without loading. No code is
// shown by default — keeps the list uncluttered and prevents the old overflow.
export interface ProgramItem {
  name: string
  description: string
  code: string
}

interface Props {
  title: string
  blurb: string
  items: ProgramItem[]
  onLoad: (code: string, name: string) => void
  onRun: (code: string) => void
}

export default function ProgramCards({ title, blurb, items, onLoad, onRun }: Props): JSX.Element {
  return (
    <div className="page">
      <h1>{title}</h1>
      <p className="lead">{blurb}</p>
      <div className="card-list">
        {items.map((it) => (
          <Card key={it.name} item={it} onLoad={onLoad} onRun={onRun} />
        ))}
      </div>
    </div>
  )
}

function Card({
  item,
  onLoad,
  onRun
}: {
  item: ProgramItem
  onLoad: (code: string, name: string) => void
  onRun: (code: string) => void
}): JSX.Element {
  const [showCode, setShowCode] = useState(false)
  return (
    <div className="prog-card">
      <div className="prog-card-main">
        <div className="prog-card-text">
          <div className="prog-card-name">{item.name}</div>
          <div className="prog-card-desc">{item.description}</div>
        </div>
        <div className="prog-card-actions">
          <button className="btn btn-sm" onClick={() => onLoad(item.code, item.name)}>
            Load
          </button>
          <button className="btn btn-sm btn-run" onClick={() => onRun(item.code)}>
            ▶ Run
          </button>
        </div>
      </div>
      <button
        className="prog-card-toggle"
        onClick={() => setShowCode((v) => !v)}
        aria-expanded={showCode}
      >
        {showCode ? '▾ Hide code' : '▸ Show code'}
      </button>
      {showCode && <pre className="prog-card-code">{item.code}</pre>}
    </div>
  )
}
