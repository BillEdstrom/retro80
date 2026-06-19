export default function QuickStart(): JSX.Element {
  return (
    <div className="page">
      <h1>Getting Started</h1>
      <p className="lead">
        Retro80 is a small, friendly BASIC in the spirit of vintage Microsoft BASIC.
        You write numbered lines to build a program, then <code>RUN</code> it — just like
        on an 8-bit machine. When you’re ready, peek at the <strong>Examples</strong> and{' '}
        <strong>Demos</strong> tabs and press <strong>Run</strong> to see them go.
      </p>

      <h2>Two ways to work</h2>
      <ol>
        <li>
          <strong>Console</strong> — type commands at the <code>]</code> prompt. Numbered
          lines (e.g. <code>10 PRINT "HI"</code>) are added to the program. Bare commands
          like <code>PRINT 2+2</code> run immediately.
        </li>
        <li>
          <strong>Editor</strong> — write the whole program in one place, press{' '}
          <strong>Run</strong>, and save it to the sidebar.
        </li>
      </ol>

      <h2>Your first program</h2>
      <pre className="code-block">{`10 PRINT "WHAT IS YOUR NAME";
20 INPUT N$
30 PRINT "HELLO, "; N$; "!"
40 FOR I = 1 TO 3
50   PRINT "BASIC IS FUN"
60 NEXT I`}</pre>
      <p>
        Type those lines into the Console (or Editor), then run <code>RUN</code>. Use{' '}
        <code>LIST</code> to see your program and <code>NEW</code> to clear it.
      </p>

      <h2>Essential commands</h2>
      <table className="ref-table">
        <tbody>
          <tr><td><code>RUN</code></td><td>execute the current program</td></tr>
          <tr><td><code>LIST</code></td><td>show the program (also <code>LIST 10-50</code>)</td></tr>
          <tr><td><code>EDIT n</code></td><td>pull line <code>n</code> back to the prompt to edit it (arrow keys, etc.)</td></tr>
          <tr><td><code>UNDO</code></td><td>undo the last line edit/deletion (up to 30 levels)</td></tr>
          <tr><td><code>NEW</code></td><td>erase the program</td></tr>
          <tr><td><code>RENUM [start[, step]]</code></td><td>renumber lines (default 10 by 10) and fix GOTO/GOSUB targets</td></tr>
          <tr><td><code>CLEAR</code></td><td>reset variables (keep the program)</td></tr>
          <tr><td><code>CLS</code></td><td>clear the screen</td></tr>
        </tbody>
      </table>

      <h2>Vintage box-drawing characters</h2>
      <p>
        Use <code>CHR$</code> with these codes to draw frames and corners in the classic
        terminal style:
      </p>
      <pre className="code-block">{`┌ CHR$(9484)    ┐ CHR$(9488)    ─ CHR$(9472)
└ CHR$(9492)    ┘ CHR$(9496)    │ CHR$(9474)
├ CHR$(9500)    ┤ CHR$(9508)    ┼ CHR$(9532)`}</pre>
      <p>Open the <strong>BOX</strong> example above to see them in action.</p>

      <h2>Lowercase mod</h2>
      <p>
        A stock TRS-80 Model I was uppercase-only, so the console displays in caps.
        Flip the <strong>Lowercase mod</strong> switch at the bottom of the sidebar to
        emulate a lowercase-modified machine — mixed case (including lowercase in your
        string literals) then shows through. The underlying program text always keeps
        its case either way.
      </p>

    </div>
  )
}
