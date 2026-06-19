import { useCallback, useEffect, useRef, useState } from 'react'
import { BasicSession, type Host } from './basic'
import { SAMPLES } from './samples'
import { VERSION_LABEL, VERSION_LABEL_FULL } from './version'
import Sidebar from './components/Sidebar'
import Terminal, { type TerminalHandle } from './components/Terminal'
import CodeEditor from './components/CodeEditor'
import QuickStart from './components/QuickStart'
import SyntaxGuide from './components/SyntaxGuide'
import Overlay, { type OverlayKind } from './components/Overlay'
import GraphicsScreen from './components/GraphicsScreen'
import Trs80Emulator from './components/Trs80Emulator'
import DancingDemon from './components/DancingDemon'
import PythonView from './components/PythonView'
import HelpPanel from './components/HelpPanel'
import UpdateBanner from './components/UpdateBanner'
import { TRS80_PROGRAMS } from './trs80/programs'

export type View =
  | 'console'
  | 'editor'
  | 'quickstart'
  | 'syntax'
  | 'demonstudio'
  | 'python'
  | 'trs80'
  | 'demon'
  | 'dogstar'
  | 'pyramid'
  | 'haunted'

// Views that show the TRS-80 emulator, mapped to the program they run.
const TRS80_VIEWS: Record<string, string> = {
  trs80: 'basic',
  demon: 'demon',
  dogstar: 'dogstar',
  pyramid: 'pyramid',
  haunted: 'haunted'
}
// 'factory' = a built-in sample (read-only, always pristine from samples.ts).
// 'user' = saved by the user to disk (editable, deletable).
export type ProgramSource = 'factory' | 'user'
export interface ProgramEntry {
  name: string
  mtime: number
  source: ProgramSource
}

export default function App(): JSX.Element {
  const [view, setView] = useState<View>('console')
  const [programs, setPrograms] = useState<ProgramEntry[]>([])
  const [currentName, setCurrentName] = useState<string | null>(null)
  const [currentSource, setCurrentSource] = useState<ProgramSource | null>(null)
  // The loaded program's "operator's manual" (samples that have one), shown in
  // the Console via the ⓘ INFO button or right-click. Closes on program change.
  const [consoleHelp, setConsoleHelp] = useState(false)
  const currentHelp = currentName
    ? SAMPLES.find((s) => s.name === currentName)?.help
    : undefined
  useEffect(() => {
    setConsoleHelp(false)
  }, [currentName])
  const [editorText, setEditorText] = useState<string>('')
  const [running, setRunning] = useState(false)
  // The "lowercase mod": when on, the console stops forcing uppercase, so
  // mixed-case text (including lowercase in strings) shows as a lowercase-modded
  // TRS-80 would. Off = stock Model I (uppercase-only display). Persisted.
  const [lowercaseMod, setLowercaseMod] = useState<boolean>(
    () => localStorage.getItem('retrobasic.lowercase') === '1'
  )
  // About / Development Log overlay (opened from the Help menu).
  const [overlay, setOverlay] = useState<OverlayKind | null>(null)
  useEffect(() => {
    return window.api.onShowOverlay((which) => setOverlay(which as OverlayKind))
  }, [])

  const toggleLowercase = useCallback(() => {
    setLowercaseMod((on) => {
      const next = !on
      localStorage.setItem('retrobasic.lowercase', next ? '1' : '0')
      return next
    })
  }, [])

  // Output buffer for the console. We keep it in a ref for the Host closures
  // and mirror it into state to trigger re-renders.
  const [output, setOutput] = useState<string>(BANNER + PROMPT)
  const pendingInput = useRef<((s: string) => void) | null>(null)
  // The in-flight RUN/command, so we can stop & await it before starting another.
  const runRef = useRef<Promise<void> | null>(null)
  const terminalRef = useRef<TerminalHandle>(null)
  // Graphics screen: the live 1024-cell buffer (or null = hidden). gfxVersion
  // bumps to trigger a canvas redraw without copying the buffer each pixel.
  const graphicsRef = useRef<number[] | null>(null)
  const [gfxVersion, setGfxVersion] = useState(0)
  // Live animation-speed tuner: PAUSE delays are scaled by this percent (100 =
  // as written, 50 = twice as fast, 200 = half speed). Helps dial in frame rate.
  const [speedPct, setSpeedPct] = useState(100)
  const speedRef = useRef(100)
  const adjustSpeed = useCallback((delta: number) => {
    setSpeedPct((p) => {
      const next = Math.min(300, Math.max(25, p + delta))
      speedRef.current = next
      return next
    })
  }, [])
  // Frame-rate measurement: each PAUSE (host.delay) marks one animation frame.
  const frameTimesRef = useRef<number[]>([])
  const getFps = useCallback(() => {
    const now = performance.now()
    const t = frameTimesRef.current
    while (t.length && now - t[0] > 1000) t.shift()
    return t.length
  }, [])

  const append = useCallback((t: string) => setOutput((prev) => prev + t), [])

  // Close the graphics screen and return focus to the console input, so you can
  // type at the prompt immediately (no click needed).
  const closeGraphics = useCallback(() => {
    graphicsRef.current = null
    setGfxVersion((v) => v + 1)
    requestAnimationFrame(() => terminalRef.current?.focusInput())
  }, [])

  // The host bridges the interpreter to the console UI.
  const hostRef = useRef<Host>({
    output: (t) => append(t),
    inputLine: (prompt) => {
      append(prompt)
      return new Promise<string>((resolve) => {
        pendingInput.current = resolve
      })
    },
    clearScreen: () => setOutput(''),
    // SAVE / LOAD persist to localStorage (survives app restarts).
    saveData: (key, values) => {
      localStorage.setItem('basic.save:' + key, JSON.stringify(values))
    },
    loadData: (key) => {
      const raw = localStorage.getItem('basic.save:' + key)
      if (raw === null) return null
      try {
        return JSON.parse(raw)
      } catch {
        return null
      }
    },
    graphics: (cells) => {
      graphicsRef.current = cells
      setGfxVersion((v) => v + 1)
    },
    delay: (ms) => {
      frameTimesRef.current.push(performance.now()) // count this frame for FPS
      return new Promise((resolve) => setTimeout(resolve, (ms * 100) / speedRef.current))
    },
    sound: (freq, ms) =>
      new Promise((resolve) => {
        const ac = getAudioContext()
        if (ac) scheduleTone(ac, freq, ac.currentTime, ms / 1000)
        setTimeout(resolve, ms)
      }),
    playSequence: (notes) => {
      const ac = getAudioContext()
      if (!ac) return
      let t = ac.currentTime + 0.06 // small lead-in
      for (const note of notes) {
        scheduleTone(ac, note.freq, t, note.ms / 1000)
        t += note.ms / 1000
      }
    },
    stopSound: () => stopAllSound()
  })
  // Keep the closure fresh.
  hostRef.current.output = (t) => append(t)

  const sessionRef = useRef<BasicSession | null>(null)
  if (!sessionRef.current) {
    sessionRef.current = new BasicSession(hostRef.current)
  }
  const session = sessionRef.current

  // ---- program library ----

  const refreshPrograms = useCallback(async () => {
    // User programs live on disk; factory samples come straight from samples.ts
    // and are never written to disk, so editing one can't corrupt the original.
    const userList = await window.api.listPrograms()
    const userEntries: ProgramEntry[] = userList.map((p) => ({ ...p, source: 'user' }))
    const factoryEntries: ProgramEntry[] = SAMPLES.map((s) => ({
      name: s.name,
      mtime: 0,
      source: 'factory'
    }))
    setPrograms([...userEntries, ...factoryEntries])
  }, [])

  // Load the program library on launch. (No more seeding samples to disk — they
  // are served read-only from samples.ts as "factory" presets.)
  useEffect(() => {
    void refreshPrograms()
  }, [refreshPrograms])

  // ---- console input handling ----

  const stop = useCallback(() => {
    session.requestStop() // aborts a parked INPUT at the engine level
    if (pendingInput.current) {
      const resolve = pendingInput.current
      pendingInput.current = null
      resolve('')
    }
  }, [session])

  // Run a command/RUN as the single in-flight execution. If something is already
  // running, stop it and wait for it to unwind first — this prevents the input
  // channel from being orphaned (which used to lock up the console).
  const runExec = useCallback(
    async (cmd: string) => {
      if (runRef.current) {
        stop()
        try {
          await runRef.current
        } catch {
          /* already settling */
        }
      }
      setRunning(true)
      const p = session.execute(cmd)
      runRef.current = p
      try {
        await p
      } finally {
        if (runRef.current === p) runRef.current = null
        setRunning(false)
        append(PROMPT)
      }
    },
    [session, append, stop]
  )

  const handleSubmit = useCallback(
    async (line: string) => {
      // The typed text is already shown inline; commit it with a newline.
      append(line + '\n')
      // If the engine is waiting on INPUT, this line answers it.
      if (pendingInput.current) {
        const resolve = pendingInput.current
        pendingInput.current = null
        resolve(line)
        return
      }
      // EDIT <line> — pull that line back into the prompt for editing (arrow
      // keys, backspace, etc.), then re-enter it to save. EDIT alone: usage.
      if (/^\s*EDIT\s*$/i.test(line)) {
        append('?Usage: EDIT <line number>\nREADY\n' + PROMPT)
        return
      }
      const editMatch = line.match(/^\s*EDIT\s+(\d+)\s*$/i)
      if (editMatch) {
        const num = parseInt(editMatch[1], 10)
        const src = session.getLine(num)
        if (src === null) {
          append(`?Undefined line ${num}\nREADY\n` + PROMPT)
        } else {
          append(PROMPT)
          terminalRef.current?.setInput(`${num} ${src}`)
        }
        return
      }
      await runExec(line)
    },
    [append, runExec, session]
  )

  // ---- editor / run actions ----

  const runProgram = useCallback(
    async (text: string) => {
      session.setProgramText(text)
      setEditorText(session.getProgramText())
      setView('console')
      append('RUN\n') // completes the "> RUN" command line
      await runExec('RUN')
      terminalRef.current?.focusInput()
    },
    [session, append, runExec]
  )

  // Run whatever is current: the editor buffer if we're editing, otherwise the
  // program already loaded in the session. Drives the titlebar Run button.
  const runCurrent = useCallback(async () => {
    if (view === 'editor') {
      await runProgram(editorText)
      return
    }
    setView('console')
    append('RUN\n')
    await runExec('RUN')
    terminalRef.current?.focusInput()
  }, [view, editorText, runProgram, append, runExec])

  // Ask a question inline on the console and wait for the user's reply, using
  // the same input channel as the interpreter's INPUT statement.
  const askConsole = useCallback(
    (question: string): Promise<string> => {
      // Cancel any previous pending prompt so we never orphan it.
      if (pendingInput.current) {
        const prev = pendingInput.current
        pendingInput.current = null
        prev('')
      }
      append(question)
      return new Promise<string>((resolve) => {
        pendingInput.current = resolve
      })
    },
    [append]
  )

  const loadProgram = useCallback(
    async (name: string, source: ProgramSource) => {
      const code =
        source === 'factory'
          ? (SAMPLES.find((s) => s.name === name)?.code ?? '')
          : await window.api.loadProgram(name)
      // If a program is running, stop it and let it fully unwind first — opening
      // a program mid-run used to orphan its INPUT and lock up the console.
      if (runRef.current) {
        stop()
        try {
          await runRef.current
        } catch {
          /* settling */
        }
      }
      // If a program is already loaded, confirm right on the CLI, vintage-style.
      if (!session.isEmpty()) {
        setView('console')
        terminalRef.current?.focusInput()
        const answer = await askConsole(`\nReplace the current program with "${name}"? `)
        if (!/^\s*y/i.test(answer)) {
          append('\nREADY\n' + PROMPT)
          terminalRef.current?.focusInput()
          return
        }
      }
      session.setProgramText(code)
      setEditorText(session.getProgramText())
      setCurrentName(name)
      setCurrentSource(source)
      // Load into the Console so you can RUN / LIST interactively.
      setView('console')
      const lineCount = code.split(/\r?\n/).filter((l) => l.trim()).length
      setOutput(
        (prev) =>
          prev +
          `\nLOADED "${name}"  (${lineCount} line${lineCount === 1 ? '' : 's'})\n` +
          `Type RUN to execute, or LIST to view the program.\n\nREADY\n` +
          PROMPT
      )
      terminalRef.current?.focusInput()
    },
    [session, askConsole, append, stop]
  )

  const newProgram = useCallback(() => {
    session.setProgramText('')
    setEditorText('')
    setCurrentName(null)
    setCurrentSource(null)
    setView('editor')
  }, [session])

  // Saving always writes to the user's disk library. Editing a factory preset
  // and saving therefore creates a *user copy*, leaving the preset untouched.
  const saveProgram = useCallback(
    async (name: string, text: string) => {
      session.setProgramText(text)
      const saved = await window.api.saveProgram(name, session.getProgramText())
      setCurrentName(saved)
      setCurrentSource('user')
      await refreshPrograms()
    },
    [session, refreshPrograms]
  )

  // Only user programs can be deleted; factory presets are read-only.
  const deleteProgram = useCallback(
    async (name: string, source: ProgramSource) => {
      if (source !== 'user') return
      await window.api.deleteProgram(name)
      if (currentName === name && currentSource === 'user') {
        setCurrentName(null)
        setCurrentSource(null)
      }
      await refreshPrograms()
    },
    [currentName, currentSource, refreshPrograms]
  )

  const loadSampleToEditor = useCallback((code: string, name: string) => {
    session.setProgramText(code)
    setEditorText(session.getProgramText())
    setCurrentName(name)
    setCurrentSource('factory')
    setView('editor')
  }, [session])

  // Manual view switches (the sidebar) keep the editor and console in sync via the
  // session, which is the single source of truth for the program. Leaving the
  // editor pushes its text into the session; entering it pulls the current program
  // (e.g. lines just typed at the console) back into the editor.
  const goToView = useCallback(
    (v: View) => {
      if (view === 'editor' && v !== 'editor') session.setProgramText(editorText)
      else if (v === 'editor' && view !== 'editor') setEditorText(session.getProgramText())
      setView(v)
    },
    [view, editorText, session]
  )

  return (
    <div className={'app' + (lowercaseMod ? ' lowercase' : '')}>
      <Sidebar
        view={view}
        onView={goToView}
        programs={programs}
        currentName={currentName}
        currentSource={currentSource}
        onNew={newProgram}
        onOpen={loadProgram}
        onDelete={deleteProgram}
        lowercaseMod={lowercaseMod}
        onToggleLowercase={toggleLowercase}
      />
      <main className="main">
        <div className="titlebar">
          <span className="titlebar-title">
            Retro80 <span className="titlebar-ver">{VERSION_LABEL}</span>
            {currentName ? <span className="titlebar-sub"> — {currentName}</span> : null}
          </span>
          <div className="titlebar-actions">
            {running ? (
              <button className="btn btn-stop" onClick={stop}>
                ■ Stop
              </button>
            ) : (
              <button
                className="btn btn-run btn-sm"
                onClick={runCurrent}
                title="Run the current program (RUN)"
              >
                ▶ Run
              </button>
            )}
          </div>
        </div>

        {(view === 'console' || view === 'editor' || view === 'quickstart' || view === 'syntax') && (
          <div className="py-tabs">
            {(
              [
                ['console', '>_ Console'],
                ['editor', '✎ Editor'],
                ['quickstart', '★ Quick Start'],
                ['syntax', '? Syntax']
              ] as [View, string][]
            ).map(([v, label]) => (
              <button
                key={v}
                className={'py-tab' + (view === v ? ' active' : '')}
                onClick={() => goToView(v)}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {view === 'console' && (
          <div
            className="console-wrap"
            onContextMenu={(e) => {
              if (currentHelp) {
                e.preventDefault()
                setConsoleHelp(true)
              }
            }}
          >
            <Terminal
              ref={terminalRef}
              output={output}
              inputActive={!running || pendingInput.current !== null}
              onSubmit={handleSubmit}
            />
            {currentHelp && !consoleHelp && (
              <button
                className="trs80-info-btn console-info-btn"
                title={`Instructions, tips & hints for ${currentName} (also: right-click)`}
                onClick={() => setConsoleHelp(true)}
              >
                ⓘ INFO
              </button>
            )}
            {currentHelp && consoleHelp && (
              <HelpPanel help={currentHelp} onClose={() => setConsoleHelp(false)} />
            )}
          </div>
        )}
        {view === 'console' && graphicsRef.current && (
          <GraphicsScreen
            cells={graphicsRef.current}
            version={gfxVersion}
            onClose={closeGraphics}
            speedPct={speedPct}
            onSpeed={adjustSpeed}
            getFps={getFps}
          />
        )}
        {view === 'editor' && (
          <CodeEditor
            name={currentName}
            text={editorText}
            placeholder={'10 PRINT "HELLO, WORLD!"\n20 GOTO 10'}
            hint={
              <>
                Tip: numbered lines build the program. Press <kbd>Run</kbd> to execute, or switch to
                the Console and type <code>RUN</code>, <code>LIST</code>, or any command.
              </>
            }
            programs={programs.filter((p) => p.source === 'user').map((p) => ({ name: p.name }))}
            onOpen={(n) => loadProgram(n, 'user')}
            onChange={setEditorText}
            onRun={() => runProgram(editorText)}
            onSave={saveProgram}
            onExport={(name, text) => window.api.exportProgram(name, text)}
          />
        )}
        {view === 'quickstart' && (
          <QuickStart onTry={loadSampleToEditor} onRun={runProgram} />
        )}
        {view === 'syntax' && <SyntaxGuide />}
        {view === 'demonstudio' && <DancingDemon />}
        {view === 'python' && <PythonView />}
        {view in TRS80_VIEWS && (
          <Trs80Emulator key={view} program={TRS80_PROGRAMS[TRS80_VIEWS[view]]} />
        )}
      </main>
      {overlay && <Overlay kind={overlay} onClose={() => setOverlay(null)} />}
      <UpdateBanner />
    </div>
  )
}

// ---- audio (Web Audio) ----
// Lazily create one shared AudioContext (after a user gesture, e.g. RUN).
let audioCtx: AudioContext | null = null
let activeOscillators: OscillatorNode[] = []
function getAudioContext(): AudioContext | null {
  try {
    if (!audioCtx) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      audioCtx = new Ctor()
    }
    if (audioCtx.state === 'suspended') void audioCtx.resume()
    return audioCtx
  } catch {
    return null
  }
}

// Schedule one square-wave note starting at `start` (AudioContext time) for
// `dur` seconds, tracked so stopAllSound() can cut it. freq 0 = silence.
function scheduleTone(ac: AudioContext, freq: number, start: number, dur: number): void {
  if (freq <= 0 || dur <= 0) return
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  osc.type = 'square' // authentic buzzy TRS-80 timbre
  osc.frequency.value = freq
  const vol = 0.14
  gain.gain.setValueAtTime(0, start)
  gain.gain.linearRampToValueAtTime(vol, start + 0.005)
  gain.gain.setValueAtTime(vol, Math.max(start + 0.005, start + dur - 0.01))
  gain.gain.linearRampToValueAtTime(0, start + dur)
  osc.connect(gain)
  gain.connect(ac.destination)
  osc.start(start)
  osc.stop(start + dur)
  activeOscillators.push(osc)
  osc.onended = (): void => {
    activeOscillators = activeOscillators.filter((o) => o !== osc)
  }
}

function stopAllSound(): void {
  for (const osc of activeOscillators) {
    try {
      osc.stop()
    } catch {
      /* already stopped */
    }
    try {
      osc.disconnect()
    } catch {
      /* ignore */
    }
  }
  activeOscillators = []
}

const PROMPT = '> '
const BANNER =
  "┌──────────────────────────────────────────────┐\n" +
  "│               R E T R O   8 0                │\n" +
  "│        vintage BASIC & a real TRS-80         │\n" +
  "└──────────────────────────────────────────────┘\n" +
  `              ${VERSION_LABEL_FULL}\n` +
  '\n' +
  'Type a command, or a numbered line to build a program.\n' +
  'Try:  PRINT "HELLO"      or      RUN      or      LIST\n' +
  'See the Quick Start and Syntax Guide in the sidebar.\n' +
  '\nREADY\n'
