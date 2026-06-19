// Increments the monotonic build number in build-number.json.
// Runs automatically before every production build (npm "prebuild" hook).
// The human-facing version lives in package.json; this is just the build count.
import { readFileSync, writeFileSync } from 'node:fs'

const file = new URL('../build-number.json', import.meta.url)

let data = { build: 0 }
try {
  data = JSON.parse(readFileSync(file, 'utf8'))
} catch {
  // missing or corrupt — start fresh
}

data.build = (Number(data.build) || 0) + 1
writeFileSync(file, JSON.stringify(data, null, 2) + '\n')

console.log(`RetroBASIC build number -> ${data.build}`)
