import { useEffect, useRef, useState } from 'react'
import {
  Trs80,
  Config,
  ModelType,
  BasicLevel,
  Background,
  CassettePlayer
} from 'trs80-emulator'
import { CanvasScreen, WebKeyboard } from 'trs80-emulator-web'
// WebSoundPlayer isn't re-exported from the package index, so import its module.
import { WebSoundPlayer } from 'trs80-emulator-web/dist/WebSoundPlayer.js'
import { decodeTrs80File, type BasicProgram } from 'trs80-base'
import { wrapLowSpeed, encodeLowSpeed } from 'trs80-cassette'
import type { Trs80Program } from '../trs80/programs'
import HelpPanel from './HelpPanel'

interface Props {
  // What to put in the machine: a preserved program (loaded via cassette
  // CLOAD) or, with bytes = null, a bare machine that boots to READY.
  program: Trs80Program
}

// Cassette player backed by pre-encoded 500-baud audio of the program. The
// emulator polls readSample() as the BASIC ROM's CLOAD routine runs.
class TapePlayer extends CassettePlayer {
  samplesPerSecond: number
  private readonly samples: Int16Array
  private idx = 0
  onStart: () => void = () => {}
  onStop: () => void = () => {}
  constructor(samples: Int16Array, rate: number) {
    super()
    this.samples = samples
    this.samplesPerSecond = rate
  }
  override onMotorStart(): void {
    this.idx = 0 // rewind the tape each time the motor spins up
    this.onStart()
  }
  override readSample(): number {
    return this.idx < this.samples.length ? this.samples[this.idx++] / 32768 : 0
  }
  // CLOAD stops the motor when the program is fully read — that's our "done".
  override onMotorStop(): void {
    this.onStop()
  }
  progress(): number {
    return this.samples.length === 0 ? 1 : Math.min(0.99, this.idx / this.samples.length)
  }
}

// A real TRS-80 Model I inside the app — a bundled, MIT-licensed TypeScript
// emulator (Lawrence Kesteloot's) with the genuine Level II BASIC ROM. With a
// program selected, we load the actual preserved bytes exactly as a 1979 tape
// did: encode them as 500-baud cassette audio and have the emulated BASIC
// CLOAD it. Because a real cassette load is ~4 minutes, the CPU runs
// unthrottled during the load (real clock, so decode timing still holds) with
// a progress bar. With no program, the machine simply boots to READY and the
// keyboard is yours.
export default function Trs80Emulator({ program }: Props): JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null)
  const soundRef = useRef<WebSoundPlayer | null>(null)
  const enableSoundRef = useRef<() => void>(() => {})
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState('Booting TRS-80…')
  const [loadPct, setLoadPct] = useState(-1) // -1 = not loading
  const [soundOn, setSoundOn] = useState(false)
  // The program's "manual" (ⓘ INFO button or right-click). While open, keys go
  // to the panel (Esc closes) instead of the emulated machine.
  const [showHelp, setShowHelp] = useState(false)
  const showHelpRef = useRef(false)
  showHelpRef.current = showHelp

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let trs80: Trs80 | null = null
    let keyboard: WebKeyboard | null = null
    let cleanupAudio: () => void = () => {}
    let cleanupKeyboard: () => void = () => {}
    const timers: number[] = []
    setError(null)
    setStatus('Booting TRS-80…')
    setLoadPct(-1)
    try {
      const config = Config.makeDefault()
        .withModelType(ModelType.MODEL1)
        .withBasicLevel(BasicLevel.LEVEL2)
        .withBackground(Background.BLACK)

      const screen = new CanvasScreen(2)
      screen.setConfig(config)
      host.appendChild(screen.getNode())

      // We deliberately do NOT use WebKeyboard's raw keydown/keyup listeners:
      // press and release arriving as separate DOM events can outrun the
      // emulated keyboard matrix and drop characters. Instead we queue a
      // press+release pair per keystroke (the same path simulateKeyboardText
      // uses, which has proven lossless). Trade-off: keys can't be held down.
      keyboard = new WebKeyboard()
      const kb0 = keyboard
      const SPECIAL_KEYS = new Set([
        'Enter',
        'Backspace',
        'Escape',
        'ArrowUp',
        'ArrowDown',
        'ArrowLeft',
        'ArrowRight'
      ])
      const onKeyDown = (e: KeyboardEvent): void => {
        if (showHelpRef.current) {
          if (e.key === 'Escape') setShowHelp(false)
          return // keys go to the help panel, not the machine
        }
        if (e.metaKey || e.ctrlKey || e.altKey) return
        const k = e.key
        if (k.length === 1 || SPECIAL_KEYS.has(k)) {
          // Duplicate presses hold the key across ~3 queue slots (~84ms of
          // emulated time): machine-language games scan the keyboard matrix
          // themselves and can miss a single-slot press.
          kb0.keyEvent(k, true)
          kb0.keyEvent(k, true)
          kb0.keyEvent(k, true)
          kb0.keyEvent(k, false)
          e.preventDefault()
        }
      }
      const onPaste = (e: ClipboardEvent): void => {
        const text = e.clipboardData?.getData('text/plain')
        if (text) kb0.simulateKeyboardText(text)
        e.preventDefault()
      }
      window.addEventListener('keydown', onKeyDown)
      window.addEventListener('paste', onPaste)
      cleanupKeyboard = () => {
        window.removeEventListener('keydown', onKeyDown)
        window.removeEventListener('paste', onPaste)
      }

      // Cassette-loaded BASIC programs get encoded as 500-baud audio; direct
      // (machine-language) programs and the bare machine mount an empty tape.
      const rate = 44100
      let tape: TapePlayer
      if (program.bytes && program.load === 'cassette') {
        const file = decodeTrs80File(program.bytes, program.id + '.bas') as BasicProgram
        const audio = encodeLowSpeed(wrapLowSpeed(file.asCassetteBinary()), rate, 500)
        tape = new TapePlayer(audio, rate)
      } else {
        tape = new TapePlayer(new Int16Array(0), rate)
      }

      // Sound comes out the emulated cassette port. The browser will only
      // start/resume an AudioContext from a real user gesture, so we unmute on
      // the first click or keypress in this view (not at mount — doing so
      // leaves the context auto-suspended and silent).
      const soundPlayer = new WebSoundPlayer()
      soundRef.current = soundPlayer
      const enableSound = (): void => {
        try {
          if (soundPlayer.isMuted()) {
            soundPlayer.unmute()
            setSoundOn(true)
          }
        } catch {
          /* ignore */
        }
      }
      enableSoundRef.current = enableSound
      window.addEventListener('keydown', enableSound)
      cleanupAudio = () => window.removeEventListener('keydown', enableSound)

      trs80 = new Trs80(config, screen, keyboard, tape, soundPlayer)
      const machine = trs80
      const kb = keyboard
      machine.reset()
      machine.start()

      // Run the CPU as fast as the host allows until CLOAD turns the cassette
      // motor off (program fully read), plus a little extra so BASIC prints
      // READY, then resume real-time and onDone().
      let fastRunning = false
      let tapeStopped = false
      tape.onStop = () => {
        tapeStopped = true
      }
      const fastRun = (onDone: () => void): void => {
        if (fastRunning) return
        fastRunning = true
        machine.stop() // take over from the throttled tick
        const pump = (): void => {
          const t0 = performance.now()
          // Safety cap (~12s emulated) in case the motor never stops.
          const cap = machine.tStateCount + machine.clockHz * 12
          while (!tapeStopped && machine.tStateCount < cap && performance.now() - t0 < 25) {
            machine.step()
          }
          setLoadPct(Math.round(tape.progress() * 100))
          if (!tapeStopped && machine.tStateCount < cap) {
            timers.push(window.setTimeout(pump, 0))
            return
          }
          // Motor off → let BASIC finish (~0.5s emulated) then go real-time.
          setLoadPct(100)
          const target = machine.tStateCount + machine.clockHz * 0.5
          const finish = (): void => {
            const t1 = performance.now()
            while (machine.tStateCount < target && performance.now() - t1 < 25) machine.step()
            if (machine.tStateCount < target) {
              timers.push(window.setTimeout(finish, 0))
            } else {
              machine.start()
              fastRunning = false
              onDone()
            }
          }
          finish()
        }
        pump()
      }

      // When CLOAD spins up the cassette motor, switch to fast-run for the load.
      tape.onStart = () => {
        setStatus('Loading from tape…')
        setLoadPct(0)
        fastRun(() => {
          setLoadPct(-1)
          setStatus('Running')
          timers.push(window.setTimeout(() => kb.simulateKeyboardText('RUN\n'), 400))
        })
      }

      // Boot → answer MEMORY SIZE? → wait for READY (program-start pointer at
      // 0x40A4 initializes only at READY) → CLOAD the program, if there is one.
      timers.push(window.setTimeout(() => kb.simulateKeyboardText('\n'), 500))
      let tries = 0
      let started = false
      const waitReady = (): void => {
        const addr = machine.readMemory(0x40a4) | (machine.readMemory(0x40a5) << 8)
        if (!started && addr >= 0x4200) {
          started = true
          if (program.bytes && program.load === 'cassette') {
            setStatus('Loading from tape…')
            timers.push(window.setTimeout(() => kb.simulateKeyboardText('CLOAD\n'), 300))
          } else if (program.bytes) {
            // Machine-language image: write it into memory and jump, the way a
            // disk system loaded CMD/SYSTEM programs. Self-starting.
            timers.push(
              window.setTimeout(() => {
                machine.runTrs80File(decodeTrs80File(program.bytes!, program.id))
                setStatus('Running')
              }, 300)
            )
          } else {
            setStatus('READY')
          }
        } else if (!started && tries++ < 150) {
          timers.push(window.setTimeout(waitReady, 100))
        } else if (!started) {
          setError('TRS-80 BASIC did not reach READY')
        }
      }
      timers.push(window.setTimeout(waitReady, 900))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }

    return () => {
      try {
        timers.forEach((t) => window.clearTimeout(t))
        cleanupAudio()
        cleanupKeyboard()
        if (keyboard) keyboard.interceptKeys = false
        if (soundRef.current) soundRef.current.mute()
        if (trs80) trs80.stop()
      } catch {
        /* ignore teardown errors */
      }
      host.innerHTML = ''
      soundRef.current = null
    }
  }, [program])

  // Clicking the screen is a user gesture, so it can start/resume audio too.
  const onActivate = (): void => {
    enableSoundRef.current()
  }

  return (
    <div className="trs80-view">
      <div className="trs80-bar">
        <span>{program.title}</span>
        <span className="trs80-tools">
          <span className="trs80-hint">
            {loadPct >= 0
              ? `${status} ${loadPct}%`
              : soundOn
                ? `${status} · ${program.hint} · 🔊`
                : `${status} · ${program.hint} · 🔇 press a key or click for sound`}
          </span>
          <button
            className="trs80-info-btn"
            title="Instructions, tips & hints (also: right-click the screen)"
            onClick={() => setShowHelp((v) => !v)}
          >
            ⓘ INFO
          </button>
        </span>
      </div>
      {error ? (
        <div className="trs80-error">Emulator error: {error}</div>
      ) : (
        <div
          className="trs80-host"
          onClick={onActivate}
          onContextMenu={(e) => {
            e.preventDefault()
            setShowHelp(true)
          }}
        >
          <div className="trs80-canvas-mount" ref={hostRef} />
          {loadPct >= 0 && (
            <div className="trs80-load">
              <div className="trs80-load-label">⌖ LOADING FROM TAPE… {loadPct}%</div>
              <div className="trs80-load-track">
                <div className="trs80-load-fill" style={{ width: `${loadPct}%` }} />
              </div>
            </div>
          )}
          {showHelp && <HelpPanel help={program.help} onClose={() => setShowHelp(false)} />}
        </div>
      )}
    </div>
  )
}
