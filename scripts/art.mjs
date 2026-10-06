// Run with: node scripts/art.mjs

import { writeFileSync } from 'node:fs'

const at = (a, r) => [(100 + Math.cos(a) * r).toFixed(1), (100 + Math.sin(a) * r).toFixed(1)]
const eight = Array.from({ length: 8 }, (_, i) => (i * Math.PI) / 4)
const spokes = eight.map(a => `<line x1="${at(a, 14)[0]}" y1="${at(a, 14)[1]}" x2="${at(a, 62)[0]}" y2="${at(a, 62)[1]}"/>`).join('')
const grips = eight.map(a => `<line x1="${at(a, 62)[0]}" y1="${at(a, 62)[1]}" x2="${at(a, 80)[0]}" y2="${at(a, 80)[1]}" stroke-width="7"/>`).join('')
const wheel = `<g fill="none" stroke="#6fe3b0" stroke-linecap="round"><circle cx="100" cy="100" r="62" stroke-width="5"/><circle cx="100" cy="100" r="12" stroke-width="4"/><g stroke-width="3">${spokes}</g>${grips}</g>`

writeFileSync(new URL('../docs/icon.svg', import.meta.url), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200"><rect width="200" height="200" rx="40" fill="#05061f"/>${wheel}</svg>\n`)

