interface Entry {
  syntax: string
  desc: string
  example?: string
}
interface Section {
  title: string
  entries: Entry[]
}

const SECTIONS: Section[] = [
  {
    title: 'Commands (type at the prompt)',
    entries: [
      { syntax: 'RUN [line]', desc: 'Run the program (optionally from a line number).' },
      { syntax: 'LIST [a-b]', desc: 'List the program, or a line range.' },
      { syntax: 'EDIT n', desc: 'Pull line n back to the prompt to edit it in place.' },
      { syntax: 'UNDO', desc: 'Undo the last line edit/deletion (up to 30 levels).' },
      { syntax: 'RENUM [start[, step]]', desc: 'Renumber lines (default 10 by 10) and fix GOTO/GOSUB targets.' },
      { syntax: 'NEW', desc: 'Erase the program.' },
      { syntax: 'CLEAR', desc: 'Reset variables (keep the program).' }
    ]
  },
  {
    title: 'Output & Variables',
    entries: [
      { syntax: 'PRINT a; b, c', desc: '; joins tightly, , tabs to the next column zone. A trailing ; or , suppresses the newline.', example: 'PRINT "X ="; X' },
      { syntax: '? expr', desc: '? is shorthand for PRINT.', example: '? 2 + 2' },
      { syntax: 'LET v = expr', desc: 'Assign a value. LET is optional.', example: 'A = 10 : B$ = "HI"' },
      { syntax: 'name / name$ / name%', desc: 'Plain names are numbers; a $ suffix means string; a % suffix means integer.' },
      { syntax: "REM text   ' text", desc: 'A comment to the end of the line. The apostrophe is shorthand for REM.', example: "10 REM SETUP   ' or like this" }
    ]
  },
  {
    title: 'Control Flow',
    entries: [
      { syntax: 'IF cond THEN … [ELSE …]', desc: 'THEN may be a line number (a GOTO) or statements. ELSE is optional.', example: 'IF X > 9 THEN PRINT "BIG" ELSE PRINT "SMALL"' },
      { syntax: 'GOTO line', desc: 'Jump to a line number.' },
      { syntax: 'GOSUB line … RETURN', desc: 'Call a subroutine and come back.' },
      { syntax: 'FOR v = a TO b [STEP s] … NEXT [v]', desc: 'Counted loop. STEP may be negative.', example: 'FOR I = 10 TO 1 STEP -1 : PRINT I : NEXT' },
      { syntax: 'WHILE cond … WEND', desc: 'Loop while a condition is true.', example: 'WHILE X < 5 : X = X + 1 : WEND' },
      { syntax: 'END / STOP', desc: 'Stop the program. STOP reports the line.' }
    ]
  },
  {
    title: 'Input & Data',
    entries: [
      { syntax: 'INPUT ["prompt"; v]', desc: 'Read one or more values. A semicolon after the prompt appends "? "; a comma shows the prompt as-is (a bare cursor, e.g. ":").', example: 'INPUT ":", CMD$' },
      { syntax: 'DATA v, v, …', desc: 'Inline constants for READ. Quote strings that contain spaces.' },
      { syntax: 'READ v, …', desc: 'Read the next DATA value(s) into variables.' },
      { syntax: 'RESTORE [line]', desc: 'Rewind the DATA pointer (optionally to a line).' },
      { syntax: 'DIM a(n[, m …])', desc: 'Declare an array. Indices run 0..n. Arrays auto-size to 10 if used without DIM.', example: 'DIM SCORE(100)' }
    ]
  },
  {
    title: 'Saving & loading state',
    entries: [
      { syntax: 'SAVE key$, e1, e2, …', desc: 'Persist a list of values under a string key (survives quitting the app).', example: 'SAVE "GAME1", SCORE, LEVEL, X, Y' },
      { syntax: 'LOAD key$, v1, v2, …', desc: 'Restore saved values into variables. If the key has nothing saved, the variables are left unchanged.', example: 'LOAD "GAME1", SCORE, LEVEL, X, Y' },
      { syntax: 'EXISTS(key$)', desc: 'True (-1) if something has been SAVEd under that key, else 0. Check before LOAD.', example: 'IF EXISTS("GAME1") THEN LOAD "GAME1", S' }
    ]
  },
  {
    title: 'Graphics (TRS-80 block graphics)',
    entries: [
      { syntax: 'SET(x, y)', desc: 'Turn on a graphics pixel. The screen is 128 wide (x: 0-127) by 48 tall (y: 0-47).', example: 'SET(64, 24)' },
      { syntax: 'RESET(x, y)', desc: 'Turn a graphics pixel off.' },
      { syntax: 'POINT(x, y)', desc: 'Returns -1 if the pixel at x,y is set, else 0.', example: 'IF POINT(10, 10) THEN PRINT "ON"' },
      { syntax: 'CLS', desc: 'Clears text and graphics. The graphics screen appears when you first SET; press Esc to exit it.' },
      { syntax: 'PAUSE ms', desc: 'Suspend the program for ms milliseconds — used to pace animation (plain FOR loops are instant here).', example: 'PAUSE 30' },
      { syntax: 'POKE addr, byte', desc: 'Write a byte to memory. Video RAM is 15360-16383 (one byte per cell); poke 128-191 for a graphics block.', example: 'POKE 15360, 191' },
      { syntax: 'PEEK(addr)', desc: 'Read a byte. In video RAM, returns the cell’s code; elsewhere, the last value poked (or 0).', example: 'B = PEEK(15360)' }
    ]
  },
  {
    title: 'Sound',
    entries: [
      { syntax: 'SOUND freq, ms', desc: 'Play a square-wave tone at freq Hz for ms milliseconds (freq 0 = silence). Blocks until done.', example: 'SOUND 440, 200' },
      { syntax: 'PLAY "notes"', desc: 'Play a tune in note notation: A-G (with #/+/-), O4 octave, > < shift, L4 length, T120 tempo, P rest. MB plays in the background (program keeps running); MF (default) blocks.', example: 'PLAY "MB T120 C E G > C"' }
    ]
  },
  {
    title: 'Errors (authentic Level II codes)',
    entries: [
      { syntax: '?SN ERROR IN 100', desc: 'Errors are reported with TRS-80 Level II two-letter codes, matched against the real ROM in the built-in emulator. SN = syntax error.' },
      { syntax: 'SN  TM  FC  BS', desc: 'Syntax · Type mismatch · Illegal function call · Bad subscript.' },
      { syntax: 'RG  NF  UL  OD  /0  LS  OM', desc: 'RETURN without GOSUB · NEXT without FOR · Undefined line · Out of DATA · Division by zero · String too long · Out of memory.' },
      { syntax: 'BREAK AT 100', desc: 'The Stop button (BREAK) interrupts a running program — not an error, so no "?". Extensions Level II never had (like WHILE/WEND) keep descriptive messages.' }
    ]
  },
  {
    title: 'Operators',
    entries: [
      { syntax: '+  -  *  /  ^  MOD', desc: 'Arithmetic. ^ is power, MOD is remainder. + also joins strings.' },
      { syntax: '=  <>  <  >  <=  >=', desc: 'Comparisons. A true result is -1, false is 0.' },
      { syntax: 'AND  OR  NOT', desc: 'Logical combinators.' }
    ]
  },
  {
    title: 'Math functions',
    entries: [
      { syntax: 'ABS SGN INT FIX', desc: 'Absolute value, sign, floor, truncate-toward-zero.' },
      { syntax: 'SQR SIN COS TAN ATN', desc: 'Square root and trigonometry (radians).' },
      { syntax: 'LOG EXP', desc: 'Natural log and e^x.' },
      { syntax: 'RND(x)', desc: 'Random number in [0, 1). Multiply and INT for ranges.', example: 'INT(RND(1) * 6) + 1' }
    ]
  },
  {
    title: 'String functions',
    entries: [
      { syntax: 'LEN(s)', desc: 'Length of a string.' },
      { syntax: 'LEFT$(s,n)  RIGHT$(s,n)', desc: 'First / last n characters.' },
      { syntax: 'MID$(s,start[,len])', desc: 'Substring (start is 1-based).' },
      { syntax: 'CHR$(n)  ASC(s)', desc: 'Character from a code / code of first character. Use CHR$ for box-drawing.' },
      { syntax: 'STR$(n)  VAL(s)', desc: 'Number→string / string→number.' },
      { syntax: 'SPACE$(n)  STRING$(n, c)', desc: 'n spaces / n copies of a character.' },
      { syntax: 'INSTR([start,] s, sub)', desc: 'Find sub in s; returns the 1-based position, or 0 if not found.', example: 'P = INSTR("GET LAMP", " ")' },
      { syntax: 'UCASE$(s)  LCASE$(s)', desc: 'Upper- / lower-case a string (handy for parsing input).' },
      { syntax: 'TAB(n)  SPC(n)', desc: 'In PRINT: move to column n / emit n spaces.' }
    ]
  }
]

export default function SyntaxGuide(): JSX.Element {
  return (
    <div className="page">
      <h1>Syntax Guide</h1>
      <p className="lead">
        A reference for the Retro80 language. Keywords are case-insensitive; they’re
        shown in uppercase by convention. Statements can be joined on one line with a colon
        <code> : </code>.
      </p>
      {SECTIONS.map((sec) => (
        <section key={sec.title} className="guide-section">
          <h2>{sec.title}</h2>
          <table className="ref-table">
            <tbody>
              {sec.entries.map((e, i) => (
                <tr key={i}>
                  <td className="ref-syntax"><code>{e.syntax}</code></td>
                  <td>
                    {e.desc}
                    {e.example && (
                      <div className="ref-example"><code>{e.example}</code></div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
      <h2>Extending the language</h2>
      <p>
        New looping and block constructs (you mentioned <code>WHILE/WEND</code> — already
        here — plus <code>BEGIN/END</code> blocks) slot in cleanly: add the keyword to the
        tokenizer, a node to the AST, a parse rule, and an execution case. New functions
        need only an entry in <code>builtins.ts</code>.
      </p>
    </div>
  )
}
