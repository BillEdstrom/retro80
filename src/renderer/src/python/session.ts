// RetroPython session — real Python for learning, vintage-styled. MicroPython
// (WASM) runs on the main thread. The REPL has multi-line continuation and
// auto-prints expressions like CPython's >>> prompt; whole programs run from the
// editor and leave their globals live in the REPL (python -i style).
//
// input() note: MicroPython's built-in input() can't be redirected to our console
// from JS, so we shadow `input` in the program globals with our own that asks via
// a prompt and echoes to the console. (A fully in-console blocking input() needs a
// worker + SharedArrayBuffer, which proved flaky here — see the dev notes.)
import { loadMicroPython } from '@micropython/micropython-webassembly-pyscript/micropython.mjs'
import mpWasmUrl from '@micropython/micropython-webassembly-pyscript/micropython.wasm?url'

const INIT = `
import __main__, _jsb
_G = __main__.__dict__
def _input(prompt=""):
    return _jsb.input(str(prompt))
_G["input"] = _input
try:
    import builtins
    builtins.input = _input
except Exception:
    pass
def _rr(src):
    exec(compile(src, '<stdin>', 'single'), _G)
def _ex(src):
    exec(compile(src, '<program>', 'exec'), _G)
`

function strip(s: string): string {
  let out = ''
  let i = 0
  const n = s.length
  while (i < n) {
    const c = s[i]
    if (c === '#') {
      while (i < n && s[i] !== '\n') i++
      continue
    }
    if (c === '"' || c === "'") {
      const triple = s.slice(i, i + 3) === c + c + c
      i += triple ? 3 : 1
      while (i < n) {
        if (s[i] === '\\') {
          i += 2
          continue
        }
        if (triple ? s.slice(i, i + 3) === c + c + c : s[i] === c) {
          i += triple ? 3 : 1
          break
        }
        i++
      }
      continue
    }
    out += c
    i++
  }
  return out
}
function needsMore(lines: string[]): boolean {
  const last = lines[lines.length - 1]
  if (last.trim() === '') return false
  const clean = strip(lines.join('\n'))
  let depth = 0
  for (const ch of clean) {
    if (ch === '(' || ch === '[' || ch === '{') depth++
    else if (ch === ')' || ch === ']' || ch === '}') depth--
  }
  if (depth > 0) return true
  if (clean.trimEnd().endsWith('\\')) return true
  return strip(lines[0]).trimEnd().endsWith(':')
}

export class PythonSession {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mp: any = null
  private cont: string[] = []
  private loading: Promise<void> | null = null
  private out: (s: string) => void = () => {}
  private askInput: (prompt: string) => string = () => ''

  setSinks(out: (s: string) => void, askInput: (prompt: string) => string): void {
    this.out = out
    this.askInput = askInput
  }

  get ready(): boolean {
    return this.mp !== null
  }
  get continuing(): boolean {
    return this.cont.length > 0
  }

  load(): Promise<void> {
    if (this.loading) return this.loading
    this.loading = (async () => {
      const mp = await loadMicroPython({
        url: mpWasmUrl,
        linebuffer: false,
        stdout: (b: number) => this.out(String.fromCharCode(b))
      })
      mp.registerJsModule('_jsb', { input: (p: string) => this.askInput(p ?? '') })
      mp.runPython(INIT)
      this.mp = mp
    })()
    return this.loading
  }

  private exec(call: string): void {
    try {
      this.mp.runPython(call)
    } catch (e) {
      const msg = (e as { message?: string })?.message ?? String(e)
      this.out(msg.replace(/\s*$/, '') + '\n')
    }
  }

  // Feed one console line to the REPL. Returns true if more input is expected.
  replLine(line: string): boolean {
    this.cont.push(line)
    if (needsMore(this.cont)) return true
    const src = this.cont.join('\n')
    this.cont = []
    if (src.trim() !== '') this.exec('_rr(' + JSON.stringify(src) + ')')
    return false
  }

  runProgram(code: string): void {
    if (code.trim() !== '') this.exec('_ex(' + JSON.stringify(code) + ')')
  }
}
