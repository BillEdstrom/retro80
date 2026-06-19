// Generate the DEMON sample's BASIC source from the real captured sprites
// (/tmp/demon_sprites.json) so the figure is a pixel-exact trace of the genuine
// 1979 Dancing Demon rather than a hand-drawn stick figure. Emits a ready-to-
// paste array of program lines to /tmp/demon_code.json.
import fs from 'node:fs'

const sprites = JSON.parse(fs.readFileSync('/tmp/demon_sprites.json', 'utf8'))
// Curated order -> pose index: 0 home, 1 kick-right, 2 kick-left, 3 arms-up, 4 wild
const order = [3, 5, 9, 13, 21]
const poses = order.map((fn) => sprites.find((s) => s.frame === fn).rows)
const H = poses[0].length // 30
const W = poses[0][0].length // 30

// Title font glyphs for "DANCING DEMON" letters D A N C I G E M O (5x4 each),
// preserved from the original homage.
const FN = [
  ['###.', '#..#', '#..#', '#..#', '###.'], // D
  ['.##.', '#..#', '####', '#..#', '#..#'], // A
  ['#..#', '##.#', '#.##', '#..#', '#..#'], // N
  ['.###', '#...', '#...', '#...', '.###'], // C
  ['####', '.##.', '.##.', '.##.', '####'], // I
  ['.###', '#...', '#.##', '#..#', '.###'], // G
  ['####', '#...', '###.', '#...', '####'], // E
  ['#..#', '####', '#.##', '#..#', '#..#'], // M
  ['.##.', '#..#', '#..#', '#..#', '.##.'] // O
]

// 16-beat routine cycling the five real poses (home between accents keeps the
// tap-dance feel readable).
const ROUTINE = [0, 1, 0, 2, 0, 1, 0, 2, 0, 3, 0, 4, 3, 0, 4, 0]

const q = (s) => '"' + s + '"'
const lines = []
const add = (s) => lines.push(s)

add('10 REM ---- THE DANCING DEMON (TRACED FROM THE 1979 ORIGINAL) ----')
add(`20 DIM SP$(4, ${H - 1}), FN$(8, 4), MV(15)`)
add(`30 FOR P = 0 TO 4 : FOR R = 0 TO ${H - 1} : READ SP$(P, R) : NEXT R : NEXT P`)
add('40 FOR T = 0 TO 8 : FOR R = 0 TO 4 : READ FN$(T, R) : NEXT R : NEXT T')
add('50 FOR M = 0 TO 15 : READ MV(M) : NEXT M')
add('60 KEY$ = "DANCIGEMO" : BX = 49 : BY = 15')
add('70 GOSUB 200 : REM curtain raise')
add('80 REM "Aint She Sweet" - phrase endings climb chromatically (G G# A B C)')
add(
  '85 PLAY "MB T210 O4 L8 E F+ G4 G P8 F G G+4 G+ P8 F+ G+ A4 A P8 G A B4 > C4 < P8 E F+ G4 G P8 F G G+4 G+ P8 F+ G+ A4 A P8 G A B4 > C2"'
)
add('90 FOR PS = 1 TO 4')
add('100   FOR M = 0 TO 15')
add('110     CF = MV(M)')
add('120     CLS : GOSUB 300 : GOSUB 500 : PAUSE 80')
add('130   NEXT M')
add('140 NEXT PS')
add('150 CF = 0 : CLS : GOSUB 300 : GOSUB 500 : END')
add('200 REM ---- curtain raise ----')
add('210 FOR W = 60 TO 2 STEP -4')
add('220   CLS : GOSUB 400 : CW = W : GOSUB 450 : PAUSE 55')
add('230 NEXT W')
add('240 RETURN')
add('300 REM ---- full scene ----')
add('310 GOSUB 400 : CW = 2 : GOSUB 450 : GOSUB 900 : RETURN')
add('400 FOR X = 0 TO 127 : SET(X, 0) : NEXT X')
add('410 FOR X = 4 TO 123 : SET(X, 45) : NEXT X')
add('420 RETURN')
add('450 REM ---- pleated curtains, width CW ----')
add('460 FOR Y = 1 TO 44')
add('470   FOR X = 0 TO CW : IF X - INT(X / 2) * 2 = 0 THEN SET(X, Y)')
add('480   NEXT X')
add('490   FOR X = 127 - CW TO 127 : IF X - INT(X / 2) * 2 = 0 THEN SET(X, Y)')
add('495   NEXT X')
add('498 NEXT Y')
add('499 RETURN')
add('500 REM ---- draw demon pose CF at BX,BY (1x, traced) ----')
add(`510 FOR R = 0 TO ${H - 1} : L$ = SP$(CF, R) : Y = BY + R`)
add(`520   FOR C = 1 TO ${W} : IF MID$(L$, C, 1) = "#" THEN SET(BX + C - 1, Y)`)
add('530   NEXT C')
add('540 NEXT R')
add('550 RETURN')
add('900 T$ = "DANCING DEMON" : TX = 31')
add('910 FOR I = 1 TO LEN(T$)')
add('920   CH$ = MID$(T$, I, 1)')
add('930   IF CH$ = " " THEN TX = TX + 5 : GOTO 995')
add('940   LI = INSTR(KEY$, CH$) - 1')
add('950   FOR R = 0 TO 4 : G$ = FN$(LI, R)')
add('960     FOR C = 1 TO LEN(G$) : IF MID$(G$, C, 1) = "#" THEN SET(TX + C, 1 + R)')
add('970     NEXT C')
add('980   NEXT R')
add('990   TX = TX + 5')
add('995 NEXT I')
add('998 RETURN')

// ---- sprite DATA (5 poses x H rows), 3 rows per DATA line ----
let ln = 7000
for (let p = 0; p < poses.length; p++) {
  const rows = poses[p]
  for (let r = 0; r < rows.length; r += 3) {
    const chunk = rows.slice(r, r + 3).map(q).join(', ')
    add(`${ln} DATA ${chunk}`)
    ln += 5
  }
}

// ---- title font DATA ----
ln = 8000
for (const g of FN) {
  add(`${ln} DATA ${g.map(q).join(', ')}`)
  ln += 5
}

// ---- routine DATA ----
add(`8100 DATA ${ROUTINE.join(', ')}`)

fs.writeFileSync('/tmp/demon_code.json', JSON.stringify(lines, null, 2))
console.log(`generated ${lines.length} lines -> /tmp/demon_code.json`)
console.log('first sprite preview:')
poses[0].forEach((r) => console.log(r))
