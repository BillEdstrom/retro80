# CLAUDE.md — RetroBASIC

Guidance for Claude Code (and humans) working in this repository. Read this
before making changes.

## What this is

RetroBASIC is a native macOS desktop app (Electron + TypeScript + React) that
implements an interactive, vintage **Microsoft/TRS-80–style BASIC** interpreter.
It is a personal scripting toy meant to stay simple while growing over time.
The interpreter is the heart of the project; the UI is a retro green-phosphor
terminal with a sidebar of saved programs and integrated docs.

## ⛔ Non-negotiable: unit testing is mandatory

**Every change to the interpreter MUST be covered by unit tests, and
`npm test` MUST pass before any work is considered done.** No exceptions.

- New language feature (keyword, function, operator) → add tests that exercise
  it, including edge cases.
- Bug fix → add a **regression test** that fails before the fix and passes
  after. (Recent examples: the `REM`-tokenizer crash and the
  `IF…THEN GOSUB : GOTO` control-flow bug both have dedicated regression tests.)
- Refactor → the existing suite must stay green; do not delete tests to make
  them pass.
- Never mark a task complete, and never tell the user it works, without having
  run `npm test` and seen it pass. If you also changed UI/build wiring, run
  `npm run typecheck` and `npm run build` too.

Tests live in `src/renderer/src/basic/*.test.ts` and use Node's built-in test
runner via `tsx`. They drive the interpreter through `BasicSession` with a fake
`Host`, so they need no DOM or Electron. Keep them fast and deterministic
(`RND` is seeded). Prefer testing through `BasicSession` (parse → run → assert
on captured output) over testing internals.

## Commands

```bash
npm run dev        # launch the app with hot reload (does NOT bump the build #)
npm test           # run the interpreter unit tests — REQUIRED before done
npm run typecheck  # type-check main + renderer
npm run build      # production bundle in ./out (bumps the build number)
npm run dist:mac   # installable .dmg / .zip in ./dist (unsigned, personal use)
```

Node is installed portably at `~/.local/node` (no system Node, no Homebrew). In
a non-interactive shell that doesn't source `~/.zshrc`, prefix commands with
`export PATH="$HOME/.local/node/bin:$PATH"`.

## Architecture

```
src/
  main/index.ts      Electron main process: window + program file storage (IPC)
  preload/index.ts   Safe bridge exposing window.api to the renderer
  renderer/src/
    basic/           THE INTERPRETER (no UI/DOM dependencies)
      tokenizer.ts     source text -> tokens
      ast.ts           AST node type definitions
      parser.ts        tokens -> statements (one line at a time)
      builtins.ts      built-in functions (the easiest place to extend)
      interpreter.ts   the execution engine (Engine)
      index.ts         BasicSession — the REPL brain (program editing, commands)
      *.test.ts        unit tests
    components/      Sidebar, Terminal, Editor, QuickStart, SyntaxGuide
    samples.ts       seeded example programs (incl. ADVENTURE)
    version.ts       version/build constants (injected at build time)
```

### How the engine runs a program (important)

The program is **compiled to a flat list of ops** with a single program
counter. `IF/THEN/ELSE` is compiled away into internal `ifgoto`/`jmp` ops
(`Engine.emit()` in `interpreter.ts`) so that **every** statement — including
ones inside a one-line `THEN` — has its own PC slot. This is what makes
`IF X THEN GOSUB 100 : GOTO 10` behave correctly. If you add block-structured
constructs (e.g. `BEGIN…END`), follow the same compile-to-jumps pattern.

Variable/array/DATA state lives on the `Engine` and persists across `RUN` and
immediate commands, like a real BASIC. Strings are `$`-suffixed names, integers
`%`-suffixed. BASIC truth is `-1`; false is `0`.

### Extending the language

- **New function** (e.g. `INSTR`): add it to `builtins.ts` (impl + arity). The
  parser auto-recognizes any name in `BUILTIN_NAMES`. Then add tests.
- **New statement / keyword** (e.g. `BEGIN`): add the keyword in
  `tokenizer.ts`, a node in `ast.ts`, a parse rule in `parser.ts`, and an
  execution case in `interpreter.ts`. `WHILE/WEND` is a good template. Then add
  tests, and document it in `components/SyntaxGuide.tsx`.

## Versioning

Semantic version lives in `package.json` (`MAJOR.MINOR.PATCH`); the build
number lives in `build-number.json` and is auto-incremented by
`scripts/bump-build.mjs` on every `npm run build`. Both are injected at build
time (`define` in `electron.vite.config.ts`) and surfaced via `version.ts`,
shown after the **RetroBASIC** title and in the banner / sidebar.

Bump rules:

- **MAJOR** — incompatible language change (existing programs may break).
- **MINOR** — new backward-compatible language feature or notable UI feature.
- **PATCH** — bug fix or polish with no new language surface.

When you ship a user-visible change: bump the `package.json` version per the
rules above and add an entry to `CHANGELOG.md`. The build number takes care of
itself.

## Conventions & gotchas

- Match the surrounding code style; keep the interpreter UI-free.
- The preload bundles to `index.mjs` (because `"type": "module"`); the main
  process must reference `../preload/index.mjs`.
- The prompt is `>`; returning to command level prints `READY` (TRS-80 style),
  centralized in `BasicSession.execute()`. Display is uppercase-friendly for
  nostalgia, but the language itself is case-insensitive for keywords.
- If `npm run dev` ever fails with "Electron failed to install", the Electron
  binary download left a stub — re-extract the cached zip into
  `node_modules/electron/dist`.
