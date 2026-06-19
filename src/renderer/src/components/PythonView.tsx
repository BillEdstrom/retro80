import { useCallback, useEffect, useRef, useState } from 'react'
import Terminal, { type TerminalHandle } from './Terminal'
import CodeEditor from './CodeEditor'
import { PythonSession } from '../python/session'
import { LESSONS, PY_INTRO, REPL_GUIDE } from '../python/lessons'

// One engine for the whole session: loading MicroPython is the expensive part, so
// keep it alive across view switches (and keep your REPL variables with it).
let SHARED: PythonSession | null = null

const BANNER =
  'RETROPYTHON  ·  Python 80\n' +
  'A real (Micro)Python for learning, vintage-styled.\n' +
  'Type Python at the >>> prompt. Try:  print("hi")   or   2 ** 10\n\n'
const PS1 = '>>> '
const PS2 = '... '

type Tab = 'repl' | 'editor' | 'guide'

export default function PythonView(): JSX.Element {
  const [tab, setTab] = useState<Tab>('repl')
  const [ready, setReady] = useState(false)
  const [output, setOutput] = useState('Booting RetroPython…\n')
  const [editorText, setEditorText] = useState(
    '# Write Python here, then press Run.\n# Your functions & variables stay live in the REPL afterwards.\nfor i in range(5):\n    print("line", i)\n'
  )
  const [pyName, setPyName] = useState<string | null>(null)
  const [pyPrograms, setPyPrograms] = useState<{ name: string }[]>([])
  const termRef = useRef<TerminalHandle>(null)

  const append = useCallback((s: string) => setOutput((p) => p + s), [])
  // input() can't read the retro console yet (needs the worker runtime — WIP), so
  // fail gracefully with a clear note instead of hanging.
  const askInput = useCallback((prompt: string) => {
    setOutput((p) => p + prompt + '\n[input() is coming soon — RetroPython can’t read the console yet; returning ""]\n')
    return ''
  }, [])

  const refreshPrograms = useCallback(async () => {
    setPyPrograms(await window.api.listPrograms('python'))
  }, [])

  useEffect(() => {
    void refreshPrograms()
    const sess = SHARED ?? (SHARED = new PythonSession())
    sess.setSinks((s) => append(s), askInput)
    if (sess.ready) {
      setReady(true)
      setOutput(BANNER + PS1)
    } else {
      sess
        .load()
        .then(() => {
          setReady(true)
          setOutput(BANNER + PS1)
        })
        .catch((e) => setOutput('Failed to start Python: ' + String(e) + '\n'))
    }
  }, [append, askInput, refreshPrograms])

  const sess = SHARED

  const onReplSubmit = useCallback(
    (line: string) => {
      if (!sess) return
      append(line + '\n')
      // BASIC-style conveniences for the editor program, usable from the prompt:
      // RUN executes it (vars stay live), LIST shows it. Case-insensitive; only
      // the bare word is intercepted, so list(...) etc. still work as Python.
      const cmd = line.trim().toLowerCase()
      if (cmd === 'run') {
        if (editorText.trim()) sess.runProgram(editorText)
        else append('(the Editor is empty — nothing to run)\n')
        append(PS1)
        return
      }
      if (cmd === 'list') {
        append((editorText.trim() ? editorText.replace(/\n+$/, '') : '(the Editor is empty)') + '\n')
        append(PS1)
        return
      }
      const more = sess.replLine(line)
      append(more ? PS2 : PS1)
    },
    [sess, append, editorText]
  )

  const runCode = useCallback(
    (code: string, header: string) => {
      if (!sess) return
      setTab('repl')
      append('\n' + header + '\n')
      sess.runProgram(code)
      append(PS1)
      requestAnimationFrame(() => termRef.current?.focusInput())
    },
    [sess, append]
  )

  const savePy = useCallback(
    async (name: string, text: string) => {
      const saved = await window.api.saveProgram(name, text, 'python')
      setPyName(saved)
      await refreshPrograms()
    },
    [refreshPrograms]
  )
  const openPy = useCallback(async (name: string) => {
    const code = await window.api.loadProgram(name, 'python')
    setEditorText(code)
    setPyName(name)
    setTab('editor')
  }, [])

  return (
    <div className="py-view">
      <div className="py-tabs">
        {(['repl', 'editor', 'guide'] as Tab[]).map((t) => (
          <button
            key={t}
            className={'py-tab' + (tab === t ? ' active' : '')}
            onClick={() => setTab(t)}
          >
            {t === 'repl' ? '>_ REPL' : t === 'editor' ? '✎ Editor' : '★ Getting Started'}
          </button>
        ))}
      </div>

      {tab === 'repl' && (
        <Terminal
          ref={termRef}
          output={output}
          inputActive={ready}
          onSubmit={onReplSubmit}
          variant="mono"
        />
      )}

      {tab === 'editor' && (
        <CodeEditor
          name={pyName}
          text={editorText}
          placeholder={'name = input("Your name? ")\nprint(f"Hello, {name}!")'}
          hint="Tab inserts 4 spaces. Run executes the program, then leaves its functions & variables live in the REPL."
          programs={pyPrograms}
          onOpen={openPy}
          onChange={setEditorText}
          onRun={() => runCode(editorText, '# ── running program (vars stay live in the REPL) ──')}
          onSave={savePy}
          onExport={(name, text) => window.api.exportProgram(name, text, 'python')}
        />
      )}

      {tab === 'guide' && (
        <div className="py-guide">
          <p className="py-intro">{PY_INTRO}</p>

          <div className="repl-guide">
            <div className="repl-guide-title">★ How the REPL works</div>
            {REPL_GUIDE.map((g) => (
              <div className="repl-guide-item" key={g.head}>
                <div className="repl-guide-head">{g.head}</div>
                <div className="repl-guide-body">{g.body}</div>
              </div>
            ))}
            <div className="repl-guide-cmds">
              Prompt shortcuts: <code>RUN</code> runs the Editor program · <code>LIST</code> shows it
            </div>
          </div>

          {LESSONS.map((l) => (
            <div className="py-lesson" key={l.title}>
              <div className="py-lesson-head">
                <span className="py-lesson-title">{l.title}</span>
                <span className="py-lesson-actions">
                  <button className="btn btn-sm" onClick={() => { setEditorText(l.code + '\n'); setTab('editor') }}>
                    Try it
                  </button>
                  <button className="btn btn-sm" onClick={() => runCode(l.code, '# ── lesson ──')} disabled={!ready}>
                    ▶ Run
                  </button>
                </span>
              </div>
              <div className="py-lesson-blurb">{l.blurb}</div>
              <pre className="py-lesson-code">{l.code}</pre>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
