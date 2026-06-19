// AST node definitions for Retro80.

// ---------- Expressions ----------

export type Expr =
  | NumberLit
  | StringLit
  | VarRef
  | ArrayRef
  | FnCall
  | Unary
  | Binary

export interface NumberLit {
  kind: 'number'
  value: number
}
export interface StringLit {
  kind: 'string'
  value: string
}
// A scalar variable reference, e.g. X, NAME$
export interface VarRef {
  kind: 'var'
  name: string
}
// An array element OR a user function call disambiguated at runtime:
// classic BASIC uses A(3) for both. We treat known builtins as FnCall in the
// parser and everything else as ArrayRef.
export interface ArrayRef {
  kind: 'arrayref'
  name: string
  indices: Expr[]
}
export interface FnCall {
  kind: 'call'
  name: string // e.g. LEFT$, RND, SQR
  args: Expr[]
}
export interface Unary {
  kind: 'unary'
  op: '-' | 'NOT'
  expr: Expr
}
export interface Binary {
  kind: 'binary'
  op: string // + - * / ^ MOD = <> < > <= >= AND OR
  left: Expr
  right: Expr
}

// ---------- Statements ----------

export type Stmt =
  | PrintStmt
  | LetStmt
  | IfStmt
  | GotoStmt
  | GosubStmt
  | ReturnStmt
  | ForStmt
  | NextStmt
  | WhileStmt
  | WendStmt
  | InputStmt
  | DimStmt
  | ReadStmt
  | DataStmt
  | RestoreStmt
  | RemStmt
  | EndStmt
  | StopStmt
  | ClsStmt
  | SaveStmt
  | LoadStmt
  | SetStmt
  | PauseStmt
  | PokeStmt
  | SoundStmt
  | PlayStmt

// PRINT items: expression, ';' (tight), ',' (tab to next zone)
export interface PrintItem {
  expr?: Expr
  sep?: ';' | ','
}
export interface PrintStmt {
  kind: 'print'
  items: PrintItem[]
  trailing: boolean // true if line ends with ; or , (suppress newline)
}

// Assignment target is a scalar or array element.
export interface LValue {
  name: string
  indices?: Expr[]
}
export interface LetStmt {
  kind: 'let'
  target: LValue
  value: Expr
}

export interface IfStmt {
  kind: 'if'
  cond: Expr
  then: Stmt[] // statements (a bare line number becomes a GOTO)
  else?: Stmt[]
}
export interface GotoStmt {
  kind: 'goto'
  line: number
}
export interface GosubStmt {
  kind: 'gosub'
  line: number
}
export interface ReturnStmt {
  kind: 'return'
}
export interface ForStmt {
  kind: 'for'
  varName: string
  start: Expr
  end: Expr
  step?: Expr
}
export interface NextStmt {
  kind: 'next'
  vars: string[] // NEXT, NEXT I, or NEXT I, J
}
export interface WhileStmt {
  kind: 'while'
  cond: Expr
}
export interface WendStmt {
  kind: 'wend'
}
export interface InputStmt {
  kind: 'input'
  prompt?: string
  // true  -> append "? " after the prompt (INPUT "x"; a  or bare INPUT a)
  // false -> show the prompt as-is, no "? " (INPUT "x", a) — gives a bare cursor
  question: boolean
  targets: LValue[]
}
export interface DimStmt {
  kind: 'dim'
  decls: { name: string; dims: Expr[] }[]
}
export interface ReadStmt {
  kind: 'read'
  targets: LValue[]
}
export interface DataStmt {
  kind: 'data'
  values: (number | string)[]
}
export interface RestoreStmt {
  kind: 'restore'
  line?: number
}
export interface RemStmt {
  kind: 'rem'
  text: string
}
export interface EndStmt {
  kind: 'end'
}
export interface StopStmt {
  kind: 'stop'
}
export interface ClsStmt {
  kind: 'cls'
}
// SAVE key$, e1, e2, ...  — persist a list of values under a string key.
export interface SaveStmt {
  kind: 'save'
  key: Expr
  values: Expr[]
}
// LOAD key$, v1, v2, ...  — restore previously saved values into variables.
export interface LoadStmt {
  kind: 'load'
  key: Expr
  targets: LValue[]
}
// SET(x,y) / RESET(x,y) — turn a graphics pixel on/off (on=true for SET).
export interface SetStmt {
  kind: 'set'
  on: boolean
  x: Expr
  y: Expr
}
// PAUSE ms — suspend the program for a number of milliseconds (for animation).
export interface PauseStmt {
  kind: 'pause'
  ms: Expr
}
// POKE addr, value — write a byte to memory; video RAM (15360-16383) draws.
export interface PokeStmt {
  kind: 'poke'
  addr: Expr
  value: Expr
}
// SOUND freq, ms — play a square-wave tone (freq Hz) for ms; blocks until done.
export interface SoundStmt {
  kind: 'sound'
  freq: Expr
  ms: Expr
}
// PLAY "mml" — play a tune written in note notation (a small MML subset).
export interface PlayStmt {
  kind: 'play'
  mml: Expr
}
