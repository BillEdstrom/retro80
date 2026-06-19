import { useEffect, useRef, useState } from 'react'
import { PRESET_W, PRESET_H, PRESET_POSES, PRESET_SHOWS } from '../demon/presets'
import { DEMON_AUDIO } from '../demon/music'
import { synthBeat, freshBob, FRESH_DUR_MS, FRESH_SEQ, FRESH_ONSETS } from '../demon/choreography'

// Native, fully-controllable Dancing Demon. The figure and the dances are a
// pixel-exact trace of the genuine 1979 program: the two built-in preset shows
// were captured frame-by-frame from the real machine code (with their real beat
// timing — see scripts/capture-presets.mjs), then redrawn here on a canvas at any
// size. The player is beat-accurate: each pose is held for the time the original
// held it, scaled by the speed control.

const SCENE_W = 128
const SCENE_H = 48
// A real TRS-80 graphics pixel is 4 wide x 8 tall (the emulator renders an 8x24
// char cell = 2x3 pixels), i.e. a 1:2 ratio, giving the full 128x48 screen a 4:3
// shape. Draw pixels as 1:2 rectangles so the demon keeps its true proportions
// instead of looking squat.
const SCALE_X = 8
const SCALE_Y = 16
const FLOOR_Y = 45
const DEMON_X = 49 // (128 - 30) / 2, centred
const DEMON_Y = FLOOR_Y - PRESET_H // feet on the floor

// Title block font — letters of "DANCING DEMON" (D A N C I G E M O), 5x4.
const FONT: Record<string, string[]> = {
  D: ['###.', '#..#', '#..#', '#..#', '###.'],
  A: ['.##.', '#..#', '####', '#..#', '#..#'],
  N: ['#..#', '##.#', '#.##', '#..#', '#..#'],
  C: ['.###', '#...', '#...', '#...', '.###'],
  I: ['####', '.##.', '.##.', '.##.', '####'],
  G: ['.###', '#...', '#.##', '#..#', '.###'],
  E: ['####', '#...', '###.', '#...', '####'],
  M: ['#..#', '####', '#.##', '#..#', '#..#'],
  O: ['.##.', '#..#', '#..#', '#..#', '.##.']
}

const PHOSPHOR = '#e9efe6'
const CURTAIN = '#d7ddd4'

// Studio shows: the two captured presets (pose timelines) plus our own procedural
// hip-hop routine driven by the rig.
interface Show {
  id: string
  name: string
  blurb: string
  durMs: number
  seq: number[]
  onsets: number[]
  audio: 'capture' | 'synth' // captured waveform vs synthesized beat
  bob?: boolean // groove bounce overlay
}
const SHOWS: Show[] = [
  ...PRESET_SHOWS.map((p) => ({ id: p.id, name: p.name, blurb: p.blurb, durMs: p.durMs, seq: p.seq, onsets: p.onsets, audio: 'capture' as const })),
  {
    id: 'fresh80',
    name: 'Fresh 80 (Hip-Hop)',
    blurb: "Our own routine — not the 1979 tap show. The real demon poses, re-cut into a hip-hop set (side-to-side rock, raise-the-roof, kicks and turns, freeze cap) over an original boom-bap beat.",
    durMs: FRESH_DUR_MS,
    seq: FRESH_SEQ,
    onsets: FRESH_ONSETS,
    audio: 'synth',
    bob: true
  }
]

export default function DancingDemon(): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [show, setShow] = useState<Show>(SHOWS[0])
  const [playing, setPlaying] = useState(true)
  const [sound, setSound] = useState(false)
  const [speed, setSpeed] = useState(1)
  // bumping `epoch` cleanly restarts the show (dance + audio from t=0)
  const [epoch, setEpoch] = useState(0)

  const stateRef = useRef({ show, playing, speed, epoch })
  stateRef.current = { show, playing, speed, epoch }
  // the audio clock the dance is slaved to (when the tune is on)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const audioStartRef = useRef<number>(0)
  const audioPlayingRef = useRef<boolean>(false)
  const danceMsRef = useRef<number>(0) // current position in the loop (ms)
  const lastRunRef = useRef<string>(SHOWS[0].id + ':0') // fresh start vs resume

  const restart = (): void => setEpoch((e) => e + 1)
  const selectShow = (id: string): void => {
    setShow(SHOWS.find((s) => s.id === id) || SHOWS[0])
    setEpoch((e) => e + 1) // switching shows restarts cleanly
  }

  // ---- scene render + beat-accurate timeline player ----
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.imageSmoothingEnabled = false

    let raf = 0
    let start: number | null = null
    let last = 0
    let curShow = stateRef.current.show
    let curEpoch = stateRef.current.epoch
    // pose whose onset is the largest <= t (binary search; onsets ascending)
    const poseAt = (s: Show, t: number): number[] => {
      const a = s.onsets
      let lo = 0,
        hi = a.length - 1,
        ans = 0
      while (lo <= hi) {
        const mid = (lo + hi) >> 1
        if (a[mid] <= t) { ans = mid; lo = mid + 1 } else hi = mid - 1
      }
      return PRESET_POSES[s.seq[ans]]
    }

    const px = (x: number, y: number): void => ctx.fillRect(x * SCALE_X, y * SCALE_Y, SCALE_X, SCALE_Y)

    const drawTitle = (): void => {
      ctx.fillStyle = PHOSPHOR
      let tx = 31
      for (const ch of 'DANCING DEMON') {
        if (ch === ' ') { tx += 5; continue }
        const glyph = FONT[ch]
        for (let r = 0; r < glyph.length; r++)
          for (let c = 0; c < glyph[r].length; c++) if (glyph[r][c] === '#') px(tx + c, 1 + r)
        tx += 5
      }
    }
    const drawCurtains = (cover: number): void => {
      const width = Math.round(cover * 60) + 2
      ctx.fillStyle = CURTAIN
      for (let y = 1; y <= 44; y++) {
        for (let x = 0; x <= width; x++) if ((x & 1) === 0) px(x, y)
        for (let x = SCENE_W - 1 - width; x <= SCENE_W - 1; x++) if ((x & 1) === 0) px(x, y)
      }
    }
    const drawFloor = (): void => {
      ctx.fillStyle = PHOSPHOR
      for (let x = 4; x <= 123; x++) px(x, FLOOR_Y)
      for (let x = 0; x < SCENE_W; x++) px(x, 0)
    }
    const drawPose = (pose: number[], bobY: number): void => {
      ctx.fillStyle = PHOSPHOR
      for (let r = 0; r < pose.length; r++) {
        const bits = pose[r]
        if (!bits) continue
        for (let c = 0; c < PRESET_W; c++) if ((bits >> (PRESET_W - 1 - c)) & 1) px(DEMON_X + c, DEMON_Y + r + bobY)
      }
    }
    // draw the demon for show `s` at loop position `posMs`
    const drawDemon = (s: Show, posMs: number): void => {
      drawPose(poseAt(s, posMs), s.bob ? freshBob(posMs) : 0)
    }
    const render = (cover: number, s: Show, posMs: number): void => {
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      drawFloor()
      drawTitle()
      drawDemon(s, posMs)
      drawCurtains(cover)
    }

    const RAISE_MS = 1400
    const tick = (t: number): void => {
      if (start === null) { start = t; last = t }
      const { playing: pl, speed: sp, show: s, epoch: ep } = stateRef.current
      // A show switch or Restart resets to the top (and replays the curtain).
      if (s !== curShow || ep !== curEpoch) { curShow = s; curEpoch = ep; danceMsRef.current = 0; start = t }
      const dt = t - last
      last = t
      const elapsed = t - start

      // Dance position within the loop. When the tune is on it's slaved to the
      // audio clock (which freezes when the context is suspended on pause) so
      // footfalls land on the tap clicks; otherwise it free-runs on the rAF clock.
      const ac = audioCtxRef.current
      const dur = curShow.durMs
      let posMs: number
      if (audioPlayingRef.current && ac) {
        posMs = (((ac.currentTime - audioStartRef.current) * sp * 1000) % dur + dur) % dur
        danceMsRef.current = posMs // keep in sync so sound-off hands off smoothly
      } else {
        if (pl) danceMsRef.current = (danceMsRef.current + dt * sp) % dur
        posMs = danceMsRef.current
      }

      if (elapsed < RAISE_MS) render(1 - elapsed / RAISE_MS, curShow, 0)
      else render(0.03, curShow, posMs)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  // ---- audio: one persistent context, cached per-show waveform buffers ----
  const srcRef = useRef<AudioBufferSourceNode | null>(null)
  const bufCacheRef = useRef<Map<string, AudioBuffer>>(new Map())

  // build (once) the audio buffer for a show: the captured square wave for a preset,
  // or our synthesized boom-bap beat for the hip-hop show.
  const getBuffer = (ac: AudioContext, s: Show): AudioBuffer => {
    const cached = bufCacheRef.current.get(s.id)
    if (cached) return cached
    let buf: AudioBuffer
    if (s.audio === 'synth') {
      buf = synthBeat(ac)
    } else {
      const audio = DEMON_AUDIO[s.id] ?? DEMON_AUDIO.show1
      buf = ac.createBuffer(1, audio.durSamples, audio.rate)
      const ch = buf.getChannelData(0)
      let pos = 0
      for (let i = 0; i < audio.deltas.length; i++) {
        const next = pos + audio.deltas[i]
        const v = audio.levels[i] * 0.5 // -1/0/1 -> moderate amplitude
        for (let smp = pos; smp < next && smp < ch.length; smp++) ch[smp] = v
        pos = next
      }
    }
    bufCacheRef.current.set(s.id, buf)
    return buf
  }

  // close the context only when the studio unmounts
  useEffect(() => {
    return () => {
      try { srcRef.current?.stop() } catch { /* already stopped */ }
      void audioCtxRef.current?.close()
      audioCtxRef.current = null
      bufCacheRef.current.clear()
    }
  }, [])

  // Start (or restart) the looping waveform on sound / show / restart. Reuses the
  // persistent context so switching shows is a clean source swap, not a teardown.
  // A fresh start (new show / Restart) begins at t=0; a plain Sound-on resumes from
  // the dance's current position so it doesn't jump.
  useEffect(() => {
    try { srcRef.current?.stop() } catch { /* already stopped */ }
    srcRef.current = null
    audioPlayingRef.current = false
    if (!sound) return
    let ac = audioCtxRef.current
    if (!ac) {
      try {
        const Ctor =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        ac = new Ctor()
        audioCtxRef.current = ac
      } catch {
        return
      }
    }
    const buf = getBuffer(ac, show)
    const durSec = buf.duration
    const tag = `${show.id}:${epoch}`
    const fresh = lastRunRef.current !== tag
    lastRunRef.current = tag
    if (fresh) danceMsRef.current = 0
    const offsetSec = (danceMsRef.current / 1000) % durSec

    const src = ac.createBufferSource()
    src.buffer = buf
    src.loop = true
    src.playbackRate.value = stateRef.current.speed
    const gain = ac.createGain()
    gain.gain.value = 0.5
    src.connect(gain)
    gain.connect(ac.destination)
    const when = ac.currentTime + 0.06
    src.start(when, offsetSec)
    // anchor so posMs == danceMsRef at `when`, then advances with the audio
    audioStartRef.current = when - offsetSec / stateRef.current.speed
    srcRef.current = src
    audioPlayingRef.current = true
    if (!stateRef.current.playing) void ac.suspend()
    else if (ac.state === 'suspended') void ac.resume()
    return () => {
      try { src.stop() } catch { /* already stopped */ }
      if (srcRef.current === src) srcRef.current = null
      audioPlayingRef.current = false
    }
  }, [sound, show, epoch])

  // Play/Pause: suspend/resume the context so the dance (slaved to its clock) and
  // the audio freeze and continue together, in sync.
  useEffect(() => {
    const ac = audioCtxRef.current
    if (ac && audioPlayingRef.current) {
      if (playing) void ac.resume()
      else void ac.suspend()
    }
  }, [playing])

  // live speed control without rebuilding the buffer. Re-anchor the dance clock
  // so posMs stays continuous (and locked to the audio) across a rate change.
  const prevSpeedRef = useRef(1)
  useEffect(() => {
    const src = srcRef.current
    const ac = audioCtxRef.current
    if (src && ac && audioPlayingRef.current) {
      const contentSec = (ac.currentTime - audioStartRef.current) * prevSpeedRef.current
      audioStartRef.current = ac.currentTime - contentSec / speed
      src.playbackRate.value = speed
    }
    prevSpeedRef.current = speed
  }, [speed])

  return (
    <div className="demon-studio">
      <div className="demon-stage">
        <canvas ref={canvasRef} width={SCENE_W * SCALE_X} height={SCENE_H * SCALE_Y} className="demon-canvas" />
      </div>

      <div className="demon-controls">
        <button className="btn btn-sm" onClick={() => setPlaying((p) => !p)}>
          {playing ? '❚❚ Pause' : '▶ Play'}
        </button>
        <button className="btn btn-sm" onClick={restart} title="Restart the show from the top">
          ⟲ Restart
        </button>
        <button
          className={'btn btn-sm' + (sound ? ' on' : '')}
          onClick={() => setSound((s) => !s)}
          title="Toggle the genuine decoded tune (square-wave chiptune)"
        >
          {sound ? '♪ Sound on' : '♪ Sound off'}
        </button>
        <label className="demon-speed">
          Speed
          <input
            type="range"
            min={0.5}
            max={2}
            step={0.1}
            value={speed}
            onChange={(e) => setSpeed(parseFloat(e.target.value))}
          />
          <span>{speed.toFixed(1)}×</span>
        </label>
        <select
          className="demon-select"
          value={show.id}
          onChange={(e) => selectShow(e.target.value)}
        >
          {SHOWS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <p className="demon-blurb">
        <strong>{show.name}.</strong> {show.blurb}{' '}
        {show.audio === 'synth'
          ? 'Danced with the real captured demon poses, re-timed to a synthesized boom-bap beat — turn Sound on.'
          : 'Captured frame-by-frame from the real 1979 program and replayed beat-accurately, footfalls locked to the genuine tap clicks — turn Sound on.'}
      </p>
    </div>
  )
}
