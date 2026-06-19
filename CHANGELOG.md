# Changelog

All notable changes to RetroBASIC. Versioning is semantic
(`MAJOR.MINOR.PATCH`); see `CLAUDE.md` for the bump rules. The build number is
tracked separately in `build-number.json`.

## [0.14.0]

### Added
- **Animation speed tuner** on the graphics screen: a live frame-rate readout
  (FPS) and a SPEED control that scales `PAUSE` (50% = twice as fast, 200% = half
  speed). Adjust with the on-screen buttons or `[` / `]`. Lets you dial in a good
  frame rate while watching, then bake the right `PAUSE` value into the program.

## [0.13.0]

### Added
- **Background music.** `PLAY "MB ..."` (music background) schedules the whole
  tune on the audio timeline and returns immediately, so a program can animate
  while music plays; `MF` (default) blocks as before. Stop / a new run cuts any
  playing music. A JAM demo bounces a box to background music.

## [0.12.0]

### Added
- **Sound.** `SOUND freq, ms` plays a square-wave tone (authentic buzzy TRS-80
  timbre, via Web Audio); `PLAY "notes"` plays a tune in a small MML note
  notation (A-G with #/+/-, `O` octave, `>`/`<` shift, `L` length, `T` tempo,
  `P` rest). Both block until finished and stop with the Stop button. A MUSIC
  demo sample is included.

## [0.11.0]

### Added
- **Graphics (slice 3): POKE / PEEK video RAM.** `POKE addr, byte` writes a byte
  to memory; addresses 15360-16383 are the screen (one byte per cell, codes
  128-191 are 2×3 graphics blocks) and draw immediately. `PEEK(addr)` reads it
  back. This is the classic "poke graphic blocks on and off in memory" technique.
  A POKEART demo sample is included.

## [0.10.0]

### Added
- **Graphics (slice 2): animation timing.** `PAUSE ms` suspends the program for
  a number of milliseconds, so animation can be paced (plain FOR loops are
  instant on modern hardware). Abortable with Stop. A BOUNCE demo sample shows a
  box animating around the graphics screen.

## [0.9.0]

### Added
- **Graphics (slice 1):** TRS-80 block graphics. `SET(x,y)` / `RESET(x,y)` turn
  pixels on/off on a 128×48 screen, `POINT(x,y)` tests one, and `CLS` clears it.
  Rendered pixel-accurately on a canvas (tall TRS-80-style pixels, 4:3). A
  GRAPHICS demo sample is included.
- Deferred to later slices: PRINT@, POKE/PEEK video RAM, unified text+graphics
  screen, timing/animation, and sound.

## [0.8.0]

### Added
- Application menu with **Help → Development Log** and **About RetroBASIC**.
- **Development Log** overlay — a dated history of the build.
- **About** overlay — version/build plus the tech stack.

## [0.7.0]

### Added
- **Lowercase mod** toggle (sidebar) — emulates a lowercase-modified TRS-80: the
  console stops forcing uppercase so mixed case, including lowercase in string
  literals, shows through. Off = stock Model I (uppercase-only). Persisted across
  restarts. The program data always preserves case regardless.

## [0.6.0]

### Added
- `UNDO` command — steps back through line edits, deletions, `NEW`, and `RENUM`,
  up to 30 levels within a session. Loading a different program starts a fresh
  undo history.

## [0.5.0]

### Added
- `EDIT n` command — pulls a program line back into the prompt so you can edit
  it in place and press Enter to save it.
- The console cursor now renders at the **real caret position** (an inverse
  block over the character you're on), so arrow keys, Home/End, and mid-line
  edits show where you are — modern editing inside the vintage screen.

## [0.4.4]

### Fixed
- **Console lock-up**: opening a program from the sidebar while another program
  was running (e.g. waiting at an INPUT prompt) orphaned the running program's
  input, froze the keyboard, and couldn't be recovered with Stop. Now:
  - `INPUT` is abortable at the engine level, so **Stop always breaks free**.
  - Loading a program first stops and unwinds any running one.
  - All runs go through a single in-flight path that can't overlap.

## [0.4.3]

### Changed
- A break (Stop button or `STOP`) now reads `BREAK AT nnnn` with no leading
  `?`, matching the TRS-80 (the `?` is reserved for real errors like
  `?SN ERROR`).

## [0.4.2]

### Fixed
- ADVENTURE: blocked-move messages ("A LOCKED GRATE BARS THE WAY DOWN", "YOU
  CAN'T GO THAT WAY") are no longer wiped by the clear-on-move redraw — a failed
  move now keeps you on the current screen so you can read the message.

## [0.4.1]

### Changed
- Console now renders in **all caps**, matching the uppercase-only TRS-80
  Model I display. Display-only — stored data keeps its original case.

## [0.4.0]

### Added
- `INPUT "prompt", var` (comma) shows the prompt with **no** `? ` — a bare
  cursor — matching TRS-80/MS BASIC. `INPUT "prompt"; var` (semicolon) still
  appends `? `.

### Changed
- **Console is now an inline terminal**: the cursor lives in the text flow and
  you type right where the prompt is (no separate input box). Break a running
  program with the Stop button.
- **TRS-80 Model I styling**: white phosphor on black, fixed 64-column screen.
- ADVENTURE now **clears the screen on each move** (TRS-80 / home-computer
  style) and uses a `:` command cursor instead of `?`.

## [0.3.0]

### Added
- Persistence statements: `SAVE key$, …values` and `LOAD key$, …vars`, plus the
  `EXISTS(key$)` function. Backed by a key/value store that survives app
  restarts. Programs can now save and restore state.
- ADVENTURE now has in-game **SAVE** (prompts for slot 1–3) and **LOAD n**
  commands built on the new persistence statements.

## [0.2.0]

### Added
- `RENUM [start[, step]]` — renumber program lines and rewrite the targets of
  `GOTO`/`GOSUB`/`THEN`/`ELSE`/`RESTORE`.
- String functions: `INSTR`, `UCASE$`, `LCASE$`.
- **ADVENTURE** sample — a compact Colossal Cave homage with a two-word parser,
  lamp/keys/grate puzzle, darkness, and the `XYZZY` magic word.
- Run / Stop controls on the console (titlebar).
- A blinking block cursor (TRS-80 style) in the console.
- Versioning system: semantic version + auto-incrementing build number, shown
  after the RetroBASIC title.

### Changed
- Command prompt is now `>` (was `]`); BASIC prints `READY` (TRS-80 style) when
  returning to command level, so `CLS` lands at the top of a cleared screen.
- Opening a program from the sidebar now loads it into the Console (with an
  inline `Y/N` replace confirmation) instead of a dialog box.

### Fixed
- `REM` comment lines no longer crash the tokenizer (a missing end-of-line
  token). This had been breaking every sample program.
- `IF cond THEN GOSUB x : GOTO y` now routes correctly — `IF/THEN/ELSE` is
  compiled to flat conditional jumps so statements inside a one-line `THEN` get
  their own program-counter slot.

## [0.1.0]

- Initial interpreter: `PRINT`/`?`, `LET`, `IF/THEN/ELSE`, `GOTO`,
  `GOSUB/RETURN`, `FOR/NEXT`, `WHILE/WEND`, `INPUT`, `DIM`/arrays,
  `DATA/READ/RESTORE`, math/string built-ins.
- Electron + React UI: console, editor, sidebar program library, Quick Start &
  Syntax Guide, retro terminal theme.
