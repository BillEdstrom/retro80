import { useRef, useState } from 'react'

// One editor for both BASIC and Python: a name field, an optional Open menu of
// saved programs, Run / Save / Export, and a code area with a line-number gutter,
// Tab→spaces, and gutter scroll-sync. The only per-language difference is the
// placeholder text and which session actually runs/saves the code.
interface Props {
  name: string | null
  text: string
  placeholder?: string
  hint?: React.ReactNode
  onChange: (t: string) => void
  onRun: () => void
  onSave: (name: string, text: string) => void
  onExport: (name: string, text: string) => void
  // Optional library of saved programs to open from the toolbar.
  programs?: { name: string }[]
  onOpen?: (name: string) => void
}

export default function CodeEditor({
  name,
  text,
  placeholder,
  hint,
  onChange,
  onRun,
  onSave,
  onExport,
  programs,
  onOpen
}: Props): JSX.Element {
  const [draftName, setDraftName] = useState(name ?? '')
  const gutterRef = useRef<HTMLPreElement>(null)

  // Keep the name field in step when the loaded program changes.
  const prevName = useRef(name)
  if (prevName.current !== name) {
    prevName.current = name
    if ((name ?? '') !== draftName) setDraftName(name ?? '')
  }

  const handleSave = (): void => {
    let finalName = (draftName || name || '').trim()
    if (!finalName) {
      const entered = prompt('Save program as:')
      if (!entered) return
      finalName = entered.trim()
      setDraftName(finalName)
    }
    onSave(finalName, text)
  }

  const gutter = text.split('\n').map((_, i) => i + 1).join('\n')

  return (
    <div className="editor">
      <div className="editor-toolbar">
        <input
          className="editor-name"
          placeholder="program name"
          value={draftName}
          spellCheck={false}
          onChange={(e) => setDraftName(e.target.value)}
        />
        {programs && programs.length > 0 && onOpen && (
          <select
            className="editor-open"
            value=""
            onChange={(e) => {
              if (e.target.value) onOpen(e.target.value)
            }}
          >
            <option value="">Open…</option>
            {programs.map((p) => (
              <option key={p.name} value={p.name}>
                {p.name}
              </option>
            ))}
          </select>
        )}
        <div className="editor-actions">
          <button className="btn btn-run" onClick={onRun}>
            ▶ Run
          </button>
          <button className="btn" onClick={handleSave}>
            Save
          </button>
          <button
            className="btn"
            onClick={() => onExport((draftName || name || 'untitled').trim(), text)}
          >
            Export…
          </button>
        </div>
      </div>

      <div className="code-body">
        <pre className="code-gutter" ref={gutterRef}>
          {gutter}
        </pre>
        <textarea
          className="code-area"
          value={text}
          spellCheck={false}
          autoCapitalize="off"
          placeholder={placeholder}
          onScroll={(e) => {
            if (gutterRef.current) gutterRef.current.scrollTop = e.currentTarget.scrollTop
          }}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Tab') {
              e.preventDefault()
              const el = e.currentTarget
              const s = el.selectionStart
              const next = el.value.slice(0, s) + '    ' + el.value.slice(el.selectionEnd)
              onChange(next)
              requestAnimationFrame(() => el.setSelectionRange(s + 4, s + 4))
            }
          }}
        />
      </div>

      {hint && <div className="editor-hint">{hint}</div>}
    </div>
  )
}
