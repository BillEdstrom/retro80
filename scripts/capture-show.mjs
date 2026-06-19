// Capture a preset show's DANCE and AUDIO in one run, on a single Z-80 clock, so
// the studio can lock the demon's footfalls to the tap clicks. Records each
// distinct figure with its onset time AND every cassette-port audio transition,
// both measured from the same t0 (show start). Output: /tmp/demon_show_<key>.json.
import {
  Trs80, Config, ModelType, BasicLevel, CassettePlayer, Trs80Screen, Keyboard
} from 'trs80-emulator'
import { decodeTrs80File } from 'trs80-base'
import { wrapLowSpeed, encodeLowSpeed } from 'trs80-cassette'
import { DEMON_BYTES } from '../src/renderer/src/trs80/dancingDemon.ts'
import fs from 'node:fs'

const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d }
const showKey = arg('--show', '6')
const speed = arg('--speed', '40')
const RATE = 44100

class MemScreen extends Trs80Screen {
  cells = new Array(1024).fill(0x20)
  setConfig() {}
  setExpandedCharacters() {}
  isExpandedCharacters() { return false }
  setAlternateCharacters() {}
  isAlternateCharacters() { return false }
  displayScreenshot() {}
  writeChar(a, v) { const i = a - 15360; if (i >= 0 && i < 1024) this.cells[i] = v }
  text() {
    let s = ''
    for (let i = 0; i < 1024; i++) { let v = this.cells[i]; if (v >= 128) v = 0x20; else if (v < 32) v += 64; s += String.fromCharCode(v) }
    return s
  }
  bitmap() {
    const bm = Array.from({ length: 48 }, () => new Uint8Array(128))
    for (let row = 0; row < 16; row++) for (let col = 0; col < 64; col++) {
      const v = this.cells[row * 64 + col]
      if (v < 128 || v > 191) continue
      const b = v - 128
      for (let i = 0; i < 6; i++) if ((b >> i) & 1) bm[row * 3 + (i >> 1)][col * 2 + (i & 1)] = 1
    }
    return bm
  }
  gkey() {
    let s = ''
    for (let i = 0; i < 1024; i++) { const v = this.cells[i]; s += v >= 128 && v <= 191 ? String.fromCharCode(v) : '.' }
    return s
  }
}
class TapePlayer extends CassettePlayer {
  samplesPerSecond = 44100; idx = 0; motorStopped = false
  constructor(s) { super(); this.samples = s }
  onMotorStart() { this.idx = 0; this.motorStopped = false }
  readSample() { return this.idx < this.samples.length ? this.samples[this.idx++] / 32768 : 0 }
  onMotorStop() { this.motorStopped = true }
}
class RecordingSoundPlayer {
  events = []
  lastV = null
  setAudioValue(left, _r, tStateCount) {
    if (left !== this.lastV) { this.events.push({ t: tStateCount, v: left }); this.lastV = left }
  }
  setFloppyMotorOn() {}
  trackMoved() {}
}

const W = 30, H = 30
const isStructural = (bm, y) => {
  let trans = 0, prev = 0
  for (let x = 42; x <= 80; x++) { if (bm[y][x] !== prev) trans++; prev = bm[y][x] }
  return (bm[y][42] && bm[y][80]) || trans >= 14
}
const extract = (bm) => {
  const ns = []
  for (let y = 12; y <= 46; y++) if (!isStructural(bm, y)) ns.push(y)
  if (!ns.length) return null
  const y0 = ns[0], y1 = ns[ns.length - 1]
  let bestY = y0, bestN = -1
  for (let y = y0; y <= Math.min(y1, y0 + 11); y++) {
    let n = 0
    for (let x = 42; x <= 80; x++) if (bm[y][x]) n++
    if (n > bestN) { bestN = n; bestY = y }
  }
  let hmin = 128, hmax = -1
  for (let x = 42; x <= 80; x++) if (bm[bestY][x]) { if (x < hmin) hmin = x; if (x > hmax) hmax = x }
  if (hmax < 0) return null
  const cx = Math.round((hmin + hmax) / 2), left = cx - (W >> 1)
  let rows = []
  for (let y = y0; y <= y1; y++) {
    let line = ''
    for (let i = 0; i < W; i++) { const x = left + i; line += x >= 0 && x < 128 && bm[y][x] ? '#' : '.' }
    rows.push(line)
  }
  rows = rows.slice(-H)
  while (rows.length < H) rows.unshift('.'.repeat(W))
  return rows
}

const file = decodeTrs80File(DEMON_BYTES, 'dncdm79a.bas')
const config = Config.makeDefault().withModelType(ModelType.MODEL1).withBasicLevel(BasicLevel.LEVEL2)
const screen = new MemScreen()
const keyboard = new Keyboard()
const tape = new TapePlayer(encodeLowSpeed(wrapLowSpeed(file.asCassetteBinary()), 44100, 500))
const sound = new RecordingSoundPlayer()
const machine = new Trs80(config, screen, keyboard, tape, sound)
machine.reset()
const HZ = machine.clockHz
const stepFor = (sec) => { const t = machine.tStateCount + HZ * sec; while (machine.tStateCount < t) machine.step() }
const waitForText = (sub, maxSec = 25) => { let t = 0; while (t < maxSec) { if (screen.text().includes(sub)) return true; stepFor(0.15); t += 0.15 } return false }

stepFor(0.4); keyboard.simulateKeyboardText('\n')
let w = 0
while ((machine.readMemory(0x40a4) | (machine.readMemory(0x40a5) << 8)) < 0x4200 && w < 30) { stepFor(0.2); w += 0.2 }
keyboard.simulateKeyboardText('CLOAD\n'); stepFor(0.3)
let g = 0; while (!tape.motorStopped && g++ < 4000) stepFor(0.25)
stepFor(0.5); keyboard.simulateKeyboardText('RUN\n'); waitForText('MENU')
keyboard.simulateKeyboardText(showKey); waitForText('SPEED', 8)
keyboard.simulateKeyboardText(speed + '\n'); stepFor(0.3)
const audioStart = sound.events.length
const t0 = machine.tStateCount // show start — both clocks measured from here
keyboard.simulateKeyboardText('1\n')

// capture frames + audio together until the audio falls quiet
const rawFrames = [] // { t, rows }
let lastKey = '', t = 0, quiet = 0
while (t < 80) {
  const beforeEv = sound.events.length
  stepFor(0.008); t += 0.008
  const k = screen.gkey()
  if (k !== lastKey) {
    lastKey = k
    const rows = extract(screen.bitmap())
    if (rows && rows.join('').indexOf('#') >= 0) rawFrames.push({ t: machine.tStateCount, rows })
  }
  if (sound.events.length === beforeEv) { quiet += 0.008; if (quiet > 2.5 && sound.events.length > audioStart + 50) break }
  else quiet = 0
}

const endT = machine.tStateCount
const durSamples = Math.round(((endT - t0) / HZ) * RATE)

// frames: keep those held >40ms (drop transient redraws), de-dupe consecutive
const frames = []
for (let i = 0; i < rawFrames.length; i++) {
  const next = i < rawFrames.length - 1 ? rawFrames[i + 1].t : endT
  const holdMs = ((next - rawFrames[i].t) / HZ) * 1000
  if (holdMs < 40) continue
  const onsetMs = Math.round(((rawFrames[i].t - t0) / HZ) * 1000)
  const last = frames[frames.length - 1]
  if (last && last.rows.join('') === rawFrames[i].rows.join('')) continue
  frames.push({ onsetMs: Math.max(0, onsetMs), rows: rawFrames[i].rows })
}

// audio transitions after t0 -> sample offsets + levels
const ev = sound.events.slice(audioStart)
const samples = ev.map((e) => Math.max(0, Math.round(((e.t - t0) / HZ) * RATE)))
const levels = ev.map((e) => e.v)

fs.writeFileSync(`/tmp/demon_show_${showKey}.json`, JSON.stringify({
  show: showKey, rate: RATE, durSamples, frames, samples, levels
}))
console.log(`show ${showKey}: ${frames.length} dance frames, ${ev.length} audio transitions, ${(durSamples / RATE).toFixed(1)}s (locked timeline)`)
