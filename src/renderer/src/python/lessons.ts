// "Getting Started with Python" — a short course of bite-size lessons for the
// RetroPython view. Each lesson can be copied into the editor or run in the REPL.
export interface Lesson {
  title: string
  blurb: string
  code: string
}

export const PY_INTRO =
  'This is real Python (MicroPython) running on your vintage machine. Type at the >>> ' +
  'prompt to try things out — expressions print their result automatically. Or open the ' +
  'Editor to write a whole program. Work through the lessons below; press "Try it" to load ' +
  'one into the editor, or "Run" to see it go.'

// A plain-language primer for the REPL itself — the >>> prompt — shown at the top
// of the Getting Started tab. Aimed at someone who has never used a REPL.
export const REPL_GUIDE: { head: string; body: string }[] = [
  {
    head: 'What the REPL is',
    body:
      'The REPL is the >>> prompt on the REPL tab. It runs one line at a time and shows the ' +
      'result instantly. Type 2 + 2 and press Enter — it prints 4. You don’t need print() for a ' +
      'single value; the REPL echoes whatever your line evaluates to.'
  },
  {
    head: 'Multi-line code (loops, if, def)',
    body:
      'End a line with a colon (:) and the prompt changes to ... — keep typing the indented body ' +
      '(4 spaces). Press Enter on an empty line to finish the block and run it. Example: type ' +
      '“for i in range(3):”, Enter, “    print(i)”, Enter, then Enter again.'
  },
  {
    head: 'Things you make stick around',
    body:
      'Variables and functions you create at the prompt stay available for the rest of the session, ' +
      'so you can build up an answer step by step.'
  },
  {
    head: 'The Editor + Run (like “python -i”)',
    body:
      'For anything longer than a line or two, write it on the Editor tab. Press Run there — or just ' +
      'type RUN at the >>> prompt — to execute it. Afterwards its functions and variables are live at ' +
      'the prompt, so you can poke at them. Type LIST at the prompt to print the Editor’s program here.'
  }
]

export const LESSONS: Lesson[] = [
  {
    title: '1 · Hello, world',
    blurb: 'print() shows text on the screen. Strings go in quotes.',
    code: ['print("Hello, world!")', 'print("Python on a TRS-80?!")'].join('\n')
  },
  {
    title: '2 · Variables & numbers',
    blurb: 'Store values in names with =. Python does the math.',
    code: [
      'price = 12',
      'qty = 3',
      'total = price * qty',
      'print("Total:", total)',
      'print("Half:", total / 2)'
    ].join('\n')
  },
  {
    title: '3 · Strings & f-strings',
    blurb: 'Put values inside text with an f"..." string and {curly braces}.',
    code: [
      'name = "Ada"',
      'age = 36',
      'print(f"{name} is {age} years old.")',
      'print(f"Next year: {age + 1}")'
    ].join('\n')
  },
  {
    title: '4 · Lists',
    blurb: 'A list holds many values in order. Index from 0; slice with [a:b].',
    code: [
      'colors = ["red", "green", "blue"]',
      'print(colors[0])',
      'colors.append("gold")',
      'print(len(colors), "colors:", colors)'
    ].join('\n')
  },
  {
    title: '5 · if / elif / else',
    blurb: 'Make decisions. Indentation (4 spaces) marks the block.',
    code: [
      'score = 72',
      'if score >= 90:',
      '    print("A")',
      'elif score >= 60:',
      '    print("Pass")',
      'else:',
      '    print("Try again")'
    ].join('\n')
  },
  {
    title: '6 · for loops & range',
    blurb: 'Repeat over a range of numbers, or over a list.',
    code: [
      'for i in range(1, 6):',
      '    print(i, "x 7 =", i * 7)',
      '',
      'for c in ["a", "b", "c"]:',
      '    print(c.upper())'
    ].join('\n')
  },
  {
    title: '7 · while loops',
    blurb: 'Keep going until a condition is False.',
    code: ['n = 5', 'while n > 0:', '    print("countdown", n)', '    n = n - 1', 'print("liftoff!")'].join(
      '\n'
    )
  },
  {
    title: '8 · Functions',
    blurb: 'Name a reusable block with def. Give it inputs, return a result.',
    code: [
      'def area(w, h):',
      '    return w * h',
      '',
      'print(area(3, 4))',
      'print(area(10, 2))'
    ].join('\n')
  },
  {
    title: '9 · Dictionaries',
    blurb: 'Look values up by a key instead of a number.',
    code: [
      'scores = {"ada": 90, "alan": 84}',
      'print(scores["ada"])',
      'scores["grace"] = 99',
      'for name, s in scores.items():',
      '    print(name, "->", s)'
    ].join('\n')
  },
  {
    title: '10 · List comprehensions',
    blurb: 'Build a list in one expressive line.',
    code: ['squares = [n * n for n in range(1, 8)]', 'print(squares)', 'evens = [n for n in range(20) if n % 2 == 0]', 'print(evens)'].join(
      '\n'
    )
  },
  {
    title: '11 · Classes',
    blurb: 'Bundle data and behavior together into your own type.',
    code: [
      'class Dog:',
      '    def __init__(self, name):',
      '        self.name = name',
      '    def speak(self):',
      '        return f"{self.name} says woof!"',
      '',
      'd = Dog("Rex")',
      'print(d.speak())'
    ].join('\n')
  },
  {
    title: '12 · Ask the user (input)',
    blurb:
      'input() reads a line the user types. Note: live console input is still being wired up in ' +
      'RetroPython — for now it returns an empty string. The syntax is what matters here.',
    code: ['name = input("What is your name? ")', 'print(f"Hello, {name}! Welcome to RetroPython.")'].join(
      '\n'
    )
  }
]
