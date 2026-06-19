// Registry of programs for the bundled TRS-80 Model I emulator. Each entry is
// a genuine preserved program, or `null` bytes for a bare machine that just
// boots to Level II BASIC.
//
// Load methods:
//  - 'cassette': tokenized BASIC, encoded as 500-baud audio and CLOADed by the
//    ROM — exactly how a 1979 tape loaded. Authentic, shows a progress bar.
//  - 'direct': machine-language images (CMD files / SYSTEM cassettes) written
//    straight into memory and jumped to, the way a disk system loaded them.

import { DEMON_BYTES } from './dancingDemon'
import { DOGSTAR_BYTES } from './dogStar'
import { NIM_BYTES } from './androidNim'
import { PYRAMID_BYTES } from './pyramid'
import { HAUNTED_BYTES } from './hauntedHouse'
import { LUNAR_BYTES } from './lunarLander'

// Per-program manual: shown from the ⓘ INFO button / right-click in the
// emulator view. `play` is how to operate it; `hints` are tips & tricks
// (kept light on spoilers).
import type { ProgramHelp } from '../programHelp'
export type Trs80Help = ProgramHelp

export interface Trs80Program {
  id: string
  // Shown in the emulator's title bar.
  title: string
  // Program image, or null to boot to READY with no program.
  bytes: Uint8Array | null
  // How to get it into the machine.
  load: 'cassette' | 'direct'
  // Usage hint shown in the bar while running.
  hint: string
  help: Trs80Help
}

export const TRS80_PROGRAMS: Record<string, Trs80Program> = {
  basic: {
    id: 'basic',
    title: 'TRS-80 MODEL I — LEVEL II BASIC',
    bytes: null,
    load: 'cassette',
    hint: 'a real Level II BASIC — type a program right here',
    help: {
      about:
        'The genuine 1978 Microsoft Level II BASIC ROM, running on an emulated TRS-80 Model I (1.77 MHz Z80, 48K RAM, 64×16 text screen). This is the real machine — anything a 1979 magazine listing could do, you can type here.',
      play: [
        'Type numbered lines to build a program; bare commands run immediately.',
        'RUN executes, LIST shows the program, NEW erases it.',
        'PRINT, INPUT, FOR/NEXT, GOTO, GOSUB, IF/THEN, DATA/READ — full Level II.',
        'Graphics: SET(x,y), RESET(x,y) and POINT(x,y) on the 128×48 block grid.',
        'Errors come back as authentic codes: ?SN ERROR IN 10 means a syntax error.',
        'Backspace works (it is the Model I left-arrow); Escape is the BREAK key.'
      ],
      hints: [
        'Stuck in a running program? Escape (BREAK) stops it; CONT resumes.',
        'PRINT can be abbreviated ? — try ? 2+2.',
        'PEEK and POKE work: the screen lives at 15360–16383. POKE 15360,42 puts a * in the corner.',
        'The classic one-liner: 10 PRINT "RETRO80 "; : GOTO 10'
      ]
    }
  },
  demon: {
    id: 'demon',
    title: 'TRS-80 MODEL I — THE DANCING DEMON (1979, LEO CHRISTOPHERSON)',
    bytes: DEMON_BYTES,
    load: 'cassette',
    hint: 'the real program · 6 or 7 plays a preset show',
    help: {
      about:
        "Leo Christopherson's famous animation showcase, sold by Radio Shack in 1979. A demon tap-dances to \"Ain't She Sweet\" using Z80 machine code hidden inside BASIC DATA statements — you can compose your own music and choreography for him.",
      play: [
        'At the menu, press 6 or 7 to play a preset show.',
        'Then ENTER SPEED FACTOR: 1 is super fast, 255 is slow motion — try 20-40.',
        'Then ENTER NUMBER OF PERFORMANCES — how many times he runs the routine.',
        'Press the space bar to stop a show early.',
        'Option 1 composes a musical score (up to 255 chords); option 2 builds a dance from the move alphabet (A-Z: steps, squats, stomps, turns, kicks, jumps).',
        'Options 4 and 5 (tape save/load) are from the cassette era — skip them.'
      ],
      hints: [
        'Click or press a key once so the 🔊 sound is enabled — the music comes out the emulated cassette port.',
        'In the dance editor, the number after each move is its beat count; SPACE previews the dance as you build it.',
        'A good show is mostly steps with a squat or spin jump as punctuation — just like the presets.',
        'Watch his eyes. The original reviewers did.'
      ]
    }
  },
  dogstar: {
    id: 'dogstar',
    title: 'TRS-80 MODEL I — DOG STAR ADVENTURE (1979, LANCE MICKLUS)',
    bytes: DOGSTAR_BYTES,
    load: 'cassette',
    hint: 'two-word commands: GO NORTH, GET KEYS, LOOK, INVEN, HELP',
    help: {
      about:
        'Lance Micklus\'s 1979 space rescue — the first adventure game ever published as source code (SoftSide magazine, May 1979). General Doom has captured Princess Leya and her treasury; you are the computer hidden aboard her shuttle. "Star Wars in all but name."',
      play: [
        'Two-word commands: GO NORTH, GET KEYS, DROP GUN, READ SIGN.',
        'Directions can be abbreviated to two letters: NO, SO, EA, WE, UP, DO.',
        'Useful words: LOOK, INVEN (inventory), HELP, SCORE, QUIT.',
        'The parser is strict 1979 vintage: if it says I DON\'T KNOW HOW TO DO THAT, re-phrase with verb + noun.',
        'SAVE GAME / LOAD GAME used a real tape recorder — not useful here.'
      ],
      hints: [
        'There are clues almost everywhere you look — LOOK at and READ everything.',
        'Draw a map as you explore; guards end the game quickly if you blunder.',
        'You need to rescue the Princess, her Shinestone necklace, AND the treasury for full credit.',
        'That big red BLAST OFF button ends the game — make sure everything (and everyone) is aboard first.',
        'The author\'s own advice: "Once you know all of the secrets, you can play it in ten minutes and get a perfect score."'
      ]
    }
  },
  nim: {
    id: 'nim',
    title: 'TRS-80 MODEL I — ANDROID NIM (1978, LEO CHRISTOPHERSON)',
    bytes: NIM_BYTES,
    load: 'cassette',
    hint: 'animated robots · pick a row (1-3) and how many to remove',
    help: {
      about:
        "Leo Christopherson's first animation hit (1978) — the Dancing Demon's older sibling. Three rows of fidgeting androids play the ancient game of Nim against you; the robots blink, look around, and get zapped when removed.",
      play: [
        'Read the on-screen rules, press ENTER, and wait for the androids to assemble.',
        'When the * appears it is your turn: press a row number (1, 2 or 3), then how many androids to remove from that row. No ENTER needed.',
        'You may remove any number of androids from one row per turn.',
        'Whoever removes the LAST android WINS.',
        'Press R to resign.'
      ],
      hints: [
        'Nim has perfect strategy: XOR the three row counts (write each in binary). A position is losing for whoever moves if the XOR is zero.',
        'So: always leave your opponent a zero-XOR position — e.g. equal pairs like 2-2 or 1-1 with the third row empty.',
        'Opening with rows of 7-5-3? XOR is 1, so the first player can win: remove 1 from the 7 row, then mirror from there.',
        'The androids watch the cursor while they wait. They know.'
      ]
    }
  },
  pyramid: {
    id: 'pyramid',
    title: 'TRS-80 MODEL I — PYRAMID 2000 (1979, RADIO SHACK)',
    bytes: PYRAMID_BYTES,
    load: 'direct',
    hint: 'explore the pyramid: NORTH, TAKE LAMP, LOOK, INVENTORY',
    help: {
      about:
        "Radio Shack's Egyptian adventure (1979, by Robert Arnstein) — a compact Colossal Cave in machine language. Explore the pyramid of an ancient pharaoh, survive its tricks, and escape with the treasures.",
      play: [
        'Two-word (or one-word) commands at the : prompt.',
        'Movement: NORTH, SOUTH, EAST, WEST, UP, DOWN — or just N, S, E, W, U, D.',
        'TAKE and DROP objects; LOOK re-describes the room; INVENTORY lists what you carry.',
        'SCORE shows your progress. Treasures count when brought back out.',
        'If it says I DON\'T KNOW THAT WORD, try a shorter or different word.'
      ],
      hints: [
        'Do not wander in the dark — find a light source before going deep.',
        'EXAMINE (or LOOK at) anything that gets a special mention; the descriptions hide clues.',
        'Map every room — passages are not always symmetric (going back the way you came may not work).',
        'Treasures sparkle in the descriptions. To win, carry them OUT of the pyramid.',
        'Stuck? Classic adventure rule: try things that would be a terrible idea in real life.'
      ]
    }
  },
  haunted: {
    id: 'haunted',
    title: 'TRS-80 MODEL I — HAUNTED HOUSE (1979, RADIO SHACK)',
    bytes: HAUNTED_BYTES,
    load: 'direct',
    hint: 'two-word commands: READ PAPER, OPEN DOOR, GO NORTH',
    help: {
      about:
        'Radio Shack\'s spooky starter adventure (1979) — gentler than Pyramid 2000, and a great first text adventure. Get inside the old house, find what it hides, and get out.',
      play: [
        'Two-word commands at the : prompt: verb then noun.',
        'You start outside: that CRUMPLED PIECE OF PAPER is there for a reason — TAKE PAPER, READ PAPER.',
        'OPEN DOOR, GO NORTH (or N/S/E/W/U/D), TAKE and DROP objects.',
        'LOOK re-describes where you are; INVENTORY lists your items.'
      ],
      hints: [
        'Read everything. The paper is your first clue.',
        'Doors and containers can be OPENed; furniture can be LOOKed at and moved.',
        'Map the house, including up and down — old houses have attics and cellars.',
        'If something seems haunted… it probably reacts to the right object or word.'
      ]
    }
  },
  lunar: {
    id: 'lunar',
    title: 'TRS-80 MODEL I — LUNA LANDER (1978, WALTER SMITH)',
    bytes: LUNAR_BYTES,
    load: 'cassette',
    hint: 'answer the prompts with numbers · land softly',
    help: {
      about:
        'Walter Smith\'s 1978 take on the classic moon-landing problem: a rocket falls toward the surface and you decide, burn by burn, how much fuel to spend slowing down. Physics is unforgiving; fuel is finite.',
      play: [
        'Answer the prompts with NUMBERS (it is 1978 BASIC: type 0 for no, 1 for yes when asked about instructions).',
        'Pick a mode: 1 NOVICE, 2 INTERMEDIATE, 3 EXPERT.',
        'Each turn shows FUEL, ALT (altitude) and VEL (velocity), then asks AMOUNT OF FUEL TO BE BURNED.',
        'Burning fuel slows your descent (DIRECTION UP means you are climbing!). Burning 0 saves fuel but you fall faster.',
        'Touch down with a very low velocity to land instead of crater.'
      ],
      hints: [
        'The classic strategy is the "suicide burn": burn little or nothing early, then brake hard late — it is the most fuel-efficient profile.',
        'But do not overdo it: if VEL flips to DIRECTION UP you are wasting fuel bouncing.',
        'Aim to arrive in the last ~100 meters with plenty of fuel and moderate speed, then feather small burns to touch down gently.',
        'Out of fuel high up = a very expensive crater. Leave a reserve.'
      ]
    }
  }
}
