// Recursive-descent parser for Retro80.
// Parses the tokens of ONE source line into a list of statements.

import { Token, BasicSyntaxError } from './tokenizer'
import { BUILTIN_NAMES } from './builtins'
import type {
  Expr,
  Stmt,
  PrintItem,
  LValue
} from './ast'

export function parseLine(tokens: Token[]): Stmt[] {
  return new Parser(tokens).parseProgramLine()
}

class Parser {
  private toks: Token[]
  private pos = 0

  constructor(tokens: Token[]) {
    this.toks = tokens
  }

  // ---- token helpers ----
  private peek(): Token {
    return this.toks[this.pos]
  }
  private next(): Token {
    return this.toks[this.pos++]
  }
  private atEol(): boolean {
    return this.peek().type === 'eol'
  }
  private isKeyword(kw: string): boolean {
    const t = this.peek()
    return t.type === 'keyword' && t.value === kw
  }
  private isOp(op: string): boolean {
    const t = this.peek()
    return t.type === 'op' && t.value === op
  }
  private eatOp(op: string): boolean {
    if (this.isOp(op)) {
      this.pos++
      return true
    }
    return false
  }
  private expectOp(op: string): void {
    if (!this.eatOp(op)) {
      throw new BasicSyntaxError(`Expected '${op}'`, this.peek().col)
    }
  }

  // ---- statement lists ----
  parseProgramLine(): Stmt[] {
    const stmts: Stmt[] = []
    if (this.atEol()) return stmts
    stmts.push(...this.parseStatementSequence(false))
    if (!this.atEol()) {
      throw new BasicSyntaxError(
        `Unexpected '${this.peek().value || 'token'}'`,
        this.peek().col
      )
    }
    return stmts
  }

  // Parse one-or-more `:`-separated statements. When stopAtElse is true we
  // also stop at an ELSE keyword (used for the THEN branch of IF).
  private parseStatementSequence(stopAtElse: boolean): Stmt[] {
    const out: Stmt[] = []
    for (;;) {
      while (this.isOp(':')) this.pos++ // tolerate empty statements
      if (this.atEol()) break
      if (stopAtElse && this.isKeyword('ELSE')) break
      out.push(this.parseStatement())
      if (this.isOp(':')) {
        continue
      }
      break
    }
    return out
  }

  // ---- a single statement ----
  private parseStatement(): Stmt {
    const t = this.peek()

    if (t.type === 'keyword') {
      switch (t.value) {
        case 'PRINT':
          return this.parsePrint()
        case 'LET':
          this.pos++
          return this.parseAssignment()
        case 'IF':
          return this.parseIf()
        case 'GOTO':
          this.pos++
          return { kind: 'goto', line: this.expectLineNumber() }
        case 'GOSUB':
          this.pos++
          return { kind: 'gosub', line: this.expectLineNumber() }
        case 'RETURN':
          this.pos++
          return { kind: 'return' }
        case 'FOR':
          return this.parseFor()
        case 'NEXT':
          return this.parseNext()
        case 'WHILE':
          this.pos++
          return { kind: 'while', cond: this.parseExpr() }
        case 'WEND':
          this.pos++
          return { kind: 'wend' }
        case 'INPUT':
          return this.parseInput()
        case 'DIM':
          return this.parseDim()
        case 'READ':
          return this.parseRead()
        case 'DATA':
          return this.parseData()
        case 'RESTORE':
          return this.parseRestore()
        case 'REM': {
          this.pos++
          const text = this.peek().type === 'string' ? this.next().value : ''
          return { kind: 'rem', text }
        }
        case 'END':
          this.pos++
          return { kind: 'end' }
        case 'STOP':
          this.pos++
          return { kind: 'stop' }
        case 'CLS':
          this.pos++
          return { kind: 'cls' }
        case 'SAVE':
          return this.parseSave()
        case 'LOAD':
          return this.parseLoad()
        case 'SET':
          return this.parseSet(true)
        case 'RESET':
          return this.parseSet(false)
        case 'PAUSE':
          this.pos++
          return { kind: 'pause', ms: this.parseExpr() }
        case 'POKE': {
          this.pos++
          const addr = this.parseExpr()
          this.expectOp(',')
          const value = this.parseExpr()
          return { kind: 'poke', addr, value }
        }
        case 'SOUND': {
          this.pos++
          const freq = this.parseExpr()
          this.expectOp(',')
          const ms = this.parseExpr()
          return { kind: 'sound', freq, ms }
        }
        case 'PLAY':
          this.pos++
          return { kind: 'play', mml: this.parseExpr() }
      }
    }

    // Bare assignment: X = expr  or  A(i) = expr
    if (t.type === 'ident') {
      return this.parseAssignment()
    }

    throw new BasicSyntaxError(`Unknown statement '${t.value || t.type}'`, t.col)
  }

  private expectLineNumber(): number {
    const t = this.peek()
    if (t.type !== 'number') {
      throw new BasicSyntaxError('Expected a line number', t.col)
    }
    this.pos++
    return Math.trunc(t.num!)
  }

  private parseAssignment(): Stmt {
    const target = this.parseLValue()
    this.expectOp('=')
    const value = this.parseExpr()
    return { kind: 'let', target, value }
  }

  private parseLValue(): LValue {
    const t = this.peek()
    if (t.type !== 'ident') {
      throw new BasicSyntaxError('Expected a variable name', t.col)
    }
    this.pos++
    const name = t.value
    if (this.isOp('(')) {
      this.pos++
      const indices = this.parseExprList(')')
      this.expectOp(')')
      return { name, indices }
    }
    return { name }
  }

  private parsePrint(): Stmt {
    this.pos++ // PRINT
    const items: PrintItem[] = []
    let trailing = false
    for (;;) {
      if (this.atEol() || this.isOp(':') || this.isKeyword('ELSE')) break
      if (this.isOp(';')) {
        this.pos++
        items.push({ sep: ';' })
        trailing = true
        continue
      }
      if (this.isOp(',')) {
        this.pos++
        items.push({ sep: ',' })
        trailing = true
        continue
      }
      const expr = this.parseExpr()
      items.push({ expr })
      trailing = false
    }
    return { kind: 'print', items, trailing }
  }

  private parseIf(): Stmt {
    this.pos++ // IF
    const cond = this.parseExpr()
    if (this.isKeyword('THEN')) {
      this.pos++
    } else if (this.isKeyword('GOTO')) {
      // IF cond GOTO n
      this.pos++
      const line = this.expectLineNumber()
      return { kind: 'if', cond, then: [{ kind: 'goto', line }] }
    } else {
      throw new BasicSyntaxError("Expected THEN after IF condition", this.peek().col)
    }

    // THEN branch: a bare number means GOTO that line.
    let thenBranch: Stmt[]
    if (this.peek().type === 'number') {
      thenBranch = [{ kind: 'goto', line: this.expectLineNumber() }]
    } else {
      thenBranch = this.parseStatementSequence(true)
    }

    let elseBranch: Stmt[] | undefined
    if (this.isKeyword('ELSE')) {
      this.pos++
      if (this.peek().type === 'number') {
        elseBranch = [{ kind: 'goto', line: this.expectLineNumber() }]
      } else {
        elseBranch = this.parseStatementSequence(false)
      }
    }
    return { kind: 'if', cond, then: thenBranch, else: elseBranch }
  }

  private parseFor(): Stmt {
    this.pos++ // FOR
    const v = this.peek()
    if (v.type !== 'ident') throw new BasicSyntaxError('Expected loop variable', v.col)
    this.pos++
    this.expectOp('=')
    const start = this.parseExpr()
    if (!this.isKeyword('TO')) throw new BasicSyntaxError('Expected TO', this.peek().col)
    this.pos++
    const end = this.parseExpr()
    let step: Expr | undefined
    if (this.isKeyword('STEP')) {
      this.pos++
      step = this.parseExpr()
    }
    return { kind: 'for', varName: v.value, start, end, step }
  }

  private parseNext(): Stmt {
    this.pos++ // NEXT
    const vars: string[] = []
    if (this.peek().type === 'ident') {
      vars.push(this.next().value)
      while (this.isOp(',')) {
        this.pos++
        const t = this.peek()
        if (t.type !== 'ident') throw new BasicSyntaxError('Expected variable', t.col)
        vars.push(this.next().value)
      }
    }
    return { kind: 'next', vars }
  }

  private parseInput(): Stmt {
    this.pos++ // INPUT
    let prompt: string | undefined
    let question = true
    // INPUT "prompt"; var   -> "prompt? "   (semicolon keeps the question mark)
    // INPUT "prompt", var   -> "prompt"     (comma suppresses it: bare cursor)
    if (this.peek().type === 'string') {
      prompt = this.next().value
      if (this.isOp(';')) {
        this.pos++
        question = true
      } else if (this.isOp(',')) {
        this.pos++
        question = false
      }
    }
    const targets: LValue[] = [this.parseLValue()]
    while (this.isOp(',')) {
      this.pos++
      targets.push(this.parseLValue())
    }
    return { kind: 'input', prompt, question, targets }
  }

  private parseDim(): Stmt {
    this.pos++ // DIM
    const decls: { name: string; dims: Expr[] }[] = []
    for (;;) {
      const t = this.peek()
      if (t.type !== 'ident') throw new BasicSyntaxError('Expected array name', t.col)
      this.pos++
      this.expectOp('(')
      const dims = this.parseExprList(')')
      this.expectOp(')')
      decls.push({ name: t.value, dims })
      if (this.isOp(',')) {
        this.pos++
        continue
      }
      break
    }
    return { kind: 'dim', decls }
  }

  private parseRead(): Stmt {
    this.pos++ // READ
    const targets: LValue[] = [this.parseLValue()]
    while (this.isOp(',')) {
      this.pos++
      targets.push(this.parseLValue())
    }
    return { kind: 'read', targets }
  }

  private parseData(): Stmt {
    this.pos++ // DATA — consumes the rest of the line
    const values: (number | string)[] = []
    // collect comma-separated items from the remaining tokens
    let current: Token[] = []
    const flush = (): void => {
      if (current.length === 0) {
        values.push('')
        return
      }
      if (current.length === 1 && current[0].type === 'number') {
        values.push(current[0].num!)
      } else if (current.length === 1 && current[0].type === 'string') {
        values.push(current[0].value)
      } else {
        // unquoted text — join token text
        values.push(current.map((t) => t.value).join(' '))
      }
      current = []
    }
    while (!this.atEol()) {
      if (this.isOp(',')) {
        this.pos++
        flush()
        continue
      }
      current.push(this.next())
    }
    flush()
    return { kind: 'data', values }
  }

  private parseSet(on: boolean): Stmt {
    this.pos++ // SET / RESET
    this.expectOp('(')
    const x = this.parseExpr()
    this.expectOp(',')
    const y = this.parseExpr()
    this.expectOp(')')
    return { kind: 'set', on, x, y }
  }

  private parseSave(): Stmt {
    this.pos++ // SAVE
    const key = this.parseExpr()
    const values: Expr[] = []
    while (this.isOp(',')) {
      this.pos++
      values.push(this.parseExpr())
    }
    return { kind: 'save', key, values }
  }

  private parseLoad(): Stmt {
    this.pos++ // LOAD
    const key = this.parseExpr()
    const targets: LValue[] = []
    while (this.isOp(',')) {
      this.pos++
      targets.push(this.parseLValue())
    }
    return { kind: 'load', key, targets }
  }

  private parseRestore(): Stmt {
    this.pos++ // RESTORE
    if (this.peek().type === 'number') {
      return { kind: 'restore', line: this.expectLineNumber() }
    }
    return { kind: 'restore' }
  }

  // ---- expressions (precedence climbing) ----
  private parseExpr(): Expr {
    return this.parseOr()
  }
  private parseOr(): Expr {
    let left = this.parseAnd()
    while (this.isKeyword('OR')) {
      this.pos++
      left = { kind: 'binary', op: 'OR', left, right: this.parseAnd() }
    }
    return left
  }
  private parseAnd(): Expr {
    let left = this.parseNot()
    while (this.isKeyword('AND')) {
      this.pos++
      left = { kind: 'binary', op: 'AND', left, right: this.parseNot() }
    }
    return left
  }
  private parseNot(): Expr {
    if (this.isKeyword('NOT')) {
      this.pos++
      return { kind: 'unary', op: 'NOT', expr: this.parseNot() }
    }
    return this.parseComparison()
  }
  private parseComparison(): Expr {
    let left = this.parseAddSub()
    while (
      this.isOp('=') || this.isOp('<>') || this.isOp('<') ||
      this.isOp('>') || this.isOp('<=') || this.isOp('>=')
    ) {
      const op = this.next().value
      left = { kind: 'binary', op, left, right: this.parseAddSub() }
    }
    return left
  }
  private parseAddSub(): Expr {
    let left = this.parseMulDiv()
    while (this.isOp('+') || this.isOp('-')) {
      const op = this.next().value
      left = { kind: 'binary', op, left, right: this.parseMulDiv() }
    }
    return left
  }
  private parseMulDiv(): Expr {
    let left = this.parsePower()
    while (this.isOp('*') || this.isOp('/') || this.isKeyword('MOD')) {
      const op = this.next().value
      left = { kind: 'binary', op, left, right: this.parsePower() }
    }
    return left
  }
  private parsePower(): Expr {
    const left = this.parseUnary()
    if (this.isOp('^')) {
      this.pos++
      // right-associative
      return { kind: 'binary', op: '^', left, right: this.parsePower() }
    }
    return left
  }
  private parseUnary(): Expr {
    if (this.isOp('-')) {
      this.pos++
      return { kind: 'unary', op: '-', expr: this.parseUnary() }
    }
    if (this.isOp('+')) {
      this.pos++
      return this.parseUnary()
    }
    return this.parsePrimary()
  }
  private parsePrimary(): Expr {
    const t = this.peek()

    if (t.type === 'number') {
      this.pos++
      return { kind: 'number', value: t.num! }
    }
    if (t.type === 'string') {
      this.pos++
      return { kind: 'string', value: t.value }
    }
    if (this.isOp('(')) {
      this.pos++
      const e = this.parseExpr()
      this.expectOp(')')
      return e
    }
    // TAB(n) / SPC(n) — only meaningful inside PRINT, but parse them here.
    if (t.type === 'keyword' && (t.value === 'TAB' || t.value === 'SPC')) {
      this.pos++
      this.expectOp('(')
      const arg = this.parseExpr()
      this.expectOp(')')
      return { kind: 'call', name: t.value, args: [arg] }
    }
    if (t.type === 'ident') {
      this.pos++
      const name = t.value
      if (this.isOp('(')) {
        this.pos++
        const args = this.parseExprList(')')
        this.expectOp(')')
        if (BUILTIN_NAMES.has(name)) {
          return { kind: 'call', name, args }
        }
        return { kind: 'arrayref', name, indices: args }
      }
      return { kind: 'var', name }
    }

    throw new BasicSyntaxError(`Unexpected '${t.value || t.type}' in expression`, t.col)
  }

  private parseExprList(close: string): Expr[] {
    const list: Expr[] = []
    if (this.isOp(close)) return list
    list.push(this.parseExpr())
    while (this.isOp(',')) {
      this.pos++
      list.push(this.parseExpr())
    }
    return list
  }
}
