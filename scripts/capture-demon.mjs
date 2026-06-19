// Capture the REAL Dancing Demon's graphics straight out of the emulated video
// RAM, so we can trace it exactly into our own BASIC sprite instead of
// hand-drawing a stick figure. Boots the genuine program, runs it, and dumps
// the 128x48 block-graphics bitmap (lit = '#') at the requested moment(s).
//
// Usage:
//   node scripts/capture-demon.mjs [--at 3]            (title screen)
//   node scripts/capture-demon.mjs --show 6 --at N ... (play preset, dump times)
import {
  Trs80,
  Config,
  ModelType,
  BasicLevel,
  CassettePlayer,
  Trs80Screen,
  SilentSoundPlayer,
  Keyboard
} from 'trs80-emulator'
import { decodeTrs80File } from 'trs80-base'
import { wrapLowSpeed, encodeLowSpeed } from 'trs80-cassette'
import { DEMON_BYTES } from '../src/renderer/src/trs80/dancingDemon.ts'

const arg = (name, def) => {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : def
}
const showKey = arg('--show', null) // press this at the menu to start a show
const sprites = process.argv.includes('--sprites') // emit clean centered sprites
const dumpAts = process.argv
  .filter((a, i) => process.argv[i - 1] === '--at')
  .map(Number) // one or more --at seconds (after RUN)

class MemScreen extends Trs80Screen {
  cells = new Array(1024).fill(0x20)
  setConfig() {}
  setExpandedCharacters() {}
  isExpandedCharacters() {
    return false
  }
  setAlternateCharacters() {}
  isAlternateCharacters() {
    return false
  }
  displayScreenshot() {}
  writeChar(address, value) {
    const i = address - 15360
    if (i >= 0 && i < 1024) this.cells[i] = value
  }
  // Decode the text screen (for menu navigation).
  text() {
    let s = ''
    for (let i = 0; i < 1024; i++) {
      let v = this.cells[i]
      if (v >= 128) v = 0x20
      else if (v < 32) v = v + 64
      s += String.fromCharCode(v)
    }
    return s
  }
  // Decode block-graphics cells into a 128x48 bitmap (1=lit pixel).
  bitmap() {
    const bm = Array.from({ length: 48 }, () => new Uint8Array(128))
    for (let row = 0; row < 16; row++) {
      for (let col = 0; col < 64; col++) {
        const v = this.cells[row * 64 + col]
        if (v < 128 || v > 191) continue // not a graphics block
        const bits = v - 128
        for (let b = 0; b < 6; b++) {
          if ((bits >> b) & 1) {
            const px = col * 2 + (b & 1)
            const py = row * 3 + (b >> 1)
            bm[py][px] = 1
          }
        }
      }
    }
    return bm
  }
}

class TapePlayer extends CassettePlayer {
  samplesPerSecond = 44100
  idx = 0
  motorStopped = false
  constructor(samples) {
    super()
    this.samples = samples
  }
  onMotorStart() {
    this.idx = 0
    this.motorStopped = false
  }
  readSample() {
    return this.idx < this.samples.length ? this.samples[this.idx++] / 32768 : 0
  }
  onMotorStop() {
    this.motorStopped = true
  }
}

const file = decodeTrs80File(DEMON_BYTES, 'dncdm79a.bas')
const config = Config.makeDefault().withModelType(ModelType.MODEL1).withBasicLevel(BasicLevel.LEVEL2)
const screen = new MemScreen()
const keyboard = new Keyboard()
const tape = new TapePlayer(encodeLowSpeed(wrapLowSpeed(file.asCassetteBinary()), 44100, 500))
const machine = new Trs80(config, screen, keyboard, tape, new SilentSoundPlayer())
machine.reset()
const HZ = machine.clockHz
const stepFor = (sec) => {
  const t = machine.tStateCount + HZ * sec
  while (machine.tStateCount < t) machine.step()
}
const hold = (ch) => {
  if (ch === '\n') ch = 'Enter'
  for (let k = 0; k < 4; k++) keyboard.keyEvent(ch, true)
  keyboard.keyEvent(ch, false)
}

// Boot, answer MEMORY SIZE, wait for READY, CLOAD, RUN.
stepFor(0.4)
keyboard.simulateKeyboardText('\n')
let w = 0
while ((machine.readMemory(0x40a4) | (machine.readMemory(0x40a5) << 8)) < 0x4200 && w < 30) {
  stepFor(0.2)
  w += 0.2
}
keyboard.simulateKeyboardText('CLOAD\n')
stepFor(0.3)
let g = 0
while (!tape.motorStopped && g++ < 4000) stepFor(0.25)
stepFor(0.5)
keyboard.simulateKeyboardText('RUN\n')

const waitForText = (sub, maxSec = 25) => {
  let t = 0
  while (t < maxSec) {
    if (screen.text().includes(sub)) return true
    stepFor(0.15)
    t += 0.15
  }
  return false
}

// In show mode the original draws a full-screen curtain backdrop above the
// figure; restrict to the demon's window (below the backdrop, inside the
// borders) so we capture just the dancer.
const REGION = showKey ? { x0: 42, x1: 80, y0: 12, y1: 45 } : { x0: 0, x1: 127, y0: 0, y1: 47 }
const dumpBitmap = (label) => {
  const bm = screen.bitmap()
  // bounding box (within the region)
  let minX = 128,
    maxX = -1,
    minY = 48,
    maxY = -1
  for (let y = REGION.y0; y <= REGION.y1; y++)
    for (let x = REGION.x0; x <= REGION.x1; x++)
      if (bm[y][x]) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
  console.log(`\n===== ${label} =====`)
  if (maxX < 0) {
    console.log('(no graphics on screen)')
    return
  }
  console.log(`bbox x:${minX}-${maxX} (${maxX - minX + 1}w) y:${minY}-${maxY} (${maxY - minY + 1}h)`)
  for (let y = minY; y <= maxY; y++) {
    let line = ''
    for (let x = minX; x <= maxX; x++) line += bm[y][x] ? '#' : '.'
    console.log(line)
  }
}

if (showKey) {
  waitForText('MENU') // wait for the title to advance to the menu
  hold(showKey) // 6 or 7 = preset show
  waitForText('SPEED')
  hold('3')
  hold('0')
  hold('\n') // speed factor 30
  waitForText('PERFORMANCE')
  hold('1')
  hold('\n') // 1 performance
  waitForText('BEGIN', 8) // LET THE SHOW BEGIN
  // Sample the dance and keep frames whose LOWER BODY (arms/legs/feet, below the
  // occluding curtain) differs — so we capture real limb movement, not just the
  // head bobbing in and out behind the backdrop.
  const seen = new Set()
  let kept = 0
  let last = ''
  // Lower-body key: pixels in the figure window, rows 28..45 (arms/legs/feet).
  const lowerKey = (bm) => {
    let s = ''
    for (let y = 28; y <= 45; y++) for (let x = 44; x <= 78; x++) s += bm[y][x] ? '1' : '.'
    return s
  }
  const frames = []
  for (let t = 0; t < 40 && kept < 60; t += 0.08) {
    stepFor(0.08)
    const bm = screen.bitmap()
    const key = lowerKey(bm)
    if (key === last) continue
    last = key
    if (key.indexOf('1') < 0) continue // blank
    if (seen.has(key)) continue
    seen.add(key)
    kept++
    frames.push(bm.map((r) => Uint8Array.from(r))) // snapshot
    if (!sprites) dumpBitmap(`frame ${kept} (t+${t.toFixed(2)})`)
  }

  if (sprites) {
    // Strip the curtain (top) and floor (bottom) backdrop, isolate the demon,
    // and emit a centered 1x sprite for each curated frame.
    const W = 30 // sprite width (pixels), centered
    const isStructural = (bm, y) => {
      // full-width bar / curtain / floor: lit at both crop edges, or a very
      // busy (high-transition) striped texture row.
      let trans = 0,
        prev = 0
      for (let x = 42; x <= 80; x++) {
        if (bm[y][x] !== prev) trans++
        prev = bm[y][x]
      }
      const edges = bm[y][42] && bm[y][80]
      return edges || trans >= 14
    }
    const extract = (bm) => {
      // demon rows = contiguous non-structural band between curtain and floor
      const nonStruct = []
      for (let y = 12; y <= 46; y++) if (!isStructural(bm, y)) nonStruct.push(y)
      if (!nonStruct.length) return null
      const y0 = nonStruct[0]
      const y1 = nonStruct[nonStruct.length - 1]
      // Center on the HEAD: use the widest solid head row (the face/skull), which
      // sits on the body's vertical axis, so arms/legs swing but the head holds
      // steady between poses. Scan the upper third for the row with the most lit
      // pixels and take its midpoint.
      let bestY = y0,
        bestN = -1
      for (let y = y0; y <= Math.min(y1, y0 + 11); y++) {
        let n = 0
        for (let x = 42; x <= 80; x++) if (bm[y][x]) n++
        if (n > bestN) {
          bestN = n
          bestY = y
        }
      }
      let hminX = 128,
        hmaxX = -1
      for (let x = 42; x <= 80; x++)
        if (bm[bestY][x]) {
          if (x < hminX) hminX = x
          if (x > hmaxX) hmaxX = x
        }
      const cx = Math.round((hminX + hmaxX) / 2)
      const left = cx - Math.floor(W / 2)
      const rows = []
      for (let y = y0; y <= y1; y++) {
        let line = ''
        for (let i = 0; i < W; i++) {
          const x = left + i
          line += x >= 0 && x < 128 && bm[y][x] ? '#' : '.'
        }
        rows.push(line)
      }
      return rows
    }
    const H = 30 // sprite height; bottom-align so feet rest on the floor
    const pad = (rows) => {
      const out = rows.slice(-H)
      while (out.length < H) out.unshift('.'.repeat(W))
      return out
    }
    const curated = (arg('--frames', '') || '')
      .split(',')
      .map(Number)
      .filter((n) => n > 0)
    const pick = curated.length ? curated : frames.map((_, i) => i + 1)
    const out = []
    for (const fn of pick) {
      const bm = frames[fn - 1]
      if (!bm) continue
      const rows = extract(bm)
      if (!rows) continue
      const padded = pad(rows)
      out.push({ frame: fn, rows: padded })
      console.log(`\n===== SPRITE frame ${fn} (${W}w x ${H}h) =====`)
      padded.forEach((r) => console.log(r))
    }
    const fs = await import('node:fs')
    fs.writeFileSync('/tmp/demon_sprites.json', JSON.stringify(out, null, 0))
    console.log(`\nwrote ${out.length} sprites -> /tmp/demon_sprites.json`)
  }
} else {
  const targets = dumpAts.length ? dumpAts.slice().sort((a, b) => a - b) : [3]
  let elapsed = 0
  for (const t of targets) {
    stepFor(Math.max(0, t - elapsed))
    elapsed = t
    dumpBitmap(`t+${t}s`)
  }
}
