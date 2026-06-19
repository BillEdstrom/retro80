// Development log for Retro80. Newest entries first. Shown in the in-app
// Development Log (Help menu). Keep entries short and factual.

export interface DevLogEntry {
  version: string
  date: string
  title: string
  notes: string[]
}

export const DEVLOG: DevLogEntry[] = [
  {
    version: '0.22.0',
    date: '2026-06-11',
    title: 'FRESH 80 — a new hip-hop show for the demon',
    notes: [
      'A brand-new dance show, FRESH 80, with all-new sprite poses (not a re-sequence of the old moves): a bounce/groove, the running man, raise-the-roof, points left and right, a crouch freeze, and a side kick.',
      'An original boom-bap groove in A minor (single-voice MML), the demon now sporting shades, a pixel boombox on the floor, and a title that flashes before the beat drops.',
      'Written from scratch in Retro80 BASIC, so it is fully hackable: LIST it to remix the choreography (DATA 4000-4030), the move bitmaps (DATA 2000-2720), or the beat (the PLAY string). Comes with its own ⓘ INFO manual.',
      'Note on the real 1979 Dancing Demon: its 26 moves are Z80 machine code, not editable data, so new animation styles can only be added in our own homage engine — which is exactly what FRESH 80 is.'
    ]
  },
  {
    version: '0.21.1',
    date: '2026-06-10',
    title: 'ADVENTURE gets an operator\'s manual too',
    notes: [
      'The \u24d8 INFO manual (with right-click) now also works in the Console: any sample can carry one, and ADVENTURE is the first — Crowther & Woods history, the verb list, and eight tips covering the lamp, the bird and the rod, the fissure, the snake, the dwarf, the pirate, and the magic words.',
      'The manual is shared infrastructure now (one HelpPanel component for the emulator and the Console), so future samples can add their own.'
    ]
  },
  {
    version: '0.21.0',
    date: '2026-06-10',
    title: 'ADVENTURE grows up: the full Colossal Cave quest',
    notes: [
      'The ADVENTURE sample was a 5-room stub; it is now a real Colossal Cave based on Crowther & Woods (1977): 25 locations with the canonical prose, from the well house down through the Hall of Mists and the Hall of the Mountain King to Y2 and a maze of twisty little passages, all alike.',
      'Six treasures and 350-point scoring; the wicker cage, the rod-shy little bird and the snake it drives away; the crystal bridge over the fissure (wave the rod); a knife-throwing dwarf who drops his axe; and a bearded pirate who steals your treasure and hides it with his chest deep in the maze.',
      'Lamp power management, pitch-dark pit deaths with reincarnation, XYZZY and PLUGH, TAKE ALL, and SAVE / LOAD n game slots.',
      'Verified with a scripted full playthrough in the interpreter: a perfect 350/350 win, plus edge-case tests for darkness deaths, the bird/rod rule, save/load, and dwarf encounters.'
    ]
  },
  {
    version: '0.20.0',
    date: '2026-06-10',
    title: "Operator's manuals for every TRS-80 program",
    notes: [
      'Every entry in the TRS-80 section now has a built-in manual: click the new \u24d8 INFO button in the bar (or right-click the screen) for what the program is, how to play it, and a TIPS & HINTS section.',
      'Covers all seven: Level II BASIC itself, Dancing Demon, Dog Star Adventure, Android Nim (including the winning Nim strategy), Pyramid 2000, Haunted House, and Luna Lander.',
      'While the manual is open, keystrokes stay in the panel (Esc closes it) instead of reaching the emulated machine.'
    ]
  },
  {
    version: '0.19.1',
    date: '2026-06-10',
    title: 'Console sized like the real screen',
    notes: [
      'The console now scales exactly like the TRS-80 (and the emulator view): 64 columns always fill the available width, so the characters are the same big chunky size as the emulated machine instead of a small fixed font floating in black space.'
    ]
  },
  {
    version: '0.19.0',
    date: '2026-06-10',
    title: 'Four more classics, and the real Model I font in our console',
    notes: [
      'Added four genuine preserved programs to the TRS-80 section: Android Nim (1978, Leo Christopherson — the Dancing Demon\'s older sibling), Pyramid 2000 (1979, Radio Shack), Haunted House (1979, Radio Shack), and Luna Lander (1978, Walter Smith).',
      'BASIC tapes still load via authentic cassette CLOAD; machine-language images (Pyramid\'s CMD, Haunted House\'s SYSTEM tape) are now written into memory and jumped to, the way a disk system loaded them.',
      'Our own console now renders in the real TRS-80 Model I character set: an OpenType font generated from the genuine character-generator ROM bitmaps (the lowercase-mod CG, so both toggle states are covered), with the authentic tall 1:3 cell and box-drawing glyphs. Generator: scripts/build-trs80-font.mjs.',
      'New headless smoke-test harness (scripts/trs80-smoke.mjs) boots the real emulator in Node, loads a program, and dumps the text screen — used to verify every variant before embedding. Keys are now held ~84ms so machine-language games that scan the keyboard matrix themselves never miss a press.',
      'Microsoft Adventure was researched but skipped: it was a copy-protected disk-only release and no clean TRS-80 disk image exists in the accessible archives.'
    ]
  },
  {
    version: '0.18.0',
    date: '2026-06-10',
    title: 'TRS-80 section: bare Level II BASIC, Dog Star Adventure, and ROM-true errors',
    notes: [
      'The sidebar now has a TRS-80 MODEL I section: boot the real machine to a bare Level II BASIC READY prompt (type your own programs on the genuine ROM), or load a preserved classic from cassette.',
      'Added "Dog Star Adventure" (Lance Micklus, SoftSide magazine, May 1979) — the first adventure game ever published as source code, running from the original preserved tape image.',
      'Used the real Level II ROM as the reference to make our own BASIC console more authentic: errors now report the genuine terse codes ("?SN ERROR IN 100", TM, FC, BS, RG, NF, UL, OD, /0...) and PRINT comma zones are the true 16 columns (was 14). Extensions Level II never had (WHILE/WEND) keep descriptive messages. Documented in the Syntax Guide; covered by new unit tests.'
    ]
  },
  {
    version: '0.17.0',
    date: '2026-06-10',
    title: 'Now "Retro80" — and a real app icon',
    notes: [
      'Renamed from RetroBASIC to Retro80: with the bundled BASIC interpreter and a real emulated TRS-80 inside, it had grown past "just BASIC." The window/menu/About/banner all say Retro80 now.',
      'Added a custom macOS app icon — a vintage beige computer with a phosphor-green CRT showing the Dancing Demon\'s face — replacing the default Electron icon.',
      'The internal app name and your saved-programs folder were left untouched by the rename, so nothing was lost.'
    ]
  },
  {
    version: '0.16.0',
    date: '2026-06-10',
    title: 'Factory presets vs. your own programs',
    notes: [
      'The sidebar now has two sections: MY PROGRAMS (your saved, editable, deletable programs) and SAMPLES (the built-in examples).',
      'Samples are now read-only "factory presets" served straight from the bundled source — they are never written to disk, so editing one can no longer corrupt the original. A preset and your edited copy of it can coexist (same name, different sections).',
      'Saving always writes to MY PROGRAMS, so opening a preset, tweaking it, and saving makes your own copy and leaves the preset pristine. Stopped auto-seeding samples to disk and cleaned up the old seeded copies (which restored a DEMON sample that had been edited).'
    ]
  },
  {
    version: '0.15.0',
    date: '2026-06-10',
    title: 'The real Dancing Demon — authentic TRS-80 port',
    notes: [
      "Embedded Lawrence Kesteloot's MIT-licensed TypeScript TRS-80 Model I emulator (with the bundled Level II BASIC ROM) and the genuine 1979 Dancing Demon program (preserved tokenized BASIC), reachable from the new \"Dancing Demon\" sidebar view.",
      'Loads it the authentic way a 1979 cassette did: encodes the program as 500-baud cassette audio and has the emulated BASIC CLOAD it — after memory-injection proved unreliable (BASIC will not recognize a program poked straight into RAM).',
      'A real 500-baud load is ~4 minutes, so the CPU runs unthrottled (at the true clock, so decode timing still holds) during the load with a progress bar; completion is detected when CLOAD switches the cassette motor off.',
      "The result is the real thing: title screen, the full menu, speed-factor and performance prompts, and the original detailed demon tap-dancing to \"Ain't She Sweet\" — pixel- and sound-accurate. Our own hand-drawn DEMON sample stays as a separate Retro80 graphics/sound demo.",
      "Sound (the demon makes music through the cassette-output port) plays via the emulator's AudioWorklet: enabled on the first click/keypress (browsers only start audio from a user gesture) and unblocked by widening the Content-Security-Policy to allow the worklet's data: module."
    ]
  },
  {
    version: '0.14.0',
    date: '2026-06-09',
    title: 'Animation speed tuner',
    notes: [
      'Graphics screen now shows a live FPS readout and a SPEED control that scales PAUSE ([ slower, ] faster).',
      'Lets us watch an animation and dial in a good frame rate, then bake the right PAUSE value into the program — handy while tuning the demon.'
    ]
  },
  {
    version: '0.13.0',
    date: '2026-06-09',
    title: 'Background music (PLAY "MB")',
    notes: [
      'Added MS-BASIC-style MB/MF: PLAY "MB ..." schedules the tune on the Web Audio timeline and returns immediately, so a program can animate while music plays.',
      'Stop and a new run cut any background music (stopSound hook).',
      'This is the prerequisite for the Dancing Demon: smooth animation over continuous music. JAM sample bounces a box to background music.'
    ]
  },
  {
    version: '0.12.0',
    date: '2026-06-09',
    title: 'Sound: SOUND and PLAY',
    notes: [
      'SOUND freq, ms plays a square-wave tone (authentic buzzy timbre) via Web Audio; both block and are abortable with Stop.',
      'PLAY "notes" plays a tune in a small MML subset (notes A-G with accidentals, octave, length, tempo, rests).',
      'Toward the Dancing Demon clone, whose figure we will recreate from the original\'s documented frames once the music is in place. MUSIC sample added.'
    ]
  },
  {
    version: '0.11.0',
    date: '2026-06-09',
    title: 'Graphics, slice 3: POKE / PEEK video RAM',
    notes: [
      'POKE addr, byte writes to memory; video RAM (15360-16383) maps to the screen cells and draws graphics blocks (128-191).',
      'PEEK(addr) reads it back. This is the exact "poke graphic blocks on and off in memory" technique from the TRS-80 days.',
      'POKEART sample draws a block border and diagonal by poking video memory directly.'
    ]
  },
  {
    version: '0.10.0',
    date: '2026-06-09',
    title: 'Graphics, slice 2: animation timing (PAUSE)',
    notes: [
      'Added PAUSE ms so programs can pace animation (FOR-loop delays are instant on modern hardware).',
      'Routed through an abortable host delay, so Stop interrupts a paused program just like INPUT.',
      'BOUNCE sample animates a box around the graphics screen.'
    ]
  },
  {
    version: '0.9.0',
    date: '2026-06-09',
    title: 'Graphics, slice 1: SET / RESET / POINT',
    notes: [
      'First slice of the TRS-80 graphics system toward a Dancing Demon clone.',
      'Faithful 64x16 cell / 128x48 pixel screen model in the engine; SET/RESET/POINT and graphics-aware CLS.',
      'Rendered pixel-accurately on a canvas with tall TRS-80-style pixels (4:3). The screen appears on first SET; Esc exits.',
      'Deferred to later slices: PRINT@, POKE/PEEK video RAM, a unified text+graphics screen, timing/animation, and sound.'
    ]
  },
  {
    version: '0.8.0',
    date: '2026-06-09',
    title: 'Help menu: Development Log & About',
    notes: [
      'Added an application menu with Help → Development Log and About Retro80.',
      'About now lists the tech stack and version/build info.',
      'Researched the TRS-80 "Dancing Demon": its animation/sound are Z80 machine code embedded in BASIC DATA statements and run via USR(), so the original needs a Z80 emulator. The block-graphics technique itself (poking video RAM, SET/RESET) is portable and tracked as a separate graphics-mode feature.'
    ]
  },
  {
    version: '0.7.0',
    date: '2026-06-09',
    title: 'Lowercase mod',
    notes: [
      'Sidebar toggle that emulates a lowercase-modified TRS-80: the console stops forcing uppercase so mixed case shows through. Persisted across restarts.',
      'String literals already preserved their case in the data; only the stock uppercase-only display hid it.'
    ]
  },
  {
    version: '0.6.0',
    date: '2026-06-09',
    title: 'UNDO',
    notes: [
      'UNDO command with a 30-level snapshot stack covering line edits, deletions, NEW, and RENUM.',
      'Snapshots only when the program actually changes; loading a different program starts fresh undo history.'
    ]
  },
  {
    version: '0.5.0',
    date: '2026-06-09',
    title: 'EDIT and modern caret editing',
    notes: [
      'EDIT n pulls a line back into the prompt for in-place editing.',
      'The console cursor renders at the real caret position (inverse block), so arrow keys, Home/End, and mid-line edits are visible.'
    ]
  },
  {
    version: '0.4.x',
    date: '2026-06-09',
    title: 'TRS-80 Model I authenticity and a critical lockup fix',
    notes: [
      'Reworked the console into an inline terminal: the cursor lives in the text flow and you type where the prompt is.',
      'White phosphor on black, fixed 64-column screen, all-caps display, ":" command cursor, clear-on-move in ADVENTURE.',
      'INPUT supports the comma form (no "?") for a bare cursor; STOP/break reports "BREAK AT nnnn" with no "?".',
      'Fixed a console lock-up: opening a program while another was waiting on INPUT orphaned its input. INPUT is now abortable at the engine level (Stop always recovers) and loads stop any running program first.'
    ]
  },
  {
    version: '0.3.0',
    date: '2026-06-09',
    title: 'Persistence',
    notes: [
      'SAVE/LOAD statements and EXISTS() for programs to persist state (localStorage-backed, survives restarts).',
      'ADVENTURE gained in-game SAVE (slot 1-3) and LOAD n.'
    ]
  },
  {
    version: '0.2.0',
    date: '2026-06-09',
    title: 'Language depth and the first real adventure',
    notes: [
      'Added RENUM (renumbers lines and fixes GOTO/GOSUB/THEN/ELSE/RESTORE targets) and the string functions INSTR, UCASE$, LCASE$.',
      'Compiled IF/THEN/ELSE into flat conditional jumps so GOSUB/GOTO/FOR work correctly inside a one-line THEN.',
      'Wrote ADVENTURE, a compact Colossal Cave homage, as a built-in sample.',
      'Fixed a tokenizer bug where REM dropped the end-of-line token and crashed every program.'
    ]
  },
  {
    version: '0.1.0',
    date: '2026-06-09',
    title: 'Scaffold and interpreter core',
    notes: [
      'Set up Electron + electron-vite + React + TypeScript; installed portable Node since the machine had none.',
      'Built the interpreter as UI-free modules: tokenizer -> parser -> tree-walking engine, with a BasicSession REPL brain.',
      'Implemented the language core: PRINT, LET, IF/THEN/ELSE, GOTO, GOSUB/RETURN, FOR/NEXT, WHILE/WEND, INPUT, DIM/arrays, DATA/READ/RESTORE, and math/string built-ins.',
      'UI: retro console, editor, sidebar program library, Quick Start and Syntax Guide.'
    ]
  }
]
