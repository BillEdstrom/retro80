// Run a BASIC program through OUR interpreter headlessly and dump the graphics
// screen at each PAUSE, so we can verify how the Dancing Demon actually renders
// in Retro80 before shipping. Reads program lines from /tmp/demon_code.json (or
// --file path); dumps the frames listed in --frames (1-based, after curtain).
import fs from 'node:fs'
import { BasicSession } from '../src/renderer/src/basic/index.ts'

const arg = (n, d) => {
  const i = process.argv.indexOf(n)
  return i >= 0 ? process.argv[i + 1] : d
}
const file = arg('--file', '/tmp/demon_code.json')
const want = (arg('--frames', '1,2,3,4,5,6,7,8') || '').split(',').map(Number)
const code = JSON.parse(fs.readFileSync(file, 'utf8')).join('\n')

// Decode a 1024-cell TRS-80 graphics buffer into a 128x48 bitmap.
const decode = (cells) => {
  const bm = Array.from({ length: 48 }, () => new Uint8Array(128))
  for (let row = 0; row < 16; row++)
    for (let col = 0; col < 64; col++) {
      const v = cells[row * 64 + col]
      if (v < 128 || v > 191) continue
      const bits = v - 128
      for (let b = 0; b < 6; b++)
        if ((bits >> b) & 1) bm[row * 3 + (b >> 1)][col * 2 + (b & 1)] = 1
    }
  return bm
}

const frames = []
let lastCells = null
const host = {
  output() {},
  inputLine: async () => '',
  clearScreen() {},
  saveData() {},
  loadData: () => null,
  graphics(cells) {
    lastCells = cells ? cells.slice() : null
  },
  delay: async () => {
    if (lastCells) frames.push(lastCells.slice()) // snapshot a fully-drawn frame
  },
  sound: async () => {},
  playSequence() {},
  stopSound() {}
}

const session = new BasicSession(host)
session.setProgramText(code)
await session.execute('RUN')

// Curtain-raise produces the first ~15 frames; the dance follows.
const curtain = 15
console.log(`captured ${frames.length} frames (skipping ~${curtain} curtain frames)`)
for (const f of want) {
  const idx = curtain + f - 1
  const cells = frames[idx]
  if (!cells) continue
  const bm = decode(cells)
  // trim to figure bbox
  let minX = 128,
    maxX = -1,
    minY = 48,
    maxY = -1
  for (let y = 0; y < 48; y++)
    for (let x = 0; x < 128; x++)
      if (bm[y][x]) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
  console.log(`\n===== dance frame ${f} (buf ${idx}) =====`)
  if (maxX < 0) {
    console.log('(blank)')
    continue
  }
  for (let y = minY; y <= maxY; y++) {
    let line = ''
    for (let x = minX; x <= maxX; x++) line += bm[y][x] ? '#' : '.'
    console.log(line)
  }
}
