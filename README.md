# RetroBASIC

An interactive, vintage **Microsoft-style BASIC** interpreter as a native macOS
desktop app (Electron + TypeScript + React). Write numbered lines, `RUN` them,
save programs to the sidebar, and explore an integrated Quick Start and Syntax
Guide — all with a retro green-phosphor terminal look.

Built to be a simple scripting toy you can grow over time while keeping the
plain, friendly spirit of classic BASIC.

## Features

- **Interactive console** — a real `]` prompt with command history (↑/↓).
  Numbered lines build a program; bare statements run immediately.
- **Editor** — write a whole program, **Run** it, **Save** it to the sidebar,
  or **Export** it to a `.bas` file.
- **Program library** — saved programs live in the sidebar and persist as
  `.bas` files in the app's user-data folder.
- **Integrated docs** — Quick Start and Syntax Guide pages, plus runnable
  examples (including a box-drawing demo using the vintage line/corner glyphs).
- **The language** — `PRINT` / `?`, `LET`, `IF/THEN/ELSE`, `GOTO`,
  `GOSUB/RETURN`, `FOR/NEXT` (with `STEP`), `WHILE/WEND`, `INPUT`, `DIM` &
  arrays, `DATA/READ/RESTORE`, `REM`, `END/STOP`, multi-statement lines with
  `:`, and a full set of math/string built-ins.

## Getting started

```bash
npm install      # one-time
npm run dev       # launch the app with hot reload
```

Other scripts:

```bash
npm test          # run the interpreter unit tests
npm run typecheck # type-check main + renderer
npm run build     # produce the production bundle in ./out
npm run dist:mac  # build an installable .dmg / .zip in ./dist
```

> Note: `dist:mac` produces an **unsigned** app for personal use. The first time
> you open it, right-click the app and choose **Open** to bypass Gatekeeper.

## Project layout

```
src/
  main/      Electron main process (window + program file storage via IPC)
  preload/   Safe bridge exposing window.api to the renderer
  renderer/
    src/
      basic/        The interpreter (no UI dependencies)
        tokenizer.ts    text  -> tokens
        parser.ts       tokens -> AST (one line at a time)
        ast.ts          node type definitions
        interpreter.ts  the execution engine
        builtins.ts     built-in functions (easy to extend)
        index.ts        BasicSession — the REPL brain
      components/   Sidebar, Terminal, Editor, QuickStart, SyntaxGuide
      samples.ts    seeded example programs
```

## Extending the language

The interpreter is deliberately small and layered so you can tinker:

- **New function** (e.g. `INSTR`): add it to `builtins.ts` — that's it.
- **New statement / keyword** (e.g. `BEGIN ... END` blocks): add the keyword in
  `tokenizer.ts`, a node in `ast.ts`, a parse rule in `parser.ts`, and an
  execution case in `interpreter.ts`.

`WHILE/WEND` is already implemented and is a good template to copy for new
looping constructs.
