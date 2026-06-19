// The Retro80 runtime engine.
//
// It runs a flat list of statements (the "compiled" program) using a classic
// line-numbered execution model: a program counter into the flat statement
// list, with GOTO/GOSUB/FOR/WHILE handled by jumping that counter.
//
// State (variables, arrays, DATA pointer) persists between RUN and immediate
// commands, just like a vintage BASIC, so you can PRINT a variable after a run.

import type { Expr, Stmt, LValue, PrintItem } from './ast'
import { BUILTINS, BUILTIN_ARITY, basicNumberToString, type BasicValue } from './builtins'
import { BasicRuntimeError } from './errors'

export interface Host {
  // Write text exactly as given (the engine inserts its own newlines).
  output(text: string): void
  // Read one line of input from the user (for INPUT).
  inputLine(prompt: string): Promise<string>
  // Clear the screen (CLS).
  clearScreen(): void
  // Persist a list of values under a key (SAVE). Synchronous key/value store.
  saveData(key: string, values: BasicValue[]): void
  // Restore values previously saved under a key (LOAD), or null if none.
  loadData(key: string): BasicValue[] | null
  // Render the graphics screen: a 1024-byte cell buffer (64x16 cells, each a
  // TRS-80 video code; graphics codes 128-191 carry 2x3 pixels). null hides it.
  graphics(cells: number[] | null): void
  // Resolve after roughly `ms` milliseconds (for PAUSE / animation pacing).
  delay(ms: number): Promise<void>
  // Play a square-wave tone of `freq` Hz for `ms` ms (freq 0 = silence/rest),
  // resolving when it finishes. Used by SOUND and blocking PLAY.
  sound(freq: number, ms: number): Promise<void>
  // Schedule a whole tune to play in the background and return immediately
  // (PLAY "MB ..."), so the program can keep running (e.g. animating).
  playSequence(notes: { freq: number; ms: number }[]): void
  // Stop all sound immediately (Stop button / new run).
  stopSound(): void
}

// Parse a small Music Macro Language subset for PLAY into a list of notes.
// Supported: A-G with #/+/- accidentals, O<n> octave, > / < octave shift,
// L<n> default length, T<n> tempo, P/R rests, a length digit after a note,
// and trailing dots for dotted notes. Unknown characters are ignored.
interface MmlNote {
  freq: number // 0 = rest
  ms: number
}
export interface ParsedTune {
  notes: MmlNote[]
  background: boolean // MB = play in background, MF (default) = blocking
}
export function parseMML(src: string): ParsedTune {
  const s = src.toUpperCase()
  let octave = 4
  let defLen = 4
  let tempo = 120
  let background = false
  const out: MmlNote[] = []
  const semitone: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
  let i = 0
  const wholeMs = (): number => 240000 / tempo
  const lengthMs = (n: number, dots: number): number => {
    let d = wholeMs() / n
    let add = d
    for (let k = 0; k < dots; k++) {
      add /= 2
      d += add
    }
    return d
  }
  const readNum = (def: number): number => {
    const start = i
    while (i < s.length && s[i] >= '0' && s[i] <= '9') i++
    return i > start ? parseInt(s.slice(start, i), 10) : def
  }
  const readDots = (): number => {
    let dots = 0
    while (s[i] === '.') {
      dots++
      i++
    }
    return dots
  }
  while (i < s.length) {
    const c = s[i++]
    if (c === ' ' || c === '\t') continue
    if (c === 'M') {
      // MB = music background, MF = music foreground (blocking).
      const m = s[i]
      if (m === 'B') {
        background = true
        i++
      } else if (m === 'F') {
        background = false
        i++
      }
    } else if (c === 'O') {
      octave = readNum(octave)
    } else if (c === 'L') {
      defLen = readNum(defLen)
    } else if (c === 'T') {
      tempo = Math.max(1, readNum(tempo))
    } else if (c === '>') {
      octave++
    } else if (c === '<') {
      octave--
    } else if (c === 'P' || c === 'R') {
      const n = readNum(defLen)
      out.push({ freq: 0, ms: lengthMs(n, readDots()) })
    } else if (c in semitone) {
      let st = semitone[c]
      while (s[i] === '#' || s[i] === '+' || s[i] === '-') {
        st += s[i] === '-' ? -1 : 1
        i++
      }
      const n = readNum(defLen)
      const midi = (octave + 1) * 12 + st
      const freq = 440 * Math.pow(2, (midi - 69) / 12)
      out.push({ freq, ms: lengthMs(n, readDots()) })
    }
  }
  return { notes: out, background }
}

// TRS-80 graphics screen geometry.
export const GFX_COLS = 64
export const GFX_ROWS = 16
export const GFX_W = 128 // pixels across (2 per cell)
export const GFX_H = 48 // pixels down (3 per cell)

// IF/THEN/ELSE is compiled away into these two internal jump ops so that every
// statement — including ones inside a THEN/ELSE branch — gets its own program
// counter slot. That makes GOSUB/RETURN, GOTO, FOR and WHILE behave correctly
// even when they appear inside a one-line IF (e.g. IF X THEN GOSUB 100 : GOTO 10).
interface IfGotoOp {
  kind: 'ifgoto'
  cond: Expr
  target: number // jump here (skip the THEN) when the condition is false
}
interface JmpOp {
  kind: 'jmp'
  target: number // unconditional jump (used to skip over an ELSE branch)
}
type ExecOp = Stmt | IfGotoOp | JmpOp

interface FlatStmt {
  line: number
  stmt: ExecOp
}

type Flow =
  | { t: 'advance' }
  | { t: 'goto'; index: number }
  | { t: 'end' }

const ADVANCE: Flow = { t: 'advance' }
// TRS-80 Level II comma zones are 16 columns (4 zones on the 64-column
// screen). Verified against the real Level II ROM in the bundled emulator.
const PRINT_ZONE = 16

interface ForFrame {
  varName: string
  limit: number
  step: number
  bodyIndex: number
}
interface WhileFrame {
  whileIndex: number
}

export class Engine {
  private host: Host
  private vars = new Map<string, BasicValue>()
  private arrays = new Map<string, { sizes: number[]; data: BasicValue[] }>()

  private flat: FlatStmt[] = []
  private lineIndex = new Map<number, number>()
  private data: BasicValue[] = []
  private dataLineStart = new Map<number, number>()
  private dataPtr = 0

  private gosubStack: number[] = []
  private forStack: ForFrame[] = []
  private whileStack: WhileFrame[] = []

  private column = 0
  private currentLine = 0
  private halted = false
  private seed = 0x2545f491

  // Graphics screen: 1024 cells (64x16). gfxShown tracks whether the canvas is
  // currently displayed so CLS can re-render a cleared screen.
  private screen: number[] = new Array(GFX_COLS * GFX_ROWS).fill(0)
  private gfxShown = false
  // General POKE/PEEK memory. Video RAM (15360-16383) maps onto the screen.
  private memory = new Map<number, number>()

  constructor(host: Host) {
    this.host = host
  }

  // ---- program loading ----

  // Load (compile) the program: an array of { line, stmts } sorted by line.
  // IF statements are flattened into conditional/unconditional jump ops.
  loadProgram(lines: { line: number; stmts: Stmt[] }[]): void {
    this.flat = []
    this.lineIndex.clear()
    this.data = []
    this.dataLineStart.clear()
    for (const { line, stmts } of lines) {
      this.lineIndex.set(line, this.flat.length)
      for (const stmt of stmts) this.emit(stmt, line)
    }
  }

  // Append the ops for one statement to the flat program, recursing into the
  // branches of IF so they become first-class, individually-addressable ops.
  private emit(stmt: Stmt, line: number): void {
    if (stmt.kind === 'if') {
      // IFGOTO: when the condition is false, jump past the THEN branch.
      const ifgoto: IfGotoOp = { kind: 'ifgoto', cond: stmt.cond, target: -1 }
      this.flat.push({ line, stmt: ifgoto })
      for (const s of stmt.then) this.emit(s, line)
      if (stmt.else && stmt.else.length) {
        const jmp: JmpOp = { kind: 'jmp', target: -1 }
        this.flat.push({ line, stmt: jmp })
        ifgoto.target = this.flat.length // ELSE begins here
        for (const s of stmt.else) this.emit(s, line)
        jmp.target = this.flat.length // resume after the whole IF
      } else {
        ifgoto.target = this.flat.length // nothing to skip to but the next op
      }
      return
    }
    if (stmt.kind === 'data') {
      if (!this.dataLineStart.has(line)) this.dataLineStart.set(line, this.data.length)
      for (const v of stmt.values) this.data.push(v)
    }
    this.flat.push({ line, stmt })
  }

  // Reset all variable / loop / data state (CLEAR, or before a fresh RUN).
  reset(): void {
    this.vars.clear()
    this.arrays.clear()
    this.gosubStack = []
    this.forStack = []
    this.whileStack = []
    this.dataPtr = 0
    this.column = 0
    this.halted = false
    this.inputAbort = null
    this.seed = 0x2545f491
    this.screen.fill(0)
    this.gfxShown = false
    this.memory.clear()
    this.host.graphics(null) // hide any graphics from a previous run
    this.host.stopSound() // silence any leftover background music
  }

  // ---- graphics screen ----

  // Map pixel (x:0-127, y:0-47) to a cell index and the bit within its 2x3 grid.
  private pixelCell(x: number, y: number): { idx: number; bit: number } | null {
    if (x < 0 || x >= GFX_W || y < 0 || y >= GFX_H) return null
    const idx = ((y / 3) | 0) * GFX_COLS + ((x / 2) | 0)
    const bit = (x & 1) + 2 * (y % 3) // 0..5
    return { idx, bit }
  }

  private setPixel(x: number, y: number, on: boolean): void {
    const p = this.pixelCell(Math.trunc(x), Math.trunc(y))
    if (!p) return // out of range — ignored (kept simple for now)
    let v = this.screen[p.idx]
    if (v < 128) v = 128 // turn the cell into a graphics cell
    v = on ? v | (1 << p.bit) : v & ~(1 << p.bit)
    this.screen[p.idx] = v
    this.gfxShown = true
    this.host.graphics(this.screen)
  }

  private pointPixel(x: number, y: number): boolean {
    const p = this.pixelCell(Math.trunc(x), Math.trunc(y))
    if (!p) return false
    const v = this.screen[p.idx]
    return v >= 128 && (v & (1 << p.bit)) !== 0
  }

  private static VIDEO_BASE = 15360 // 0x3C00
  private static VIDEO_END = 16383 // 0x3FFF

  // POKE a byte. Writes to general memory; video RAM also updates the screen.
  private poke(addr: number, value: number): void {
    addr = Math.trunc(addr)
    const byte = Math.trunc(value) & 0xff
    this.memory.set(addr, byte)
    if (addr >= Engine.VIDEO_BASE && addr <= Engine.VIDEO_END) {
      this.screen[addr - Engine.VIDEO_BASE] = byte
      this.gfxShown = true
      this.host.graphics(this.screen)
    }
  }

  private peek(addr: number): number {
    addr = Math.trunc(addr)
    if (addr >= Engine.VIDEO_BASE && addr <= Engine.VIDEO_END) {
      return this.screen[addr - Engine.VIDEO_BASE]
    }
    return this.memory.get(addr) ?? 0
  }

  // Set while a program is parked on INPUT; lets requestStop() break free even
  // if the host's input promise is never going to resolve.
  private inputAbort: (() => void) | null = null

  requestStop(): void {
    this.halted = true
    this.host.stopSound() // cut any background music
    // If we're waiting on INPUT or PAUSE, abort that wait so it can unwind.
    if (this.inputAbort) this.inputAbort()
  }

  // ---- running ----

  // Run the whole loaded program from the start.
  async run(): Promise<void> {
    this.reset()
    await this.runFrom(0)
  }

  // Run program statements starting at a flat index until the end / STOP.
  private async runFrom(index: number): Promise<void> {
    let pc = index
    let steps = 0
    while (pc >= 0 && pc < this.flat.length) {
      if (this.halted) throw new BasicRuntimeError('Break', this.currentLine)
      const unit = this.flat[pc]
      this.currentLine = unit.line
      const flow = await this.execStmt(unit.stmt, pc)
      if (flow.t === 'end') return
      if (flow.t === 'goto') {
        pc = flow.index
      } else {
        pc++
      }
      // Yield to the event loop occasionally so the UI stays responsive and
      // a runaway loop can be interrupted.
      if (++steps % 2000 === 0) await new Promise((r) => setTimeout(r, 0))
    }
  }

  // Execute a list of statements in immediate mode (no line numbers).
  // If a statement transfers control into the program (GOTO/GOSUB/RUN handled
  // upstream), we continue running the program from there.
  async runImmediate(stmts: Stmt[]): Promise<void> {
    this.halted = false
    for (let i = 0; i < stmts.length; i++) {
      this.currentLine = 0
      const flow = await this.execStmt(stmts[i], -1)
      if (flow.t === 'end') return
      if (flow.t === 'goto') {
        await this.runFrom(flow.index)
        return
      }
    }
  }

  // ---- statement execution ----

  private async execStmt(stmt: ExecOp, pc: number): Promise<Flow> {
    switch (stmt.kind) {
      // Internal jump ops produced by compiling IF/THEN/ELSE.
      case 'ifgoto':
        return this.truthy(this.evalExpr(stmt.cond)) ? ADVANCE : { t: 'goto', index: stmt.target }
      case 'jmp':
        return { t: 'goto', index: stmt.target }
      case 'rem':
        return ADVANCE
      case 'print':
        this.execPrint(stmt.items, stmt.trailing)
        return ADVANCE
      case 'let': {
        const v = this.evalExpr(stmt.value)
        this.assign(stmt.target, v)
        return ADVANCE
      }
      case 'cls':
        this.host.clearScreen()
        this.column = 0
        // CLS clears the whole screen — graphics included.
        this.screen.fill(0)
        if (this.gfxShown) this.host.graphics(this.screen)
        return ADVANCE
      case 'set':
        this.setPixel(this.evalNum(stmt.x), this.evalNum(stmt.y), stmt.on)
        return ADVANCE
      case 'pause':
        await this.awaitAbortable(this.host.delay(Math.max(0, this.evalNum(stmt.ms))))
        return ADVANCE
      case 'poke':
        this.poke(this.evalNum(stmt.addr), this.evalNum(stmt.value))
        return ADVANCE
      case 'sound':
        await this.awaitAbortable(
          this.host.sound(this.evalNum(stmt.freq), Math.max(0, this.evalNum(stmt.ms)))
        )
        return ADVANCE
      case 'play': {
        const tune = parseMML(this.evalString(stmt.mml, 'PLAY'))
        if (tune.background) {
          this.host.playSequence(tune.notes) // non-blocking
        } else {
          for (const note of tune.notes) {
            await this.awaitAbortable(this.host.sound(note.freq, note.ms))
          }
        }
        return ADVANCE
      }
      case 'end':
        return { t: 'end' }
      case 'stop':
        this.host.output(`Break at ${this.currentLine}\n`)
        return { t: 'end' }
      case 'goto':
        return { t: 'goto', index: this.indexOfLine(stmt.line) }
      case 'gosub':
        this.gosubStack.push(pc + 1)
        return { t: 'goto', index: this.indexOfLine(stmt.line) }
      case 'return': {
        const ret = this.gosubStack.pop()
        if (ret === undefined) throw new BasicRuntimeError('RETURN without GOSUB', this.currentLine)
        return { t: 'goto', index: ret }
      }
      case 'if': {
        const cond = this.truthy(this.evalExpr(stmt.cond))
        const branch = cond ? stmt.then : stmt.else
        if (!branch) return ADVANCE
        for (const s of branch) {
          const flow = await this.execStmt(s, pc)
          if (flow.t !== 'advance') return flow
        }
        return ADVANCE
      }
      case 'for':
        return this.execFor(stmt, pc)
      case 'next':
        return this.execNext(stmt.vars)
      case 'while':
        return this.execWhile(stmt.cond, pc)
      case 'wend':
        return this.execWend()
      case 'input':
        await this.execInput(stmt.prompt, stmt.question, stmt.targets)
        return ADVANCE
      case 'dim':
        for (const d of stmt.decls) {
          const sizes = d.dims.map((e) => Math.trunc(this.evalNum(e)) + 1)
          this.makeArray(d.name, sizes)
        }
        return ADVANCE
      case 'read':
        this.execRead(stmt.targets)
        return ADVANCE
      case 'data':
        return ADVANCE // collected at load time
      case 'restore':
        this.dataPtr = stmt.line !== undefined ? this.dataLineStart.get(stmt.line) ?? 0 : 0
        return ADVANCE
      case 'save': {
        const key = this.evalString(stmt.key, 'SAVE')
        const values = stmt.values.map((e) => this.evalExpr(e))
        this.host.saveData(key, values)
        return ADVANCE
      }
      case 'load': {
        const key = this.evalString(stmt.key, 'LOAD')
        const values = this.host.loadData(key)
        if (values) {
          for (let i = 0; i < stmt.targets.length && i < values.length; i++) {
            this.assign(stmt.targets[i], values[i])
          }
        }
        return ADVANCE
      }
    }
  }

  private evalString(e: Expr, ctx: string): string {
    const v = this.evalExpr(e)
    if (typeof v !== 'string') throw new BasicRuntimeError(`${ctx} key must be a string`, this.currentLine)
    return v
  }

  private execFor(stmt: Extract<Stmt, { kind: 'for' }>, pc: number): Flow {
    const start = this.evalNum(stmt.start)
    const limit = this.evalNum(stmt.end)
    const step = stmt.step ? this.evalNum(stmt.step) : 1
    this.vars.set(stmt.varName, start)
    const done = step >= 0 ? start > limit : start < limit
    if (done) {
      // Skip the body: jump just past the matching NEXT.
      return { t: 'goto', index: this.matchingNext(pc) }
    }
    this.forStack.push({ varName: stmt.varName, limit, step, bodyIndex: pc + 1 })
    return ADVANCE
  }

  private execNext(vars: string[]): Flow {
    const names = vars.length ? vars : [undefined as unknown as string]
    for (const name of names) {
      // Find the matching frame, unwinding any inner loops left dangling.
      while (this.forStack.length && name && this.forStack[this.forStack.length - 1].varName !== name) {
        this.forStack.pop()
      }
      const frame = this.forStack[this.forStack.length - 1]
      if (!frame) throw new BasicRuntimeError('NEXT without FOR', this.currentLine)
      const cur = (this.vars.get(frame.varName) as number) + frame.step
      this.vars.set(frame.varName, cur)
      const cont = frame.step >= 0 ? cur <= frame.limit : cur >= frame.limit
      if (cont) {
        return { t: 'goto', index: frame.bodyIndex }
      }
      this.forStack.pop()
    }
    return ADVANCE
  }

  private execWhile(cond: Expr, pc: number): Flow {
    if (this.truthy(this.evalExpr(cond))) {
      this.whileStack.push({ whileIndex: pc })
      return ADVANCE
    }
    return { t: 'goto', index: this.matchingWend(pc) }
  }

  private execWend(): Flow {
    const frame = this.whileStack.pop()
    if (!frame) throw new BasicRuntimeError('WEND without WHILE', this.currentLine)
    return { t: 'goto', index: frame.whileIndex }
  }

  // Scan forward from a FOR at `pc` to the index just past its matching NEXT.
  private matchingNext(pc: number): number {
    let depth = 1
    for (let i = pc + 1; i < this.flat.length; i++) {
      const s = this.flat[i].stmt
      if (s.kind === 'for') depth++
      else if (s.kind === 'next') {
        depth -= Math.max(1, s.vars.length)
        if (depth <= 0) return i + 1
      }
    }
    return this.flat.length
  }

  // Scan forward from a WHILE at `pc` to the index just past its matching WEND.
  private matchingWend(pc: number): number {
    let depth = 1
    for (let i = pc + 1; i < this.flat.length; i++) {
      const s = this.flat[i].stmt
      if (s.kind === 'while') depth++
      else if (s.kind === 'wend') {
        depth--
        if (depth === 0) return i + 1
      }
    }
    return this.flat.length
  }

  private indexOfLine(line: number): number {
    const idx = this.lineIndex.get(line)
    if (idx === undefined) throw new BasicRuntimeError(`Undefined line ${line}`, this.currentLine)
    return idx
  }

  // ---- PRINT ----

  private execPrint(items: PrintItem[], trailing: boolean): void {
    let out = ''
    const emit = (text: string): void => {
      out += text
      const nl = text.lastIndexOf('\n')
      if (nl >= 0) this.column = text.length - nl - 1
      else this.column += text.length
    }
    for (const item of items) {
      if (item.sep === ',') {
        const spaces = PRINT_ZONE - (this.column % PRINT_ZONE)
        emit(' '.repeat(spaces))
        continue
      }
      if (item.sep === ';') continue
      if (!item.expr) continue
      // TAB / SPC are print-only pseudo-functions.
      if (item.expr.kind === 'call' && (item.expr.name === 'TAB' || item.expr.name === 'SPC')) {
        const n = Math.trunc(this.evalNum(item.expr.args[0]))
        if (item.expr.name === 'SPC') {
          emit(' '.repeat(Math.max(0, n)))
        } else {
          // TAB(n): move to column n (1-based)
          if (this.column >= n) emit('\n')
          emit(' '.repeat(Math.max(0, n - 1 - this.column)))
        }
        continue
      }
      const v = this.evalExpr(item.expr)
      emit(this.formatForPrint(v))
    }
    if (!trailing) emit('\n')
    this.host.output(out)
  }

  private formatForPrint(v: BasicValue): string {
    if (typeof v === 'number') {
      // Leading space for the sign position, trailing space — vintage style.
      const s = basicNumberToString(v)
      return (v < 0 ? '' : ' ') + s + ' '
    }
    return v
  }

  // ---- INPUT ----

  // Await a host promise, but abortable: requestStop() rejects it with a Break
  // so a program parked on INPUT or PAUSE can always be stopped.
  private awaitAbortable<T>(p: Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.inputAbort = () => {
        this.inputAbort = null
        reject(new BasicRuntimeError('Break', this.currentLine))
      }
      Promise.resolve(p).then(
        (v) => {
          this.inputAbort = null
          resolve(v)
        },
        (e) => {
          this.inputAbort = null
          reject(e)
        }
      )
    })
  }

  private readInput(promptStr: string): Promise<string> {
    return this.awaitAbortable(this.host.inputLine(promptStr))
  }

  private async execInput(
    prompt: string | undefined,
    question: boolean,
    targets: LValue[]
  ): Promise<void> {
    for (;;) {
      const line = await this.readInput((prompt ?? '') + (question ? '? ' : ''))
      const parts = line.split(',').map((s) => s.trim())
      if (parts.length < targets.length) {
        this.host.output('?Redo from start\n')
        continue
      }
      let ok = true
      const coerced: BasicValue[] = []
      for (let i = 0; i < targets.length; i++) {
        if (this.isStringName(targets[i].name)) {
          coerced.push(parts[i])
        } else {
          const n = parseFloat(parts[i])
          if (Number.isNaN(n)) {
            ok = false
            break
          }
          coerced.push(n)
        }
      }
      if (!ok) {
        this.host.output('?Redo from start\n')
        continue
      }
      for (let i = 0; i < targets.length; i++) this.assign(targets[i], coerced[i])
      return
    }
  }

  // ---- READ ----

  private execRead(targets: LValue[]): void {
    for (const t of targets) {
      if (this.dataPtr >= this.data.length) throw new BasicRuntimeError('Out of DATA', this.currentLine)
      const raw = this.data[this.dataPtr++]
      if (this.isStringName(t.name)) {
        this.assign(t, typeof raw === 'string' ? raw : basicNumberToString(raw))
      } else {
        const n = typeof raw === 'number' ? raw : parseFloat(raw)
        this.assign(t, Number.isNaN(n) ? 0 : n)
      }
    }
  }

  // ---- variables & arrays ----

  private isStringName(name: string): boolean {
    return name.endsWith('$')
  }
  private isIntName(name: string): boolean {
    return name.endsWith('%')
  }

  private assign(target: LValue, value: BasicValue): void {
    const coerced = this.coerce(target.name, value)
    if (target.indices && target.indices.length) {
      const arr = this.getOrAutoArray(target.name, target.indices.length)
      const offset = this.arrayOffset(target.name, arr.sizes, target.indices)
      arr.data[offset] = coerced
    } else {
      this.vars.set(target.name, coerced)
    }
  }

  private coerce(name: string, value: BasicValue): BasicValue {
    if (this.isStringName(name)) {
      if (typeof value !== 'string') throw new BasicRuntimeError('Type mismatch', this.currentLine)
      return value
    }
    if (typeof value !== 'number') throw new BasicRuntimeError('Type mismatch', this.currentLine)
    return this.isIntName(name) ? Math.trunc(value) : value
  }

  private makeArray(name: string, sizes: number[]): void {
    const total = sizes.reduce((a, b) => a * b, 1)
    const fill: BasicValue = this.isStringName(name) ? '' : 0
    this.arrays.set(name, { sizes, data: new Array(total).fill(fill) })
  }

  private getOrAutoArray(name: string, rank: number): { sizes: number[]; data: BasicValue[] } {
    let arr = this.arrays.get(name)
    if (!arr) {
      // Auto-dimension to 10 (size 11) per used dimension, classic behaviour.
      this.makeArray(name, new Array(rank).fill(11))
      arr = this.arrays.get(name)!
    }
    return arr
  }

  private arrayOffset(name: string, sizes: number[], indices: Expr[]): number {
    if (indices.length !== sizes.length) {
      throw new BasicRuntimeError(`Wrong number of subscripts for ${name}`, this.currentLine)
    }
    let offset = 0
    for (let i = 0; i < indices.length; i++) {
      const idx = Math.trunc(this.evalNum(indices[i]))
      if (idx < 0 || idx >= sizes[i]) {
        throw new BasicRuntimeError(`Subscript out of range in ${name}`, this.currentLine)
      }
      offset = offset * sizes[i] + idx
    }
    return offset
  }

  // ---- expression evaluation ----

  private evalNum(e: Expr): number {
    const v = this.evalExpr(e)
    if (typeof v !== 'number') throw new BasicRuntimeError('Type mismatch (number expected)', this.currentLine)
    return v
  }

  private truthy(v: BasicValue): boolean {
    return typeof v === 'number' ? v !== 0 : v.length !== 0
  }

  private evalExpr(e: Expr): BasicValue {
    switch (e.kind) {
      case 'number':
        return e.value
      case 'string':
        return e.value
      case 'var': {
        const v = this.vars.get(e.name)
        if (v !== undefined) return v
        return this.isStringName(e.name) ? '' : 0
      }
      case 'arrayref': {
        const arr = this.getOrAutoArray(e.name, e.indices.length)
        const offset = this.arrayOffset(e.name, arr.sizes, e.indices)
        return arr.data[offset]
      }
      case 'call':
        return this.evalCall(e.name, e.args)
      case 'unary': {
        if (e.op === '-') return -this.evalNum(e.expr)
        return this.truthy(this.evalExpr(e.expr)) ? 0 : -1 // NOT
      }
      case 'binary':
        return this.evalBinary(e.op, e.left, e.right)
    }
  }

  private evalCall(name: string, args: Expr[]): BasicValue {
    if (name === 'TAB' || name === 'SPC') {
      throw new BasicRuntimeError(`${name} is only valid in PRINT`, this.currentLine)
    }
    // EXISTS(key$) — true (-1) if a SAVE slot with that key exists.
    if (name === 'EXISTS') {
      const key = this.evalString(args[0], 'EXISTS')
      return this.host.loadData(key) !== null ? -1 : 0
    }
    // POINT(x,y) — -1 if the graphics pixel is set, else 0.
    if (name === 'POINT') {
      return this.pointPixel(this.evalNum(args[0]), this.evalNum(args[1])) ? -1 : 0
    }
    // PEEK(addr) — read a byte from memory / video RAM.
    if (name === 'PEEK') {
      return this.peek(this.evalNum(args[0]))
    }
    const fn = BUILTINS[name]
    if (!fn) throw new BasicRuntimeError(`Undefined function ${name}`, this.currentLine)
    const arity = BUILTIN_ARITY[name]
    if (arity && (args.length < arity[0] || args.length > arity[1])) {
      throw new BasicRuntimeError(`Wrong number of arguments to ${name}`, this.currentLine)
    }
    const evaluated = args.map((a) => this.evalExpr(a))
    return fn(evaluated, { random: () => this.random() })
  }

  private evalBinary(op: string, leftE: Expr, rightE: Expr): BasicValue {
    // Short-circuit not required; BASIC AND/OR are numeric/bitwise-ish but we
    // treat them logically here for simplicity.
    if (op === 'AND') return this.truthy(this.evalExpr(leftE)) && this.truthy(this.evalExpr(rightE)) ? -1 : 0
    if (op === 'OR') return this.truthy(this.evalExpr(leftE)) || this.truthy(this.evalExpr(rightE)) ? -1 : 0

    const l = this.evalExpr(leftE)
    const r = this.evalExpr(rightE)

    // String concatenation and comparison
    if (typeof l === 'string' || typeof r === 'string') {
      if (op === '+') {
        if (typeof l === 'string' && typeof r === 'string') return l + r
        throw new BasicRuntimeError('Type mismatch', this.currentLine)
      }
      if (typeof l === 'string' && typeof r === 'string') {
        return this.compare(op, l < r ? -1 : l > r ? 1 : 0)
      }
      throw new BasicRuntimeError('Type mismatch', this.currentLine)
    }

    switch (op) {
      case '+': return l + r
      case '-': return l - r
      case '*': return l * r
      case '/':
        if (r === 0) throw new BasicRuntimeError('Division by zero', this.currentLine)
        return l / r
      case '^': return Math.pow(l, r)
      case 'MOD': return l - Math.trunc(l / r) * r
      case '=': case '<>': case '<': case '>': case '<=': case '>=':
        return this.compare(op, l < r ? -1 : l > r ? 1 : 0)
    }
    throw new BasicRuntimeError(`Unknown operator ${op}`, this.currentLine)
  }

  private compare(op: string, c: number): number {
    let result: boolean
    switch (op) {
      case '=': result = c === 0; break
      case '<>': result = c !== 0; break
      case '<': result = c < 0; break
      case '>': result = c > 0; break
      case '<=': result = c <= 0; break
      case '>=': result = c >= 0; break
      default: result = false
    }
    return result ? -1 : 0 // BASIC true is -1
  }

  // Simple deterministic PRNG (xorshift) so runs are reproducible.
  private random(): number {
    let x = this.seed
    x ^= x << 13
    x ^= x >>> 17
    x ^= x << 5
    this.seed = x >>> 0
    return (this.seed % 1000000) / 1000000
  }
}
