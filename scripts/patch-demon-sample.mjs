// Replace the DEMON sample object in samples.ts with the traced-from-original
// version (code from /tmp/demon_code.json).
import fs from 'node:fs'

const path = 'src/renderer/src/samples.ts'
let src = fs.readFileSync(path, 'utf8')
const codeLines = JSON.parse(fs.readFileSync('/tmp/demon_code.json', 'utf8'))

const q = (s) => "'" + s.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'"
const codeTs = codeLines.map((l) => '      ' + q(l)).join(',\n')

const help = {
  about:
    'A pixel-for-pixel trace of the 1979 Dancing Demon: the figure was captured straight out of the real TRS-80 program running in our emulator, then redrawn here at full 128x48 resolution with SET. The horns, the sly slanted eyes, the splayed feet and every dance pose are the genuine ones.',
  play: [
    'Press RUN: the curtains rise, the band strikes up "Ain\'t She Sweet," and the demon taps.',
    'Click or press a key once so the speaker icon turns green to hear the tune through the app audio.',
    'The dance cycles five real captured poses: home, a right kick, a left kick, arms raised overhead, and a wild crossed-leg kick.'
  ],
  hints: [
    'The five dance poses live in the DATA at 7000+ — each is a 30x30 bitmap traced from the original. Edit the # marks to change a pose.',
    'The routine is the DATA at 8100: sixteen pose numbers (0-4). Re-order them to choreograph your own dance.',
    'The tune is the PLAY string on line 85 (note notation). Faster dance: lower the PAUSE on line 120. Faster music: raise the T value on line 85.',
    'The title font is the DATA at 8000 (letters of DANCIGEMO); the demon is drawn 1:1 by the loop at 500.'
  ]
}
const helpTs =
  '    help: {\n' +
  `      about:\n        ${q(help.about)},\n` +
  '      play: [\n' +
  help.play.map((p) => '        ' + q(p)).join(',\n') +
  '\n      ],\n' +
  '      hints: [\n' +
  help.hints.map((h) => '        ' + q(h)).join(',\n') +
  '\n      ]\n' +
  '    },\n'

const newObj =
  "    name: 'DEMON',\n" +
  "    description:\n      'The Dancing Demon — a pixel-exact trace of the genuine 1979 TRS-80 imp, " +
  "tap-dancing to \"Aint She Sweet\" on a curtained stage. Captured from the real program and redrawn at full resolution.',\n" +
  helpTs +
  '    code: [\n' +
  codeTs +
  "\n    ].join('\\n')"

// Replace from `name: 'DEMON',` up to the first `].join('\n')` that closes it.
const startMarker = "    name: 'DEMON',"
const start = src.indexOf(startMarker)
if (start < 0) throw new Error('DEMON sample not found')
const endMarker = "].join('\\n')"
const endIdx = src.indexOf(endMarker, start)
if (endIdx < 0) throw new Error('end of DEMON code not found')
const endPos = endIdx + endMarker.length

src = src.slice(0, start) + newObj + src.slice(endPos)
fs.writeFileSync(path, src)
console.log('patched DEMON sample;', codeLines.length, 'code lines')
