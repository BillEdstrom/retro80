# Dancing Demon (1979, Leo Christopherson) — internals

Reverse-engineered from the preserved `dncdm79a.bas` (decoded via `trs80-base`,
listing in `/tmp/demon_original.bas`) to drive the real animation engine and dump
authoritative frame/timing data for our clone.

## Shape of the program

`1 GOTO 259` skips lines 2–258, which are **not BASIC** — they hold the embedded
Z-80 machine code and the demon's shape/move tables as raw bytes inside BASIC
line storage. `259 GOTO 5000` runs the loader. Line 5000 computes the USR entry:

    N = PEEK(16549)*256 + PEEK(16548) + 13   ' = DEFUSR target (the ML entry)
    DEFUSR = N

Everything visual/audible is done by the one ML routine, called as `B = USR(0)`.
BASIC just sets up a small control block and calls it.

## Control block (POKE addresses)

| Addr  | Meaning |
|-------|---------|
| 16419 | move parameter (x-ish; RND(5) during the bow, 3 on title) |
| 16420 | move parameter (y-ish; RND(5) during the bow, 12 on title) |
| 16421 | **speed factor 1 (fast) … 255 (slow-mo)** — the timing knob — also reused to pass a key's ASC code to the editors |
| 16422 | **mode selector** (what the next USR call does) |
| 16423 | sub-command within a mode |
| 16416/16417 | screen-position params poked before a show (22 / 61) |
| 14400 | 0x3840 — keyboard row; PEEK=128 means SPACE held → stop the show |

### Modes seen in `16422`
- **21** — musical-score editor
- **23** — dance-routine editor / show setup
- **27** — pre-show ("LET THE SHOW BEGIN") draw
- **28** — play the current (entered/loaded) routine  (menu "3")
- **29** — the bow / individual-move draw (uses 16419/16420/16421 params)
- **37** — play **preset show #1**  (menu "6", default speed 40)
- **38** — play **preset show #2**  (menu "7", default speed 50)
- **39** — title-screen demon animation

### Dance-routine editor (mode 23), per-key commands (line 500–520)
- enter editor: `POKE16422,23 : POKE16423,140 : USR`
- a capital letter **A–Z**: `POKE16423,53 : POKE16421,ASC(letter) : USR` → **adds and performs that one move** ← the move vocabulary
- SPACE: `POKE16423,51 : POKE16421,50 : USR` (play-back what's entered)
- BACKSPACE (ASC 8): `POKE16423,52 : USR`
- DOWN (ASC 31): `POKE16423,47 : USR`
- ENTER: back to menu

So a "dance routine" is literally a **string of letters**, each letter a canned
move; a "score" is a string of note letters. Preset shows = stored letter strings.

## Play loop (line 2070)

    POKE16422,X : FOR Z=1 TO Z0 : B=USR(0) : IF PEEK(14400)=128 THEN stop ELSE NEXT Z

One `USR(0)` plays a **whole performance**; the ML internally sequences every
frame and inter-frame delay. So frame-stepping can't be done from BASIC — it must
be done by (a) driving the per-move editor command and capturing each frame, or
(b) instrumenting the emulator's CPU between video writes. We use both.

## The move vocabulary (read off the editor's legend)

The dance-routine editor prints the full move table. 26 letters → 18 named moves
(many with Left/Right variants), each with a **beat** duration:

| Key | Move | Beats |  | Key | Move | Beats |
|-----|------|------|--|-----|------|------|
| A | STEP #1 | 2 |  | N,O | STOMP #2 (L,R) | 4 |
| B | STEP #2 | 2 |  | P,Q | TURN (L,R) | 2 |
| C | STEP #3 | 2 |  | R,S | MOVE #1 (L,R) | 1 |
| D,E | STEP #4 (L,R) | 2 |  | T,U | MOVE #2 (L,R) | 2 |
| F,G | STEP #5 (L,R) | 2 |  | V,W | MOVE #3 (L,R) | 2 |
| H | STEP #6 | 3 |  | X | FAST JUMP | 1 |
| I | STEP #7 | 4 |  | Y | SPIN JUMP | 2 |
| J | SQUAT | 1 |  | Z | SLOW JUMP | 2 |
| K | STAND | 1 |  |   |   |   |
| L,M | STOMP #1 (L,R) | 1 |   |   |   |   |

## Driving the engine to step through a move

Letters typed into the editor are **queued**, not previewed — they animate only
when the routine is *played*. The reliable sequence (see
`scripts/dump-demon-moves.mjs`) is:

1. menu **2** → routine editor
2. **`\`** (the CLEAR key, keymap `"\\"`) → start a fresh routine
3. type a move letter (e.g. `J`) — repeat for a longer routine
4. **ENTER** → memorize, back to menu
5. menu **3** → play current routine → answer SPEED (1–255) and PERFORMANCES
6. the ML now sequences that move's sub-frames; snapshot video RAM between writes

Each captured frame is curtain-stripped and head-centred to a 30×30 sprite (same
pipeline as `capture-demon.mjs`), so the per-move frames drop straight into the
clone's sprite format.

## What a move looks like (example: J = SQUAT, captured)

The genuine SQUAT is a 10-sub-frame collapse-and-rise: the demon folds down to
just its feet, then unfurls back to full standing (horns last). So **one "beat"
is several animation sub-frames**, not a single pose.

## Timing

- A move's duration is its **beat count** (table above); a 4-beat STOMP #2 lasts
  twice a 2-beat STEP.
- Within a beat the ML draws several sub-frames with short dwells.
- Measured surprise: in isolated routine playback (menu 3, no music score),
  per-sub-frame dwell was **identical at speed factor 60, 120 and 240**. So 16421
  does **not** gate the raw frame dwell here — it governs **beat-sync to the music
  score**. With no score loaded the dance free-runs at a fixed internal rate
  (sub-frame holds ≈ 40–470 ms). The authoritative, tempo-independent timing for
  our clone is therefore: **beats per move (fixed) × ms-per-beat (our chosen
  tempo)**, distributing each move's sub-frames across its beats.

## Why single-move capture is degenerate (and presets are the answer)

`scripts/dump-demon-moves.mjs` plays a one-move routine (e.g. "JJJJ") and records
the result. Comparing the captures across moves revealed they are **nearly
identical**: every move is `rise-intro → alternate between the same ~4 core poses
→ sink-outro`; only the *number* of oscillations differs (= the move's beat
count). Two reasons:

1. **No score → generic bob.** With no musical score loaded, the engine just bobs
   the demon between a few core poses for the move's beat count. The move's real
   choreography only emerges when a score drives it.
2. **Head-centring erases L/R.** A move's identity is largely *horizontal
   position* (step/turn left vs right). Our head-centred extraction normalises
   that away, collapsing L/R pairs to the same in-place bob.

So clean per-move sprite isolation via screen-scraping is a dead end. The rich,
authentic dance lives in the **preset shows**.

## Preset shows = the canonical content

`scripts/capture-presets.mjs` plays preset show #1 (menu 6 / mode 37) and #2
(menu 7 / mode 38) and records the **full timeline with real per-frame hold
times**. Show #1 = 516 frames / 59 distinct poses; show #2 = 367 frames / 120
distinct poses. `scripts/gen-demon-presets.mjs` packs these into
`src/renderer/src/demon/presets.ts` as a shared pose palette + a timed sequence
per show. The studio (`components/DancingDemon.tsx`) replays them beat-accurately
(each pose held for as long as the original held it, scaled by a speed control).

## Decoding the music

The demon makes tones by toggling the **cassette-output latch** (a square wave);
the emulator surfaces each change as `SoundPlayer.setAudioValue(left, right,
tState, clockHz)`. `scripts/capture-music.mjs` records every transition during a
preset show and reconstructs the melody:

- The interval between two transitions is one square-wave half-cycle →
  `freq = clockHz / (2 · interval)`. Quantise into 10 ms frames, marking each with
  its pitch, then run-length-encode → notes.
- **The tone is choppy**: the CPU time-shares between drawing the demon and
  toggling the speaker, so one note sounds as bursts. Bridge short (<110 ms) gaps
  between same-pitch bursts; fold the remaining gap into the note's length
  (onset-to-onset) → sustained notes.
- **Two channels**: the melody sits in ~130–880 Hz; a steady **~1661 Hz (G#6)**
  click is a separate beat/percussion channel — filter it out (keep <1100 Hz).
- The note lengths cluster at multiples of a base beat (~370 ms at speed 40);
  quantise onset-to-onset to that grid → tempo-independent `{note, beats}`.
- **Trim the CLOAD**: the first audio events are the 500-baud tape load (~224 s of
  *emulated* time for the 14 KB program); keep only events after the show starts.

The note-level decode (above) confirmed two distinct melodies (#1 ≈ "Ain't She
Sweet", #2 a livelier number) but lost the **tap-dance clicks** (the ~1661 Hz
channel) and had approximate rhythm — it sounded off.

**What ships (exact replay).** Instead of re-synthesising, capture the *raw* audio
transitions and replay the genuine waveform. The cassette DAC is 3-level (−1, 0,
+1). `scripts/capture-audio.mjs` records every transition of a preset show as
(sample-offset @ 44100, level); `scripts/gen-demon-audio.mjs` delta-encodes them
into `src/renderer/src/demon/music.ts` (`DEMON_AUDIO`, ~60 KB for both shows).
The studio rebuilds the exact square wave into an `AudioBuffer` and loops it — so
the melody AND the tap clicks are sample-for-sample the original. Speed maps to
`playbackRate`.

**Dance↔audio lock (v0.29.0).** Capturing the dance and the audio in *separate*
runs left them drifting (different start points and totals). `scripts/capture-show.mjs`
now records both in ONE run on a single Z-80 clock: each distinct figure carries an
`onsetMs` and every audio transition a sample offset, both from the same `t0` (show
start). `scripts/gen-demon-show.mjs` emits `presets.ts` (frames as `seq`+`onsets`+
`durMs`) and `music.ts` together, trimmed to the same loop length (the music's end).
The studio plays the audio buffer (loop = `durSamples`) and derives the dance
position from the audio clock — `posMs = ((ac.currentTime − audioStart)·speed·1000)
mod durMs` — picking the pose by binary-searching `onsets`. So the footfalls land on
the tap clicks by construction, at any speed. (With sound off, the dance free-runs on
the rAF clock at the same `durMs`.) The loop now includes the demon's authentic
rise-on / sink-off at the boundaries.

**Display.** A TRS-80 graphics pixel is 4 wide × 8 tall (1:2); the studio draws
1:2 rectangles (`SCALE_X=8, SCALE_Y=16`) for the true 4:3 screen, sized to fill
the view (≈72vh), crisp `image-rendering: pixelated`, no scanline overlay — the
figure reads as one solid white character like the real machine.

Next: author an original hip-hop routine on top of the captured pose set.

## True per-move data would need disassembly

To get clean, position-aware per-move sprites we'd disassemble the embedded Z-80
(the shape table + move-definition tables in lines 2–258) rather than scrape the
screen. Logged here as a future option; the preset capture covers the immediate
need.
