// Built-in functions for Retro80.
//
// The parser uses BUILTIN_NAMES to tell A(1) (a function call) apart from
// A(1) (an array element). The interpreter uses BUILTINS to evaluate calls.
//
// To add a function: add its name here and an entry in BUILTINS. That is the
// single place you need to touch — this is meant to be easy to extend.

import { BasicRuntimeError } from './errors'

export type BasicValue = number | string

export interface BuiltinContext {
  // RND uses a seeded PRNG so programs are reproducible within a run.
  random: () => number
}

type BuiltinFn = (args: BasicValue[], ctx: BuiltinContext) => BasicValue

function num(v: BasicValue, fn: string): number {
  if (typeof v !== 'number') throw new BasicRuntimeError(`Type mismatch in ${fn}`)
  return v
}
function str(v: BasicValue, fn: string): string {
  if (typeof v !== 'string') throw new BasicRuntimeError(`Type mismatch in ${fn}`)
  return v
}

// Format a number the way vintage BASIC does: integers without a decimal
// point, a leading space for non-negatives is handled by the PRINT routine.
export function basicNumberToString(n: number): string {
  if (Number.isInteger(n)) return String(n)
  // Trim to a reasonable precision, drop trailing zeros.
  let s = n.toPrecision(9)
  if (s.includes('.') && !s.includes('e') && !s.includes('E')) {
    s = s.replace(/0+$/, '').replace(/\.$/, '')
  }
  return s
}

export const BUILTINS: Record<string, BuiltinFn> = {
  // --- Math ---
  ABS: (a, ) => Math.abs(num(a[0], 'ABS')),
  SGN: (a) => Math.sign(num(a[0], 'SGN')),
  INT: (a) => Math.floor(num(a[0], 'INT')),
  FIX: (a) => Math.trunc(num(a[0], 'FIX')),
  SQR: (a) => Math.sqrt(num(a[0], 'SQR')),
  SIN: (a) => Math.sin(num(a[0], 'SIN')),
  COS: (a) => Math.cos(num(a[0], 'COS')),
  TAN: (a) => Math.tan(num(a[0], 'TAN')),
  ATN: (a) => Math.atan(num(a[0], 'ATN')),
  LOG: (a) => Math.log(num(a[0], 'LOG')),
  EXP: (a) => Math.exp(num(a[0], 'EXP')),
  RND: (_a, ctx) => {
    // RND(x): x>0 or omitted -> next random in [0,1). x=0 repeats last (we
    // approximate by returning a fresh value, which is fine for most uses).
    return ctx.random()
  },

  // --- Strings ---
  LEN: (a) => str(a[0], 'LEN').length,
  'LEFT$': (a) => str(a[0], 'LEFT$').slice(0, Math.max(0, num(a[1], 'LEFT$'))),
  'RIGHT$': (a) => {
    const s = str(a[0], 'RIGHT$')
    const n = Math.max(0, num(a[1], 'RIGHT$'))
    return n === 0 ? '' : s.slice(Math.max(0, s.length - n))
  },
  'MID$': (a) => {
    const s = str(a[0], 'MID$')
    const start = num(a[1], 'MID$') // 1-based
    const len = a.length > 2 ? num(a[2], 'MID$') : undefined
    const from = Math.max(0, start - 1)
    return len === undefined ? s.slice(from) : s.slice(from, from + Math.max(0, len))
  },
  'CHR$': (a) => String.fromCharCode(num(a[0], 'CHR$') & 0xffff),
  ASC: (a) => {
    const s = str(a[0], 'ASC')
    if (s.length === 0) throw new BasicRuntimeError('Illegal function call in ASC')
    return s.charCodeAt(0)
  },
  'STR$': (a) => {
    const n = num(a[0], 'STR$')
    return n >= 0 ? ' ' + basicNumberToString(n) : basicNumberToString(n)
  },
  VAL: (a) => {
    const s = str(a[0], 'VAL').trim()
    const m = s.match(/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/)
    return m ? parseFloat(m[0]) : 0
  },
  INSTR: (a) => {
    // INSTR([start,] haystack, needle) -> 1-based position, or 0 if not found.
    if (a.length === 3) {
      const start = num(a[0], 'INSTR')
      const s = str(a[1], 'INSTR')
      const sub = str(a[2], 'INSTR')
      const idx = s.indexOf(sub, Math.max(0, start - 1))
      return idx < 0 ? 0 : idx + 1
    }
    const s = str(a[0], 'INSTR')
    const sub = str(a[1], 'INSTR')
    const idx = s.indexOf(sub)
    return idx < 0 ? 0 : idx + 1
  },
  'UCASE$': (a) => str(a[0], 'UCASE$').toUpperCase(),
  'LCASE$': (a) => str(a[0], 'LCASE$').toLowerCase(),
  'SPACE$': (a) => ' '.repeat(Math.max(0, num(a[0], 'SPACE$'))),
  'STRING$': (a) => {
    const count = Math.max(0, num(a[0], 'STRING$'))
    const ch =
      typeof a[1] === 'number'
        ? String.fromCharCode(a[1] & 0xffff)
        : str(a[1], 'STRING$').charAt(0) || ' '
    return ch.repeat(count)
  }
}

// Names exposed to the parser so it can distinguish calls from array refs.
// EXISTS is implemented in the engine (it needs storage access), but must be
// listed here so the parser treats EXISTS(...) as a function call.
// EXISTS and POINT are implemented in the engine (they need session/screen
// state), but must be listed so the parser treats them as function calls.
export const BUILTIN_NAMES = new Set([
  ...Object.keys(BUILTINS),
  'EXISTS',
  'POINT',
  'PEEK'
])

// How many args each builtin expects, for friendlier errors (min..max).
export const BUILTIN_ARITY: Record<string, [number, number]> = {
  ABS: [1, 1], SGN: [1, 1], INT: [1, 1], FIX: [1, 1], SQR: [1, 1],
  SIN: [1, 1], COS: [1, 1], TAN: [1, 1], ATN: [1, 1], LOG: [1, 1],
  EXP: [1, 1], RND: [0, 1], LEN: [1, 1], 'LEFT$': [2, 2], 'RIGHT$': [2, 2],
  'MID$': [2, 3], 'CHR$': [1, 1], ASC: [1, 1], 'STR$': [1, 1], VAL: [1, 1],
  'SPACE$': [1, 1], 'STRING$': [2, 2], INSTR: [2, 3], 'UCASE$': [1, 1],
  'LCASE$': [1, 1], EXISTS: [1, 1], POINT: [2, 2], PEEK: [1, 1]
}
