interface Entry {
  syntax: string
  desc: string
  example?: string
}
interface Section {
  title: string
  entries: Entry[]
}

// A friendly Python reference for beginners (real Python — MicroPython).
const SECTIONS: Section[] = [
  {
    title: 'Show things & comments',
    entries: [
      { syntax: 'print(x)', desc: 'Show text or a value on the screen.', example: 'print("Hello!")' },
      { syntax: 'print(a, b)', desc: 'Show several things with spaces between them.', example: 'print("Score:", 10)' },
      { syntax: '# a comment', desc: 'Anything after # is a note for humans; Python ignores it.', example: '# this explains the code' }
    ]
  },
  {
    title: 'Variables & numbers',
    entries: [
      { syntax: 'name = value', desc: 'Store a value in a name (no LET, no line numbers).', example: 'age = 11' },
      { syntax: '+  -  *  /', desc: 'Add, subtract, multiply, divide.', example: 'total = price * 3' },
      { syntax: '**   %', desc: '** is "to the power of"; % is the remainder after dividing.', example: '2 ** 10   # 1024' },
      { syntax: 'int(x)  float(x)', desc: 'Turn text into a whole number / a decimal number.', example: 'n = int("42")' }
    ]
  },
  {
    title: 'Text (strings)',
    entries: [
      { syntax: '"..."  or  \'...\'', desc: 'Text goes in quotes — either kind.', example: 'word = "cat"' },
      { syntax: 'f"... {x} ..."', desc: 'An f-string drops a value right into the text using {curly braces}.', example: 'print(f"Hi {name}!")' },
      { syntax: 'a + b', desc: 'Join two strings together.', example: '"snow" + "man"' },
      { syntax: 'len(s)  s.upper()', desc: 'How long the text is / make it ALL CAPS.', example: 'len("hello")  # 5' }
    ]
  },
  {
    title: 'Ask the user',
    entries: [
      { syntax: 'input("prompt")', desc: 'Reads what the user types. (Live typing in the console is still being wired up — for now it returns an empty string, so set the words in variables instead.)', example: 'name = input("Your name? ")' }
    ]
  },
  {
    title: 'Lists & dictionaries',
    entries: [
      { syntax: '[a, b, c]', desc: 'A list holds many things in order. Count from 0.', example: 'colors = ["red", "blue"]' },
      { syntax: 'list[0]', desc: 'Get an item by its position (the first is 0).', example: 'colors[0]   # "red"' },
      { syntax: 'list.append(x)', desc: 'Add something to the end of a list.', example: 'colors.append("gold")' },
      { syntax: '{"key": value}', desc: 'A dictionary looks things up by a name (key) instead of a number.', example: 'scores = {"ada": 90}' }
    ]
  },
  {
    title: 'Make decisions',
    entries: [
      { syntax: 'if cond:', desc: 'Do the indented lines only if the test is true.', example: 'if score > 90:\n    print("A+")' },
      { syntax: 'elif / else', desc: 'Try another test, or do something when nothing else matched.', example: 'else:\n    print("keep going")' },
      { syntax: '==  !=  <  >  <=  >=', desc: 'Compare two things (== means "is equal to").', example: 'if age == 11:' }
    ]
  },
  {
    title: 'Repeat (loops)',
    entries: [
      { syntax: 'for x in thing:', desc: 'Do the indented lines once for each item.', example: 'for c in "hi":\n    print(c)' },
      { syntax: 'range(n)', desc: 'The numbers 0,1,2,… up to (but not including) n.', example: 'for i in range(3):\n    print(i)' },
      { syntax: 'while cond:', desc: 'Keep repeating while the test stays true.', example: 'while n > 0:\n    n = n - 1' }
    ]
  },
  {
    title: 'Functions (your own commands)',
    entries: [
      { syntax: 'def name(args):', desc: 'Make a reusable block of code with a name.', example: 'def hi(who):\n    print("Hi", who)' },
      { syntax: 'return value', desc: 'Send a result back out of a function.', example: 'def double(n):\n    return n * 2' },
      { syntax: 'name(args)', desc: 'Run (call) a function you made.', example: 'hi("Ada")' }
    ]
  },
  {
    title: 'The indentation rule',
    entries: [
      { syntax: '    (4 spaces)', desc: 'Python uses indentation (spaces at the start of a line) to show what belongs inside an if, loop, or function. Line up your blocks!' },
      { syntax: 'colon  :', desc: 'Lines that start a block (if / for / while / def) end with a colon.' }
    ]
  }
]

export default function PythonSyntax(): JSX.Element {
  return (
    <div className="page">
      <h1>Python Syntax</h1>
      <p className="lead">
        A quick reference for the most useful real Python. Unlike BASIC, Python is{' '}
        <strong>case-sensitive</strong> (<code>Name</code> and <code>name</code> are different)
        and uses <strong>indentation</strong> instead of line numbers.
      </p>
      {SECTIONS.map((sec) => (
        <section key={sec.title} className="guide-section">
          <h2>{sec.title}</h2>
          <table className="ref-table">
            <tbody>
              {sec.entries.map((e, i) => (
                <tr key={i}>
                  <td className="ref-syntax">
                    <code>{e.syntax}</code>
                  </td>
                  <td>
                    {e.desc}
                    {e.example && (
                      <div className="ref-example">
                        <code>{e.example}</code>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  )
}
