import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'

export interface TerminalHandle {
  focusInput: () => void
  // Pre-fill the input line with text (used by EDIT) and put the caret at the end.
  setInput: (text: string) => void
}

interface Props {
  output: string
  // True when the machine is waiting for the user (command prompt or INPUT).
  // False while a program is actively running — typing is ignored and the
  // cursor hidden (use Stop to break in).
  inputActive: boolean
  onSubmit: (line: string) => void
  // 'trs80' (default) = the authentic Model I ROM font, sized to a 64-column
  // screen. 'mono' = a plain monospace at a normal size — used by the Python
  // REPL, where the tall ROM font (and forced uppercase) is confusing.
  variant?: 'trs80' | 'mono'
}

// A single scrolling text flow with the input cursor rendered INLINE at the
// real caret position, so arrow keys / Home / End / mid-line edits all show
// where you are — modern editing inside a vintage screen.
const Terminal = forwardRef<TerminalHandle, Props>(function Terminal(
  { output, inputActive, onSubmit, variant = 'trs80' },
  ref
): JSX.Element {
  const [line, setLine] = useState('')
  const [caret, setCaret] = useState(0)
  const [history, setHistory] = useState<string[]>([])
  const [histIdx, setHistIdx] = useState<number>(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [fontSize, setFontSize] = useState(24)

  // Size the screen like the real TRS-80 (and our emulator view): 64 columns
  // always fill the available width, so characters scale with the window. One
  // em of the ROM font is a full character cell, 3 units tall by 1 wide — so
  // font-size = (width / 64 columns) * 3.
  useEffect(() => {
    // Plain monospace (Python REPL): a fixed, readable size — no 64-column ROM
    // scaling.
    if (variant === 'mono') {
      setFontSize(14)
      return
    }
    const el = scrollRef.current
    if (!el) return
    const update = (): void => {
      const style = getComputedStyle(el)
      const avail =
        el.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
      if (avail > 0) setFontSize(Math.max(12, (avail / 64) * 3))
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [variant])

  useImperativeHandle(ref, () => ({
    focusInput: () => inputRef.current?.focus(),
    setInput: (text: string) => {
      setLine(text)
      setCaret(text.length)
      const el = inputRef.current
      if (el) {
        el.value = text
        el.focus()
        el.setSelectionRange(text.length, text.length)
      }
    }
  }))

  // Auto-scroll to the bottom as text or the typed line grows.
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [output, line, caret])

  useEffect(() => {
    if (inputActive) inputRef.current?.focus()
    else {
      setLine('')
      setCaret(0)
    }
  }, [inputActive])

  const syncCaret = (): void => {
    const el = inputRef.current
    if (el) setCaret(el.selectionStart ?? el.value.length)
  }

  // Replace the line (history recall) keeping the real input + caret in sync.
  const recall = (text: string): void => {
    setLine(text)
    setCaret(text.length)
    const el = inputRef.current
    if (el) {
      el.value = text
      el.setSelectionRange(text.length, text.length)
    }
  }

  const submit = (): void => {
    if (!inputActive) return
    const value = line
    setLine('')
    setCaret(0)
    if (value.trim()) setHistory((h) => [...h, value])
    setHistIdx(-1)
    onSubmit(value)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      e.preventDefault()
      submit()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (history.length === 0) return
      const idx = histIdx === -1 ? history.length - 1 : Math.max(0, histIdx - 1)
      setHistIdx(idx)
      recall(history[idx])
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (histIdx === -1) return
      const idx = histIdx + 1
      if (idx >= history.length) {
        setHistIdx(-1)
        recall('')
      } else {
        setHistIdx(idx)
        recall(history[idx])
      }
    }
    // Left / Right / Home / End / Backspace / Delete fall through to the native
    // input; the caret is synced on keyup.
  }

  const before = line.slice(0, caret)
  const atChar = line.slice(caret, caret + 1) || ' '
  const after = line.slice(caret + 1)

  return (
    <div
      className={'terminal' + (variant === 'mono' ? ' terminal-mono' : '')}
      onClick={() => inputRef.current?.focus()}
    >
      <div className="terminal-scroll" ref={scrollRef}>
        <pre className="terminal-output" style={{ fontSize }}>
          {output}
          {inputActive ? before : ''}
          {inputActive ? <span className="terminal-cursor">{atChar}</span> : null}
          {inputActive ? after : ''}
        </pre>
      </div>
      {/* Invisible but focusable — captures keystrokes for the inline cursor. */}
      <input
        ref={inputRef}
        className="terminal-capture"
        value={line}
        spellCheck={false}
        autoComplete="off"
        autoCapitalize="off"
        onChange={(e) => {
          if (!inputActive) return
          setLine(e.target.value)
          setCaret(e.target.selectionStart ?? e.target.value.length)
        }}
        onKeyDown={onKeyDown}
        onKeyUp={syncCaret}
        onSelect={syncCaret}
      />
    </div>
  )
})

export default Terminal
