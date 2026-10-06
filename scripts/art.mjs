// Draws docs/icon.svg and docs/hero.svg: a ship's wheel, then the tools around it.
// Run with: node scripts/art.mjs

import { writeFileSync } from 'node:fs'

const at = (a, r) => [(100 + Math.cos(a) * r).toFixed(1), (100 + Math.sin(a) * r).toFixed(1)]
const eight = Array.from({ length: 8 }, (_, i) => (i * Math.PI) / 4)
const spokes = eight.map(a => `<line x1="${at(a, 14)[0]}" y1="${at(a, 14)[1]}" x2="${at(a, 62)[0]}" y2="${at(a, 62)[1]}"/>`).join('')
const grips = eight.map(a => `<line x1="${at(a, 62)[0]}" y1="${at(a, 62)[1]}" x2="${at(a, 80)[0]}" y2="${at(a, 80)[1]}" stroke-width="7"/>`).join('')
const wheel = `<g fill="none" stroke="#6fe3b0" stroke-linecap="round"><circle cx="100" cy="100" r="62" stroke-width="5"/><circle cx="100" cy="100" r="12" stroke-width="4"/><g stroke-width="3">${spokes}</g>${grips}</g>`

writeFileSync(new URL('../docs/icon.svg', import.meta.url), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200"><rect width="200" height="200" rx="40" fill="#05061f"/>${wheel}</svg>\n`)

const dots = [[30, 40, '#5aa9ff'], [170, 30, '#f2b84b'], [20, 120, '#6fd08c'], [180, 150, '#b28cff'], [60, 180, '#e879b9'], [150, 185, '#5aa9ff'], [100, 12, '#4fd1d9'], [8, 70, '#f2b84b'], [192, 90, '#6fd08c']]
const rim = d => at(Math.atan2(d[1] - 100, d[0] - 100), 82)
const lines = dots.map(d => `<line x1="${rim(d)[0]}" y1="${rim(d)[1]}" x2="${d[0]}" y2="${d[1]}" stroke="${d[2]}" stroke-opacity="0.25"/>`).join('')
const circles = dots.map(d => `<circle cx="${d[0]}" cy="${d[1]}" r="5" fill="${d[2]}"/>`).join('')
writeFileSync(new URL('../docs/hero.svg', import.meta.url), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-100 0 400 200" width="800" height="400" role="img" aria-label="A ship's wheel with tools around it"><rect x="-100" width="400" height="200" rx="16" fill="#05061f"/>${lines}${circles}${wheel}</svg>\n`)
console.log('docs/icon.svg, docs/hero.svg written')
