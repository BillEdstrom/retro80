// "Fresh 80" — an original hip-hop routine danced with the REAL captured demon
// poses (the expert 1979 animation), arranged punchily to a synthesized old-school
// boom-bap beat. Not the tap show: the hip-hop feel comes from the beat plus sharp
// on-beat pose hits — a side-to-side rock, raise-the-roof on the backbeat, kicks
// and turns, and a freeze cap — with a subtle groove bounce.

export const BPM = 90
const BEAT_MS = 60000 / BPM // 666.67
const BAR_MS = BEAT_MS * 4
export const BARS = 8
export const FRESH_DUR_MS = Math.round(BARS * BAR_MS)

// Curated pose vocabulary (indices into PRESET_POSES).
const V = {
  HOME: 11, // neutral standing, sly-eyes face
  ARMS_UP: 87, // both arms up (raise the roof)
  OUT: 18, // arms thrown out, split-step
  KICK: 23, // lunge / leg kick out
  TURN: 88, // body twist / turn
  LEAN_L: 115, // hard lean left
  LEAN_R: 73 // lean right, leg out
}

// The routine as (pose, beats) — sums to BARS*4 = 32 beats.
const ROUTINE: [number, number][] = [
  // bars 1-2: side-to-side rock (the groove)
  [V.LEAN_L, 1], [V.LEAN_R, 1], [V.LEAN_L, 1], [V.LEAN_R, 1],
  [V.LEAN_L, 1], [V.LEAN_R, 1], [V.LEAN_L, 1], [V.LEAN_R, 1],
  // bars 3-4: raise the roof on the backbeat
  [V.HOME, 1], [V.ARMS_UP, 1], [V.HOME, 1], [V.ARMS_UP, 1],
  [V.HOME, 1], [V.ARMS_UP, 1], [V.HOME, 1], [V.ARMS_UP, 1],
  // bar 5: kicks & turns
  [V.KICK, 1], [V.TURN, 1], [V.KICK, 1], [V.TURN, 1],
  // bar 6: split-step bounces
  [V.OUT, 1], [V.HOME, 1], [V.OUT, 1], [V.HOME, 1],
  // bar 7: fast double-time rock (8th notes)
  [V.LEAN_L, 0.5], [V.LEAN_R, 0.5], [V.LEAN_L, 0.5], [V.LEAN_R, 0.5],
  [V.LEAN_L, 0.5], [V.LEAN_R, 0.5], [V.LEAN_L, 0.5], [V.LEAN_R, 0.5],
  // bar 8: freeze cap — arms up, then a turn-and-hold
  [V.ARMS_UP, 2], [V.TURN, 2]
]

export const FRESH_SEQ: number[] = []
export const FRESH_ONSETS: number[] = []
{
  let t = 0
  for (const [pose, beats] of ROUTINE) {
    FRESH_SEQ.push(pose)
    FRESH_ONSETS.push(Math.round(t))
    t += beats * BEAT_MS
  }
}

// Subtle groove bounce: the demon dips on each beat (knees-bend nod). Returns a
// small vertical offset in scene pixels.
export function freshBob(posMs: number): number {
  const ph = (posMs / BEAT_MS) % 1
  return Math.round((Math.cos(ph * 2 * Math.PI) + 1) / 2) // 0 or 1 px, lowest on the beat
}

// ---------- the beat (old-school boom-bap) ----------
const noiseHit = (ch: Float32Array, rate: number, at: number, durS: number, amp: number, decay: number): void => {
  const n = Math.floor(durS * rate)
  for (let i = 0; i < n; i++) {
    const s = at + i
    if (s >= ch.length) break
    ch[s] += (Math.random() * 2 - 1) * amp * Math.exp((-i / rate) * decay)
  }
}
const tone = (ch: Float32Array, rate: number, at: number, durS: number, f0: number, f1: number, amp: number, decay: number, square: boolean): void => {
  const n = Math.floor(durS * rate)
  let phase = 0
  for (let i = 0; i < n; i++) {
    const s = at + i
    if (s >= ch.length) break
    const f = f0 + (f1 - f0) * (i / n)
    phase += (f / rate) * 2 * Math.PI
    const v = square ? (Math.sin(phase) >= 0 ? 1 : -1) : Math.sin(phase)
    ch[s] += v * amp * Math.exp((-i / rate) * decay)
  }
}
const NOTE: Record<string, number> = { A1: 55, C2: 65.4, D2: 73.4, E2: 82.4, G2: 98, A2: 110 }

export function synthBeat(ac: AudioContext): AudioBuffer {
  const rate = ac.sampleRate
  const durS = FRESH_DUR_MS / 1000
  const buf = ac.createBuffer(1, Math.ceil(durS * rate), rate)
  const ch = buf.getChannelData(0)
  const stepS = (BEAT_MS / 4) / 1000 // 16th note
  const at = (bar: number, step: number): number => Math.floor((bar * 16 + step) * stepS * rate)
  const bassRiff = ['A1', 'A1', 'C2', 'E2', 'G2', 'A1', 'D2', 'E2']
  for (let bar = 0; bar < BARS; bar++) {
    for (const st of [0, 6, 10]) tone(ch, rate, at(bar, st), 0.14, 90, 42, 0.85, 16, false) // kick
    for (const st of [4, 12]) { noiseHit(ch, rate, at(bar, st), 0.16, 0.5, 22); tone(ch, rate, at(bar, st), 0.12, 190, 150, 0.3, 26, false) } // snare
    for (let st = 0; st < 16; st += 2) noiseHit(ch, rate, at(bar, st), st % 4 === 2 ? 0.06 : 0.025, 0.18, st % 4 === 2 ? 40 : 90) // hats
    for (let b = 0; b < 4; b++) { const note = bassRiff[(bar * 4 + b) % bassRiff.length]; tone(ch, rate, at(bar, b * 4), 0.5, NOTE[note], NOTE[note], 0.32, 4, true) } // bass
    if (bar === BARS - 1) for (const st of [10, 12, 14]) noiseHit(ch, rate, at(bar, st), 0.1, 0.45, 30) // fill
  }
  for (let i = 0; i < ch.length; i++) ch[i] = Math.tanh(ch[i] * 1.2) * 0.6 // soft clip
  return buf
}
