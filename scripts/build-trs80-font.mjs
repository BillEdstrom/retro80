// Generate an OpenType font from the authentic TRS-80 Model I character
// generator bitmaps that ship inside trs80-emulator-web (originally from the
// xtrs emulator — the real CG ROM dumps, permissively licensed).
//
// We use MODEL1B (the lowercase-modified Model I character generator) so the
// font covers both the stock uppercase experience and the "lowercase mod"
// toggle. Each glyph is a 6x12 bitmap displayed with double-height pixels on
// real hardware, giving the TRS-80's distinctive tall 1:3 character cell.
//
// Output: src/renderer/src/assets/TRS80ModelI.otf
//
// Usage: node scripts/build-trs80-font.mjs
import { MODEL1B_FONT } from 'trs80-emulator-web/dist/Fonts.js'
import opentype from 'opentype.js'
import { writeFileSync, mkdirSync } from 'fs'

const bits = MODEL1B_FONT.bits // 12 bytes per glyph, bit x = pixel column x
const GLYPH_BYTES = 12

// Font metrics: one character cell = 8 px wide x 24 px tall (6 px glyph + 2 px
// gap, 12 rows of double-height pixels) at 100 units/px horizontally and 200
// units/px vertically. Em = cell height, so CSS font-size = cell height and
// width comes out to exactly 1/3 — the authentic TRS-80 aspect.
const PX_W = 100
const PX_H = 200
const ADVANCE = 8 * PX_W
const UNITS_PER_EM = 12 * PX_H // 2400
const ASCENDER = 2000 // cell top; 12 rows of 200 end at -400
const DESCENDER = -400

function glyphPath(code) {
  // Screen codes 32-127 line up with ASCII on the (lowercase-modded) Model I.
  const offset = code * GLYPH_BYTES
  const path = new opentype.Path()
  for (let row = 0; row < 12; row++) {
    const byte = bits[offset + row]
    if (!byte) continue
    // Merge horizontal runs of pixels into single rectangles.
    let col = 0
    while (col < 6) {
      if (byte & (1 << col)) {
        let end = col
        while (end < 6 && byte & (1 << end)) end++
        const x0 = col * PX_W
        const x1 = end * PX_W
        const y1 = ASCENDER - row * PX_H
        const y0 = y1 - PX_H
        path.moveTo(x0, y0)
        path.lineTo(x1, y0)
        path.lineTo(x1, y1)
        path.lineTo(x0, y1)
        path.close()
        col = end
      } else {
        col++
      }
    }
  }
  return path
}

const glyphs = [
  new opentype.Glyph({
    name: '.notdef',
    unicode: 0,
    advanceWidth: ADVANCE,
    path: new opentype.Path()
  })
]

for (let code = 32; code <= 127; code++) {
  glyphs.push(
    new opentype.Glyph({
      name: 'char' + code,
      unicode: code,
      advanceWidth: ADVANCE,
      path: glyphPath(code)
    })
  )
}

// Box-drawing characters (used by the console banner and the BOX sample).
// Drawn to span the full 8px advance so adjacent cells connect, with the
// 2-unit line weight of the bitmap glyphs.
const MID_Y0 = ASCENDER - 7 * PX_H // horizontal bar: rows 6-7
const MID_Y1 = ASCENDER - 5 * PX_H
const MID_X0 = 3 * PX_W // vertical bar: columns 3-4
const MID_X1 = 5 * PX_W
const CELL_TOP = ASCENDER
const CELL_BOT = DESCENDER
const rect = (path, x0, y0, x1, y1) => {
  path.moveTo(x0, y0)
  path.lineTo(x1, y0)
  path.lineTo(x1, y1)
  path.lineTo(x0, y1)
  path.close()
}
const BOX_CHARS = {
  0x2500: (p) => rect(p, 0, MID_Y0, ADVANCE, MID_Y1), // ─
  0x2502: (p) => rect(p, MID_X0, CELL_BOT, MID_X1, CELL_TOP), // │
  0x250c: (p) => {
    rect(p, MID_X0, MID_Y0, ADVANCE, MID_Y1) // ┌
    rect(p, MID_X0, CELL_BOT, MID_X1, MID_Y0)
  },
  0x2510: (p) => {
    rect(p, 0, MID_Y0, MID_X1, MID_Y1) // ┐
    rect(p, MID_X0, CELL_BOT, MID_X1, MID_Y0)
  },
  0x2514: (p) => {
    rect(p, MID_X0, MID_Y0, ADVANCE, MID_Y1) // └
    rect(p, MID_X0, MID_Y1, MID_X1, CELL_TOP)
  },
  0x2518: (p) => {
    rect(p, 0, MID_Y0, MID_X1, MID_Y1) // ┘
    rect(p, MID_X0, MID_Y1, MID_X1, CELL_TOP)
  }
}
for (const [cp, draw] of Object.entries(BOX_CHARS)) {
  const path = new opentype.Path()
  draw(path)
  glyphs.push(
    new opentype.Glyph({
      name: 'box' + Number(cp).toString(16),
      unicode: Number(cp),
      advanceWidth: ADVANCE,
      path
    })
  )
}

const font = new opentype.Font({
  familyName: 'TRS80 Model I',
  styleName: 'Regular',
  unitsPerEm: UNITS_PER_EM,
  ascender: ASCENDER,
  descender: DESCENDER,
  glyphs
})

mkdirSync('src/renderer/src/assets', { recursive: true })
const out = 'src/renderer/src/assets/TRS80ModelI.otf'
writeFileSync(out, Buffer.from(font.toArrayBuffer()))
console.log('wrote', out, '(' + glyphs.length + ' glyphs)')
