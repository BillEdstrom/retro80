// Tokenizer for Retro80 — turns a line of source into a flat list of tokens.
// Vintage BASIC is line-oriented and case-insensitive; keywords are uppercased.

export type TokenType =
  | 'number'
  | 'string'
  | 'ident' // a variable / function name, e.g. A, X1, NAME$, COUNT%
  | 'keyword' // PRINT, IF, FOR, ...
  | 'op' // + - * / ^ = <> < > <= >= ( ) , ; :
  | 'eol'

export interface Token {
  type: TokenType
  value: string
  // For numbers we keep the parsed numeric value too.
  num?: number
  // Column where the token started (handy for error messages).
  col: number
}

// Reserved words. Functions (LEFT$, etc.) are tokenized as identifiers and
// resolved at call time, so they are intentionally NOT in this set.
export const KEYWORDS = new Set([
  'PRINT', 'LET', 'IF', 'THEN', 'ELSE', 'GOTO', 'GOSUB', 'RETURN',
  'FOR', 'TO', 'STEP', 'NEXT', 'WHILE', 'WEND', 'INPUT', 'DIM',
  'READ', 'DATA', 'RESTORE', 'REM', 'END', 'STOP', 'CLS', 'DEF',
  'AND', 'OR', 'NOT', 'MOD', 'RUN', 'LIST', 'NEW', 'CLEAR', 'TAB',
  'SPC', 'SAVE', 'LOAD', 'SET', 'RESET', 'PAUSE', 'POKE', 'SOUND', 'PLAY'
])

const TWO_CHAR_OPS = new Set(['<>', '<=', '>=', '><', '=<', '=>'])

export function tokenize(line: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  const n = line.length

  const isDigit = (c: string): boolean => c >= '0' && c <= '9'
  const isAlpha = (c: string): boolean =>
    (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z')

  while (i < n) {
    const c = line[i]

    // Whitespace
    if (c === ' ' || c === '\t' || c === '\r') {
      i++
      continue
    }

    // ' is a shorthand for REM (comment to end of line)
    if (c === "'") {
      tokens.push({ type: 'keyword', value: 'REM', col: i })
      const text = line.slice(i + 1)
      tokens.push({ type: 'string', value: text, col: i + 1 })
      break
    }

    // Strings
    if (c === '"') {
      const start = i
      i++
      let s = ''
      while (i < n && line[i] !== '"') {
        s += line[i]
        i++
      }
      i++ // closing quote (tolerated if missing at EOL)
      tokens.push({ type: 'string', value: s, col: start })
      continue
    }

    // Numbers: 12, 12.5, .5, 1e3, 1.5E-2
    if (isDigit(c) || (c === '.' && isDigit(line[i + 1] ?? ''))) {
      const start = i
      let s = ''
      while (i < n && isDigit(line[i])) s += line[i++]
      if (line[i] === '.') {
        s += line[i++]
        while (i < n && isDigit(line[i])) s += line[i++]
      }
      if (line[i] === 'e' || line[i] === 'E') {
        s += line[i++]
        if (line[i] === '+' || line[i] === '-') s += line[i++]
        while (i < n && isDigit(line[i])) s += line[i++]
      }
      tokens.push({ type: 'number', value: s, num: parseFloat(s), col: start })
      continue
    }

    // Identifiers / keywords: letter, then letters/digits, optional $ or % suffix
    if (isAlpha(c)) {
      const start = i
      let s = ''
      while (i < n && (isAlpha(line[i]) || isDigit(line[i]))) s += line[i++]
      if (line[i] === '$' || line[i] === '%') s += line[i++]
      const upper = s.toUpperCase()

      // REM swallows the rest of the line.
      if (upper === 'REM') {
        tokens.push({ type: 'keyword', value: 'REM', col: start })
        // skip a single leading space after REM
        let rest = line.slice(i)
        if (rest.startsWith(' ')) rest = rest.slice(1)
        tokens.push({ type: 'string', value: rest, col: i })
        break // stop scanning; the eol token is appended below
      }

      if (KEYWORDS.has(upper)) {
        tokens.push({ type: 'keyword', value: upper, col: start })
      } else {
        tokens.push({ type: 'ident', value: upper, col: start })
      }
      continue
    }

    // ? is an alias for PRINT
    if (c === '?') {
      tokens.push({ type: 'keyword', value: 'PRINT', col: i })
      i++
      continue
    }

    // Two-char operators
    const two = line.slice(i, i + 2)
    if (TWO_CHAR_OPS.has(two)) {
      // Normalise alternate spellings
      let v = two
      if (v === '><') v = '<>'
      if (v === '=<') v = '<='
      if (v === '=>') v = '>='
      tokens.push({ type: 'op', value: v, col: i })
      i += 2
      continue
    }

    // Single-char operators / punctuation
    if ('+-*/^=<>(),;:'.includes(c)) {
      tokens.push({ type: 'op', value: c, col: i })
      i++
      continue
    }

    throw new BasicSyntaxError(`Unexpected character '${c}'`, i)
  }

  tokens.push({ type: 'eol', value: '', col: n })
  return tokens
}

export class BasicSyntaxError extends Error {
  col: number
  constructor(message: string, col = 0) {
    super(message)
    this.name = 'BasicSyntaxError'
    this.col = col
  }
}
