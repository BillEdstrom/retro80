// BasicSession — the REPL brain.
//
// It owns the in-memory program (a map of line number -> source text), handles
// program editing (typing a numbered line adds/replaces/deletes it), the
// immediate-mode commands (RUN, LIST, NEW, CLEAR), and direct execution of
// statements typed without a line number.

import { tokenize, BasicSyntaxError, type Token } from './tokenizer'
import { parseLine } from './parser'
import { Engine, type Host } from './interpreter'
import { BasicRuntimeError, level2ErrorText } from './errors'
import type { Stmt } from './ast'

export type { Host } from './interpreter'

const UNDO_LEVELS = 30

export class BasicSession {
  private program = new Map<number, string>()
  // Snapshots of the program taken before each edit, for UNDO (capped).
  private undoStack: Map<number, string>[] = []
  private engine: Engine
  private host: Host

  constructor(host: Host) {
    this.host = host
    this.engine = new Engine(host)
  }

  // Stop a running program (Engine yields periodically and checks this).
  requestStop(): void {
    this.engine.requestStop()
  }

  // ---- program text accessors (used by the editor & save/load) ----

  getProgramText(): string {
    return this.sortedLines()
      .map(([num, src]) => `${num} ${src}`)
      .join('\n')
  }

  // Replace the whole program from a block of text (editor / opening a file).
  // A wholesale replace (e.g. loading a different program) starts a fresh undo
  // history; an unchanged set is a no-op so it won't wipe your undo history.
  setProgramText(text: string): void {
    const next = new Map<number, string>()
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim()
      if (!line) continue
      const m = line.match(/^(\d+)\s?(.*)$/)
      if (m && m[2].trim()) next.set(parseInt(m[1], 10), m[2].trim())
    }
    if (this.sameProgram(next)) return
    this.program = next
    this.undoStack = []
  }

  isEmpty(): boolean {
    return this.program.size === 0
  }

  // Source text of a program line (without the line number), or null if no such
  // line exists. Used by the EDIT command to pull a line back for editing.
  getLine(num: number): string | null {
    return this.program.get(num) ?? null
  }

  // ---- undo ----

  private sameProgram(other: Map<number, string>): boolean {
    if (other.size !== this.program.size) return false
    for (const [k, v] of other) if (this.program.get(k) !== v) return false
    return true
  }

  // Snapshot the current program before an edit (capped at UNDO_LEVELS).
  private pushUndo(): void {
    this.undoStack.push(new Map(this.program))
    if (this.undoStack.length > UNDO_LEVELS) this.undoStack.shift()
  }

  private cmdUndo(): void {
    const prev = this.undoStack.pop()
    if (!prev) {
      this.host.output('Nothing to undo\n')
      return
    }
    this.program = prev
    this.host.output('Undone\n')
  }

  private sortedLines(): [number, string][] {
    return [...this.program.entries()].sort((a, b) => a[0] - b[0])
  }

  // ---- the main entry point: handle one line typed at the prompt ----

  async execute(input: string): Promise<void> {
    const text = input.trim()
    if (!text) return

    // 1) A line that starts with a number is a program edit.
    const numMatch = text.match(/^(\d+)\s?(.*)$/)
    if (numMatch) {
      const num = parseInt(numMatch[1], 10)
      const body = numMatch[2].trim()
      if (body === '') {
        // Delete the line (snapshot first, only if it existed).
        if (this.program.has(num)) {
          this.pushUndo()
          this.program.delete(num)
        }
      } else {
        // Validate syntax now for instant feedback, but store either way.
        try {
          parseLine(tokenize(body))
        } catch (e) {
          this.reportError(e, body)
        }
        // Snapshot before changing this line (only if it actually changes).
        if (this.program.get(num) !== body) {
          this.pushUndo()
          this.program.set(num, body)
        }
      }
      return
    }

    // 2) Otherwise it's a direct command / immediate statement. When it
    //    finishes, BASIC returns to command level and prints READY — like a
    //    TRS-80 (after CLS this lands at the top of the freshly cleared screen).
    await this.runDirect(text)
    this.host.output('READY\n')
  }

  private async runDirect(text: string): Promise<void> {
    let tokens
    try {
      tokens = tokenize(text)
    } catch (e) {
      this.reportError(e, text)
      return
    }

    const first = tokens[0]
    const head = first.type === 'keyword' || first.type === 'ident' ? first.value : ''

    switch (head) {
      case 'RUN':
        await this.cmdRun(tokens[1]?.type === 'number' ? tokens[1].num : undefined)
        return
      case 'LIST':
        this.cmdList(text)
        return
      case 'NEW':
        if (this.program.size > 0) this.pushUndo()
        this.program = new Map()
        this.engine = new Engine(this.host)
        return
      case 'CLEAR':
        this.engine.reset()
        return
      case 'RENUM':
      case 'RENUMBER':
        this.cmdRenum(tokens)
        return
      case 'UNDO':
        this.cmdUndo()
        return
      default:
        // CLS as a bare command clears the screen; otherwise run immediately.
        await this.cmdImmediate(text)
        return
    }
  }

  // ---- commands ----

  private buildProgram(): { line: number; stmts: Stmt[] }[] | null {
    const out: { line: number; stmts: Stmt[] }[] = []
    for (const [line, src] of this.sortedLines()) {
      try {
        out.push({ line, stmts: parseLine(tokenize(src)) })
      } catch (e) {
        if (e instanceof BasicSyntaxError) {
          // Level II style code, with the offending source as a modern nicety.
          this.host.output(`?SN ERROR IN ${line}\n  ${src}\n`)
        } else {
          this.host.output(`?Error in ${line}: ${(e as Error).message}\n`)
        }
        return null
      }
    }
    return out
  }

  private async cmdRun(startLine?: number): Promise<void> {
    const built = this.buildProgram()
    if (!built) return
    this.engine.loadProgram(built)
    try {
      if (startLine !== undefined) {
        this.engine.reset()
        // Run from a specific line by injecting a GOTO.
        await this.engine.runImmediate([{ kind: 'goto', line: startLine }])
      } else {
        await this.engine.run()
      }
    } catch (e) {
      this.reportRuntimeError(e)
    }
  }

  private cmdList(text: string): void {
    // LIST, LIST 100, LIST 10-50
    const range = text.slice(4).trim()
    let lo = -Infinity
    let hi = Infinity
    if (range) {
      const m = range.match(/^(\d+)?\s*-\s*(\d+)?$/)
      if (m) {
        if (m[1]) lo = parseInt(m[1], 10)
        if (m[2]) hi = parseInt(m[2], 10)
      } else if (/^\d+$/.test(range)) {
        lo = hi = parseInt(range, 10)
      }
    }
    for (const [num, src] of this.sortedLines()) {
      if (num >= lo && num <= hi) this.host.output(`${num} ${src}\n`)
    }
  }

  // RENUM [newStart [, increment]] — renumber every line and fix the line
  // numbers referenced by GOTO/GOSUB/THEN/ELSE/RESTORE. Default 10 by 10.
  private cmdRenum(tokens: Token[]): void {
    const nums = tokens.filter((t) => t.type === 'number').map((t) => Math.trunc(t.num!))
    const start = nums[0] ?? 10
    const step = nums[1] ?? 10
    if (start <= 0 || step <= 0) {
      this.host.output('?Illegal RENUM arguments\n')
      return
    }
    this.renumber(start, step)
  }

  // Public so the UI can offer a Renumber action too.
  renumber(start = 10, step = 10): void {
    if (this.program.size === 0) return
    this.pushUndo()
    const lines = this.sortedLines()
    const map = new Map<number, number>()
    lines.forEach(([num], i) => map.set(num, start + i * step))
    const next = new Map<number, string>()
    for (const [num, src] of lines) {
      next.set(map.get(num)!, this.rewriteLineRefs(src, map))
    }
    this.program = next
  }

  // Rewrite only the line-number references inside a line, preserving the rest
  // of the source exactly (we splice by column, so spacing/case are untouched).
  private rewriteLineRefs(src: string, map: Map<number, number>): string {
    let toks: Token[]
    try {
      toks = tokenize(src)
    } catch {
      return src
    }
    const REF = new Set(['GOTO', 'GOSUB', 'THEN', 'ELSE', 'RESTORE'])
    const edits: { col: number; len: number; text: string }[] = []
    for (let i = 1; i < toks.length; i++) {
      const t = toks[i]
      const prev = toks[i - 1]
      if (t.type === 'number' && prev.type === 'keyword' && REF.has(prev.value)) {
        const old = Math.trunc(t.num!)
        const mapped = map.get(old)
        if (mapped !== undefined) {
          edits.push({ col: t.col, len: t.value.length, text: String(mapped) })
        }
      }
    }
    edits.sort((a, b) => b.col - a.col) // apply right-to-left
    let out = src
    for (const e of edits) out = out.slice(0, e.col) + e.text + out.slice(e.col + e.len)
    return out
  }

  private async cmdImmediate(text: string): Promise<void> {
    let stmts: Stmt[]
    try {
      stmts = parseLine(tokenize(text))
    } catch (e) {
      this.reportError(e, text)
      return
    }
    if (stmts.length === 0) return
    // Immediate statements can reference the current program (GOTO/GOSUB),
    // so make sure it is loaded.
    const built = this.buildProgram()
    if (built) this.engine.loadProgram(built)
    try {
      await this.engine.runImmediate(stmts)
    } catch (e) {
      this.reportRuntimeError(e)
    }
  }

  // ---- error reporting ----

  private reportError(e: unknown, source: string): void {
    if (e instanceof BasicSyntaxError) {
      // Level II style code; keep the caret detail as a modern nicety.
      this.host.output(`?SN ERROR\n  ${source}\n  ${' '.repeat(e.col)}^\n`)
    } else {
      this.host.output(`?${(e as Error).message}\n`)
    }
  }

  private reportRuntimeError(e: unknown): void {
    if (e instanceof BasicRuntimeError) {
      // A break (Stop button / BREAK key) is not an error — TRS-80 style is
      // "BREAK AT nnnn" with no leading "?". Real errors keep the "?".
      if (e.message === 'Break') {
        this.host.output(`Break at ${e.line ?? 0}\n`)
        return
      }
      // Authentic Level II code where one exists ("?TM ERROR IN 30"); fall
      // back to our descriptive message for extensions Level II didn't have.
      // Line 0 = direct mode: Level II omits the "IN nn" clause there.
      const terse = level2ErrorText(e.message, e.line || undefined)
      if (terse !== null) {
        this.host.output(`${terse}\n`)
        return
      }
      const where = e.line ? ` in ${e.line}` : ''
      this.host.output(`?${e.message}${where}\n`)
    } else {
      this.host.output(`?${(e as Error).message}\n`)
    }
  }
}
