// Basic smoke tests for the interpreter. Run with: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { BasicSession, type Host } from './index'

// A host that captures output and feeds canned input lines.
function makeHost(inputs: string[] = []): { host: Host; out: () => string } {
  let buffer = ''
  const queue = [...inputs]
  const store = new Map<string, string>()
  const host: Host = {
    output: (t) => {
      buffer += t
    },
    inputLine: async (prompt) => {
      buffer += prompt // the real host echoes the prompt to the screen
      return queue.shift() ?? ''
    },
    clearScreen: () => {
      buffer = ''
    },
    saveData: (key, values) => store.set(key, JSON.stringify(values)),
    loadData: (key) => {
      const raw = store.get(key)
      return raw === undefined ? null : JSON.parse(raw)
    },
    graphics: () => {},
    delay: () => Promise.resolve(),
    sound: () => Promise.resolve(),
    playSequence: () => {},
    stopSound: () => {}
  }
  return { host, out: () => buffer }
}

async function runProgram(src: string, inputs: string[] = []): Promise<string> {
  const { host, out } = makeHost(inputs)
  const s = new BasicSession(host)
  s.setProgramText(src)
  await s.execute('RUN')
  return out()
}

test('PRINT arithmetic', async () => {
  const o = await runProgram('10 PRINT 2+3*4')
  assert.match(o, /14/)
})

test('string concatenation', async () => {
  const o = await runProgram('10 PRINT "HI " + "THERE"')
  assert.match(o, /HI THERE/)
})

test('FOR/NEXT loop', async () => {
  const o = await runProgram('10 FOR I=1 TO 3\n20 PRINT I\n30 NEXT')
  assert.match(o, /1[\s\S]*2[\s\S]*3/)
})

test('WHILE/WEND loop', async () => {
  const o = await runProgram('10 X=0\n20 WHILE X<3\n30 PRINT X\n40 X=X+1\n50 WEND')
  assert.match(o, /0[\s\S]*1[\s\S]*2/)
})

test('IF/THEN/ELSE', async () => {
  const o = await runProgram('10 IF 5>3 THEN PRINT "YES" ELSE PRINT "NO"')
  assert.match(o, /YES/)
  assert.doesNotMatch(o, /NO/)
})

test('GOSUB/RETURN', async () => {
  const o = await runProgram('10 GOSUB 100\n20 END\n100 PRINT "SUB"\n110 RETURN')
  assert.match(o, /SUB/)
})

test('DATA/READ', async () => {
  const o = await runProgram('10 READ A,B\n20 PRINT A+B\n30 DATA 7, 8')
  assert.match(o, /15/)
})

test('arrays', async () => {
  const o = await runProgram('10 DIM A(5)\n20 A(2)=99\n30 PRINT A(2)')
  assert.match(o, /99/)
})

test('lowercase characters in string literals are preserved', async () => {
  // The data keeps mixed case; only the stock display forces uppercase.
  const o = await runProgram('10 PRINT "Hello, World!"')
  assert.match(o, /Hello, World!/)
})

test('keywords are case-insensitive (lowercase typing works)', async () => {
  const o = await runProgram('10 print "mixed Case"')
  assert.match(o, /mixed Case/)
})

test('SET turns a pixel on, POINT reads it back', async () => {
  const o = await runProgram(
    '10 SET(5,5)\n20 IF POINT(5,5) THEN PRINT "ON"\n30 IF NOT POINT(4,4) THEN PRINT "OFF"'
  )
  assert.match(o, /ON[\s\S]*OFF/)
})

test('RESET turns a pixel back off', async () => {
  const o = await runProgram(
    '10 SET(3,3) : RESET(3,3)\n20 IF POINT(3,3) THEN PRINT "BAD" ELSE PRINT "CLEARED"'
  )
  assert.match(o, /CLEARED/)
  assert.doesNotMatch(o, /BAD/)
})

test('two pixels in the same cell are independent', async () => {
  // (0,0) and (1,0) share a cell but different bits.
  const o = await runProgram(
    '10 SET(0,0) : SET(1,0) : RESET(0,0)\n' +
      '20 IF POINT(1,0) AND NOT POINT(0,0) THEN PRINT "OK"'
  )
  assert.match(o, /OK/)
})

test('POKE / PEEK round-trip in general memory', async () => {
  const o = await runProgram('10 POKE 5000, 42\n20 PRINT PEEK(5000)')
  assert.match(o, /42/)
})

test('PEEK of an unwritten address is 0', async () => {
  const o = await runProgram('10 PRINT PEEK(9999)')
  assert.match(o, /0/)
})

test('POKE to video RAM sets graphics pixels (POINT sees them)', async () => {
  // 191 = 128 | 63: a full 2x3 block in the top-left cell (pixels 0,0..1,2).
  const o = await runProgram(
    '10 POKE 15360, 191\n' +
      '20 IF PEEK(15360) = 191 THEN PRINT "STORED"\n' +
      '30 IF POINT(0,0) AND POINT(1,2) THEN PRINT "PIXELS"'
  )
  assert.match(o, /STORED[\s\S]*PIXELS/)
})

test('values poked are masked to a byte', async () => {
  const o = await runProgram('10 POKE 100, 300\n20 PRINT PEEK(100)')
  assert.match(o, /\b44\b/) // 300 & 255 = 44
})

test('PAUSE delays then continues', async () => {
  const o = await runProgram('10 PRINT "A"\n20 PAUSE 50\n30 PRINT "B"')
  assert.match(o, /A[\s\S]*B/)
})

// A host that records the tones played, for SOUND / PLAY tests.
function soundHost(): {
  host: Host
  tones: { freq: number; ms: number }[]
  bg: { freq: number; ms: number }[][]
  stops: number
} {
  const tones: { freq: number; ms: number }[] = []
  const bg: { freq: number; ms: number }[][] = []
  let stops = 0
  const host: Host = {
    output: () => {},
    inputLine: async () => '',
    clearScreen: () => {},
    saveData: () => {},
    loadData: () => null,
    graphics: () => {},
    delay: () => Promise.resolve(),
    sound: (freq, ms) => {
      tones.push({ freq, ms })
      return Promise.resolve()
    },
    playSequence: (notes) => bg.push(notes),
    stopSound: () => {
      stops++
    }
  }
  return {
    host,
    tones,
    bg,
    get stops() {
      return stops
    }
  }
}

test('SOUND plays a tone of the given frequency and length', async () => {
  const { host, tones } = soundHost()
  const s = new BasicSession(host)
  s.setProgramText('10 SOUND 440, 100')
  await s.execute('RUN')
  assert.equal(tones.length, 1)
  assert.equal(tones[0].freq, 440)
  assert.equal(tones[0].ms, 100)
})

test('PLAY turns a note string into tones (A4 = 440 Hz)', async () => {
  const { host, tones } = soundHost()
  const s = new BasicSession(host)
  s.setProgramText('10 PLAY "O4 L4 A B C"')
  await s.execute('RUN')
  assert.equal(tones.length, 3)
  assert.ok(Math.abs(tones[0].freq - 440) < 0.5) // A4
  assert.ok(tones[1].freq > tones[0].freq) // B4 higher than A4
})

test('PLAY rests and tempo: a rest is silent, tempo sets length', async () => {
  const { host, tones } = soundHost()
  const s = new BasicSession(host)
  s.setProgramText('10 PLAY "T120 L4 C P C"')
  await s.execute('RUN')
  assert.equal(tones.length, 3)
  assert.equal(tones[1].freq, 0) // the rest
  assert.ok(Math.abs(tones[0].ms - 500) < 1) // quarter note at T120 = 500ms
})

test('PLAY "MB ..." plays in the background (non-blocking), not note-by-note', async () => {
  const { host, tones, bg } = soundHost()
  const s = new BasicSession(host)
  s.setProgramText('10 PLAY "MB CDE"\n20 PRINT "AFTER"')
  await s.execute('RUN')
  assert.equal(tones.length, 0) // not played note-by-note (blocking)
  assert.equal(bg.length, 1) // scheduled once as a sequence
  assert.equal(bg[0].length, 3) // C D E
})

test('a run stops any leftover background sound', async () => {
  const sh = soundHost()
  const s = new BasicSession(sh.host)
  s.setProgramText('10 PRINT "HI"')
  await s.execute('RUN')
  assert.ok(sh.stops >= 1) // reset() calls stopSound at run start
})

test('CLS clears graphics pixels', async () => {
  const o = await runProgram(
    '10 SET(10,10)\n20 CLS\n30 IF POINT(10,10) THEN PRINT "STILL ON" ELSE PRINT "CLEAR"'
  )
  assert.match(o, /CLEAR/)
})

test('string functions', async () => {
  const o = await runProgram('10 PRINT LEFT$("HELLO",2); MID$("HELLO",2,3)')
  assert.match(o, /HEELL/)
})

test('nested FOR/NEXT', async () => {
  const o = await runProgram(
    '10 FOR I=1 TO 2\n20 FOR J=1 TO 2\n30 PRINT I*10+J\n40 NEXT J\n50 NEXT I'
  )
  assert.match(o, /11[\s\S]*12[\s\S]*21[\s\S]*22/)
})

test('INPUT', async () => {
  const o = await runProgram('10 INPUT "NAME"; N$\n20 PRINT "HI "; N$', ['WORLD'])
  assert.match(o, /HI WORLD/)
})

test('INPUT with semicolon prompt adds a question mark', async () => {
  const o = await runProgram('10 INPUT "NAME"; N$', ['BOB'])
  assert.match(o, /NAME\? /)
})

test('INPUT with comma prompt shows a bare cursor (no question mark)', async () => {
  const o = await runProgram('10 INPUT ":", C$\n20 PRINT "OK"', ['HI'])
  assert.match(o, /:/)
  assert.doesNotMatch(o, /\?/)
})

test('requestStop aborts a program parked on INPUT (no hang)', async () => {
  // An INPUT whose host promise never resolves — requestStop must still break.
  let buffer = ''
  const host: Host = {
    output: (t) => (buffer += t),
    inputLine: () => new Promise<string>(() => {}), // never resolves
    clearScreen: () => (buffer = ''),
    saveData: () => {},
    loadData: () => null,
    graphics: () => {},
    delay: () => Promise.resolve(),
    sound: () => Promise.resolve(),
    playSequence: () => {},
    stopSound: () => {}
  }
  const s = new BasicSession(host)
  s.setProgramText('10 INPUT A\n20 PRINT "AFTER"')
  const runDone = s.execute('RUN')
  await new Promise((r) => setTimeout(r, 5)) // let it reach the INPUT
  s.requestStop()
  await runDone // must settle, not hang forever
  assert.doesNotMatch(buffer, /AFTER/) // the program did not continue
})

test('STOP reports "Break at" the line with no question mark (TRS-80 style)', async () => {
  const o = await runProgram('10 PRINT "A"\n20 STOP\n30 PRINT "ZZZ"')
  assert.match(o, /Break at 20/i)
  assert.doesNotMatch(o, /\?/) // a break is not an error — no "?"
  assert.doesNotMatch(o, /ZZZ/) // execution stopped at line 20
})

test('REM comment line does not crash', async () => {
  const o = await runProgram('10 REM THIS IS A COMMENT\n20 PRINT "AFTER"')
  assert.match(o, /AFTER/)
  assert.doesNotMatch(o, /\?/) // no error output
})

test("' shorthand comment", async () => {
  const o = await runProgram("10 X = 5 ' set x\n20 PRINT X")
  assert.match(o, /5/)
})

test('REM at end of multi-statement line', async () => {
  const o = await runProgram('10 A = 1 : REM init\n20 PRINT A')
  assert.match(o, /1/)
  assert.doesNotMatch(o, /\?/)
})

test('GOSUB inside a multi-statement THEN returns and continues the branch', async () => {
  const o = await runProgram(
    '10 X=1\n20 IF X=1 THEN GOSUB 100 : PRINT "AFTER"\n30 END\n100 PRINT "SUB"\n110 RETURN'
  )
  // Must print SUB (the GOSUB) then AFTER (the rest of the THEN branch).
  assert.match(o, /SUB[\s\S]*AFTER/)
})

test('IF THEN GOSUB : GOTO routes correctly (adventure-style dispatch)', async () => {
  const o = await runProgram(
    '10 D=3\n20 IF D>0 THEN GOSUB 100 : GOTO 200\n30 PRINT "FELL THROUGH"\n100 PRINT "MOVED"\n110 RETURN\n200 PRINT "DONE" : END'
  )
  assert.match(o, /MOVED[\s\S]*DONE/)
  assert.doesNotMatch(o, /FELL THROUGH/)
})

test('nested IF inside a THEN branch with ELSE routes correctly', async () => {
  // Mirrors the Adventure move dispatch: IF a THEN do : IF b THEN x ELSE y
  const o = await runProgram(
    '10 A=1 : B=0\n' +
      '20 IF A=1 THEN X=5 : IF B=1 THEN 100 ELSE 200\n' +
      '30 PRINT "FELL THROUGH" : END\n' +
      '100 PRINT "B-TRUE" : END\n' +
      '200 PRINT "B-FALSE" : END'
  )
  assert.match(o, /B-FALSE/)
  assert.doesNotMatch(o, /B-TRUE/)
  assert.doesNotMatch(o, /FELL THROUGH/)
})

test('INSTR and UCASE$ work', async () => {
  const o = await runProgram(
    '10 C$ = "get lamp"\n20 P = INSTR(UCASE$(C$), " ")\n30 PRINT P; LEFT$(UCASE$(C$), P-1)'
  )
  assert.match(o, /4 GET/)
})

test('SAVE and LOAD round-trip within a program', async () => {
  const o = await runProgram(
    '10 A=42 : B$="HI"\n20 SAVE "SLOT1", A, B$\n30 A=0 : B$=""\n40 LOAD "SLOT1", A, B$\n50 PRINT A; B$'
  )
  assert.match(o, /42 HI/)
})

test('EXISTS reports whether a save slot exists', async () => {
  const o = await runProgram(
    '10 IF EXISTS("NOPE") THEN PRINT "YES" ELSE PRINT "NO"\n20 SAVE "YEP", 1\n30 IF EXISTS("YEP") THEN PRINT "FOUND"'
  )
  assert.match(o, /NO[\s\S]*FOUND/)
})

test('SAVE persists across separate program runs (shared store)', async () => {
  const store = new Map<string, string>()
  let buf = ''
  const host: Host = {
    output: (t) => (buf += t),
    inputLine: async () => '',
    clearScreen: () => (buf = ''),
    saveData: (k, v) => store.set(k, JSON.stringify(v)),
    loadData: (k) => (store.has(k) ? JSON.parse(store.get(k)!) : null),
    graphics: () => {},
    delay: () => Promise.resolve(),
    sound: () => Promise.resolve(),
    playSequence: () => {},
    stopSound: () => {}
  }
  const s1 = new BasicSession(host)
  s1.setProgramText('10 HP=99 : SAVE "GAME", HP')
  await s1.execute('RUN')
  // A brand-new session/program restores the value.
  const s2 = new BasicSession(host)
  s2.setProgramText('10 HP=0\n20 LOAD "GAME", HP\n30 PRINT HP')
  await s2.execute('RUN')
  assert.match(buf, /99/)
})

test('UNDO restores a deleted line', async () => {
  const { host } = makeHost()
  const s = new BasicSession(host)
  await s.execute('10 PRINT "A"')
  await s.execute('20 PRINT "B"')
  await s.execute('20') // delete line 20
  assert.equal(s.getLine(20), null)
  await s.execute('UNDO')
  assert.equal(s.getLine(20), 'PRINT "B"')
})

test('UNDO restores a line to its previous value after an edit', async () => {
  const { host } = makeHost()
  const s = new BasicSession(host)
  await s.execute('10 PRINT "OLD"')
  await s.execute('10 PRINT "NEW"')
  await s.execute('UNDO')
  assert.equal(s.getLine(10), 'PRINT "OLD"')
})

test('UNDO of NEW brings the program back', async () => {
  const { host } = makeHost()
  const s = new BasicSession(host)
  s.setProgramText('10 PRINT "A"\n20 PRINT "B"')
  await s.execute('NEW')
  assert.equal(s.isEmpty(), true)
  await s.execute('UNDO')
  assert.equal(s.getLine(10), 'PRINT "A"')
  assert.equal(s.getLine(20), 'PRINT "B"')
})

test('UNDO with empty history is safe', async () => {
  const { host, out } = makeHost()
  const s = new BasicSession(host)
  await s.execute('UNDO')
  assert.match(out(), /Nothing to undo/i)
})

test('UNDO history is capped at 30 levels', async () => {
  const { host } = makeHost()
  const s = new BasicSession(host)
  for (let i = 1; i <= 35; i++) await s.execute(`10 PRINT "V${i}"`)
  // 35 edits, only the last 30 pre-states are kept.
  for (let i = 0; i < 30; i++) await s.execute('UNDO')
  assert.equal(s.getLine(10), 'PRINT "V5"') // undone back as far as history allows
  await s.execute('UNDO')
  // 31st undo: nothing left, value unchanged.
  assert.equal(s.getLine(10), 'PRINT "V5"')
})

test('getLine returns a line source (for EDIT), or null', async () => {
  const { host } = makeHost()
  const s = new BasicSession(host)
  s.setProgramText('10 PRINT "HI"\n20 GOTO 10')
  assert.equal(s.getLine(10), 'PRINT "HI"')
  assert.equal(s.getLine(20), 'GOTO 10')
  assert.equal(s.getLine(99), null)
})

test('RENUM renumbers lines and fixes GOTO/GOSUB targets', async () => {
  const { host } = makeHost()
  const s = new BasicSession(host)
  s.setProgramText('5 GOSUB 30\n10 PRINT "A"\n20 GOTO 40\n30 PRINT "B"\n35 RETURN\n40 END')
  await s.execute('RENUM')
  const text = s.getProgramText()
  // 5,10,20,30,35,40 -> 10,20,30,40,50,60; references must follow.
  assert.match(text, /10 GOSUB 40/) // old line 30 is the 4th line -> 40
  assert.match(text, /30 GOTO 60/) // old line 40 is the 6th line -> 60
  assert.match(text, /^10 /m)
  assert.match(text, /60 END/)
})

test('RENUM with custom start and step', async () => {
  const { host } = makeHost()
  const s = new BasicSession(host)
  s.setProgramText('1 PRINT "X"\n2 GOTO 1')
  await s.execute('RENUM 100, 5')
  const text = s.getProgramText()
  assert.match(text, /100 PRINT "X"/)
  assert.match(text, /105 GOTO 100/)
})

test('renumbered program still runs correctly', async () => {
  const { host, out } = makeHost()
  const s = new BasicSession(host)
  s.setProgramText('5 FOR I=1 TO 2\n7 GOSUB 100\n9 NEXT\n11 END\n100 PRINT "HI"\n110 RETURN')
  await s.execute('RENUM')
  await s.execute('RUN')
  assert.match(out(), /HI[\s\S]*HI/)
})

// ---- TRS-80 Level II authenticity (verified against the real ROM in the
// bundled emulator): terse error codes and 16-column print zones ----

test('runtime errors use Level II codes: ?/0 ERROR IN line', async () => {
  const o = await runProgram('10 PRINT 1/0')
  assert.match(o, /\?\/0 ERROR IN 10/)
})

test('runtime errors use Level II codes: ?OD ERROR IN line', async () => {
  const o = await runProgram('10 READ A')
  assert.match(o, /\?OD ERROR IN 10/)
})

test('runtime errors use Level II codes: ?RG ERROR IN line', async () => {
  const o = await runProgram('10 RETURN')
  assert.match(o, /\?RG ERROR IN 10/)
})

test('runtime errors use Level II codes: ?UL ERROR IN line', async () => {
  const o = await runProgram('10 GOTO 999')
  assert.match(o, /\?UL ERROR IN 10/)
})

test('program syntax errors report ?SN ERROR IN line', async () => {
  const o = await runProgram('10 PRINT 2 + * 3')
  assert.match(o, /\?SN ERROR IN 10/)
})

test('extensions without a Level II code keep the descriptive message', async () => {
  const o = await runProgram('10 WEND')
  assert.match(o, /WEND without WHILE/i)
})

test('PRINT comma advances to 16-column zones (Level II)', async () => {
  const o = await runProgram('10 PRINT "AB", "CD"')
  // "AB" then padding to column 16, so "CD" starts at index 16 of the line.
  const line = o.split('\n')[0]
  assert.equal(line.indexOf('CD'), 16)
})

test('direct-mode errors omit the IN clause (Level II)', async () => {
  const { host, out } = makeHost()
  const s = new BasicSession(host)
  await s.execute('PRINT 1/0')
  assert.match(out(), /\?\/0 ERROR\n/)
  assert.doesNotMatch(out(), /IN 0/)
})
