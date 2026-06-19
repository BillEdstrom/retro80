// Shared "operator's manual" shape, used by both the TRS-80 emulator programs
// and the built-in Retro80 BASIC samples. Shown via the ⓘ INFO button or a
// right-click on the screen.
export interface ProgramHelp {
  about: string
  play: string[]
  hints: string[]
}
