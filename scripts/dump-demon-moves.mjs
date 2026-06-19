// Drive the REAL Dancing Demon engine to dump authoritative per-move animation
// data. For each move letter A-Z we build a one-move routine in the editor
// (CLEAR = "\\" resets it), memorize it, and play it via menu option 3 (mode 28)
// in slow motion, recording every settled frame the 1979 machine code draws plus
// the Z-80 time it was held. Output: genuine frames + timing for each named move.
//
//   node scripts/dump-demon-moves.mjs --speed 160 --reps 2
import {
  Trs80, Config, ModelType, BasicLevel, CassettePlayer, Trs80Screen, SilentSoundPlayer, Keyboard
} from 'trs80-emulator'
import { decodeTrs80File } from 'trs80-base'
import { wrapLowSpeed, encodeLowSpeed } from 'trs80-cassette'
import { DEMON_BYTES } from '../src/renderer/src/trs80/dancingDemon.ts'
import fs from 'node:fs'

const arg = (n, d) => {
  const i = process.argv.indexOf(n)
  return i >= 0 ? process.argv[i + 1] : d
}
const speed = arg('--speed', '160')
const reps = Number(arg('--reps', '2'))
const only = arg('--only', null) // e.g. "A" to dump one move

const MOVE_TABLE = {
  A: ['STEP#1', 2], B: ['STEP#2', 2], C: ['STEP#3', 2], D: ['STEP#4-L', 2], E: ['STEP#4-R', 2],
  F: ['STEP#5-L', 2], G: ['STEP#5-R', 2], H: ['STEP#6', 3], I: ['STEP#7', 4], J: ['SQUAT', 1],
  K: ['STAND', 1], L: ['STOMP#1-L', 1], M: ['STOMP#1-R', 1], N: ['STOMP#2-L', 4], O: ['STOMP#2-R', 4],
  P: ['TURN-L', 2], Q: ['TURN-R', 2], R: ['MOVE#1-L', 1], S: ['MOVE#1-R', 1], T: ['MOVE#2-L', 2],
  U: ['MOVE#2-R', 2], V: ['MOVE#3-L', 2], W: ['MOVE#3-R', 2], X: ['FAST-JUMP', 1], Y: ['SPIN-JUMP', 2],
  Z: ['SLOW-JUMP', 2]
}

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

const file = decodeTrs80File(DEMON_BYTES, 'dncdm79a.bas')
const config = Config.makeDefault().withModelType(ModelType.MODEL1).withBasicLevel(BasicLevel.LEVEL2)
const screen = new MemScreen()
const keyboard = new Keyboard()
const tape = new TapePlayer(encodeLowSpeed(wrapLowSpeed(file.asCassetteBinary()), 44100, 500))
const machine = new Trs80(config, screen, keyboard, tape, new SilentSoundPlayer())
machine.reset()
const HZ = machine.clockHz
const stepFor = (sec) => { const t = machine.tStateCount + HZ * sec; while (machine.tStateCount < t) machine.step() }
const waitForText = (sub, maxSec = 25) => { let t = 0; while (t < maxSec) { if (screen.text().includes(sub)) return true; stepFor(0.15); t += 0.15 } return false }
const sk = (s, after = 0.3) => { keyboard.simulateKeyboardText(s); stepFor(after) }

// ---- clean figure extraction (curtain/floor strip + head-centre), as capture-demon ----
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

// Boot -> menu -> editor.
stepFor(0.4); keyboard.simulateKeyboardText('\n')
let w = 0
while ((machine.readMemory(0x40a4) | (machine.readMemory(0x40a5) << 8)) < 0x4200 && w < 30) { stepFor(0.2); w += 0.2 }
keyboard.simulateKeyboardText('CLOAD\n'); stepFor(0.3)
let g = 0; while (!tape.motorStopped && g++ < 4000) stepFor(0.25)
stepFor(0.5); keyboard.simulateKeyboardText('RUN\n'); waitForText('MENU')
sk('2'); waitForText('ROUTINE', 8); stepFor(0.4)

const dumpMove = (letter) => {
  // reset routine, enter the move `reps` times, memorise, play it.
  sk('\\', 0.3) // CLEAR — start over
  for (let r = 0; r < reps; r++) sk(letter, 0.22)
  sk('\n', 0.5) // memorise -> menu
  waitForText('MENU', 6)
  sk('3', 0.4) // play current routine
  waitForText('SPEED', 6)
  sk(speed + '\n', 0.5)
  keyboard.simulateKeyboardText('1\n') // performances -> play starts
  stepFor(0.1)

  // record settled frames during the performance
  const t0 = machine.tStateCount
  const raw = []
  let lastKey = '', lastChange = machine.tStateCount, t = 0
  while (t < 40) {
    stepFor(0.01); t += 0.01
    const k = screen.gkey()
    if (k !== lastKey) {
      lastKey = k; lastChange = machine.tStateCount
      raw.push({ us: Math.round(((machine.tStateCount - t0) / HZ) * 1e6), bm: screen.bitmap() })
    } else if (machine.tStateCount - lastChange > HZ * 3 && raw.length > 2) break
  }
  // keep frames held > 40ms (drop mid-redraw partials), then extract clean figure
  const frames = []
  for (let i = 0; i < raw.length; i++) {
    const hold = i < raw.length - 1 ? Math.round((raw[i + 1].us - raw[i].us) / 1000) : 0
    if (hold < 40) continue
    const rows = extract(raw[i].bm)
    if (rows) frames.push({ holdMs: hold, rows })
  }
  // de-dupe consecutive identical poses
  const dedup = []
  for (const f of frames) {
    const last = dedup[dedup.length - 1]
    if (last && last.rows.join('') === f.rows.join('')) last.holdMs += f.holdMs
    else dedup.push(f)
  }
  waitForText('MENU', 8) // performance ends -> back to menu
  sk('2'); waitForText('ROUTINE', 6); stepFor(0.3) // re-enter editor for next move
  return dedup
}

const out = {}
const letters = only ? only.toUpperCase().split('') : Object.keys(MOVE_TABLE)
for (const L of letters) {
  const frames = dumpMove(L)
  const [name, beats] = MOVE_TABLE[L]
  const total = frames.reduce((a, f) => a + f.holdMs, 0)
  out[L] = { name, beats, frames }
  console.log(`${L} ${name} (${beats}b): ${frames.length} frames, ${total}ms total, holds=[${frames.map((f) => f.holdMs).join(',')}]`)
}
fs.writeFileSync('/tmp/demon_moves.json', JSON.stringify({ speed: Number(speed), reps, moves: out }))
console.log('\nwrote /tmp/demon_moves.json')
