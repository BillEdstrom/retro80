// Headless smoke-test for TRS-80 programs: boots the real emulator in Node,
// loads a program (cassette CLOAD for BASIC tapes, direct load for SYSTEM/CMD),
// runs it for a few emulated seconds, and dumps the text screen.
//
// Usage: node scripts/trs80-smoke.mjs <file> [--seconds N] [--type "TEXT\n"]
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
import { readFileSync } from 'fs'

const file = process.argv[2]
const secsArg = process.argv.indexOf('--seconds')
const runSeconds = secsArg >= 0 ? Number(process.argv[secsArg + 1]) : 8
const typeArg = process.argv.indexOf('--type')
const typeText = typeArg >= 0 ? process.argv[typeArg + 1].replaceAll('\\n', '\n') : null

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
  text() {
    const rows = []
    for (let r = 0; r < 16; r++) {
      let line = ''
      for (let c = 0; c < 64; c++) {
        let v = this.cells[r * 64 + c]
        if (v >= 128) v = 0x23 // graphics block -> '#'
        else if (v < 32) v = v + 64 // control area shows letters on Model I
        line += String.fromCharCode(v)
      }
      rows.push(line.trimEnd())
    }
    return rows.join('\n')
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

const bytes = new Uint8Array(readFileSync(file))
const decoded = decodeTrs80File(bytes, file.split('/').pop())
console.log('decoded:', decoded.className, decoded.error ?? '')

// For cassettes, look at what's inside to pick a load strategy.
let inner = decoded
if (decoded.className === 'Cassette') {
  inner = decoded.files[0].file
  console.log(
    'cassette contents:',
    decoded.files.map((f) => f.file.className).join(', ')
  )
}
const viaCassette = inner.className === 'BasicProgram'

const config = Config.makeDefault()
  .withModelType(ModelType.MODEL1)
  .withBasicLevel(BasicLevel.LEVEL2)
const screen = new MemScreen()
const keyboard = new Keyboard()
const tape = viaCassette
  ? new TapePlayer(encodeLowSpeed(wrapLowSpeed(inner.asCassetteBinary()), 44100, 500))
  : new TapePlayer(new Int16Array(0))
const sound = new SilentSoundPlayer()
const machine = new Trs80(config, screen, keyboard, tape, sound)
machine.reset()

const HZ = machine.clockHz
const stepFor = (seconds) => {
  const target = machine.tStateCount + HZ * seconds
  while (machine.tStateCount < target) machine.step()
}

// Boot: answer MEMORY SIZE? then wait for READY.
stepFor(0.4)
keyboard.simulateKeyboardText('\n')
let waited = 0
while ((machine.readMemory(0x40a4) | (machine.readMemory(0x40a5) << 8)) < 0x4200 && waited < 30) {
  stepFor(0.2)
  waited += 0.2
}
console.log('READY after ~' + waited.toFixed(1) + 's emulated')

if (viaCassette) {
  keyboard.simulateKeyboardText('CLOAD\n')
  stepFor(0.3)
  let guard = 0
  while (!tape.motorStopped && guard++ < 4000) stepFor(0.25)
  console.log('tape done, motorStopped=' + tape.motorStopped)
  stepFor(0.5)
  keyboard.simulateKeyboardText('RUN\n')
} else {
  machine.runTrs80File(decoded)
}

stepFor(runSeconds)
if (typeText) {
  // Hold each key for ~3 queue slots (~84ms emulated): machine-language games
  // scan the keyboard matrix themselves and can miss a single-slot press.
  for (let ch of typeText) {
    if (ch === '\n') ch = 'Enter'
    keyboard.keyEvent(ch, true)
    keyboard.keyEvent(ch, true)
    keyboard.keyEvent(ch, true)
    keyboard.keyEvent(ch, false)
  }
  stepFor(45)
}
console.log('---- screen ----')
console.log(screen.text())
