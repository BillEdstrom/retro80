// Shared error types for Retro80.

export class BasicRuntimeError extends Error {
  // The BASIC line number where the error occurred, filled in by the runtime.
  line?: number
  constructor(message: string, line?: number) {
    super(message)
    this.name = 'BasicRuntimeError'
    this.line = line
  }
}

// TRS-80 Level II BASIC reported errors as terse two-letter codes —
// "?SN ERROR IN 100" — verified against the real Level II ROM in the bundled
// emulator. Map our descriptive runtime messages onto the authentic codes.
const LEVEL2_CODES: [RegExp, string][] = [
  [/^Syntax error/i, 'SN'],
  [/^RETURN without GOSUB/i, 'RG'],
  [/^NEXT without FOR/i, 'NF'],
  [/^Out of DATA/i, 'OD'],
  [/^Undefined line/i, 'UL'],
  [/^(Subscript out of range|Wrong number of subscripts)/i, 'BS'],
  [/^Division by zero/i, '/0'],
  [/^Type mismatch/i, 'TM'],
  [/^(Undefined function|Wrong number of arguments|.* is only valid in PRINT)/i, 'FC'],
  [/^String too long/i, 'LS'],
  [/^Out of memory/i, 'OM']
]

// Render an error message in Level II style ("?SN ERROR IN 100"), or null if
// the message has no Level II equivalent (e.g. WHILE/WEND, our extension).
export function level2ErrorText(message: string, line?: number): string | null {
  for (const [re, code] of LEVEL2_CODES) {
    if (re.test(message)) {
      return `?${code} ERROR${line !== undefined ? ` IN ${line}` : ''}`
    }
  }
  return null
}
