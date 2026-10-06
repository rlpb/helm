// Redraws docs/map.svg from made-up data, with the same layout the panel uses.
// The README copy loops: a few skills light up one after another and fade, so the page shows
// what the live Map does without a recording. Run with: bun scripts/map.mjs

import { writeFileSync } from 'node:fs'
import { COLOR, H, W, layout } from '../src/graph.ts'

const entry = (name, category, on = true) => ({ key: `skill:${name}`, kind: 'skill', name, description: '', category, on })
const index = [
  ...['debugging', 'testing', 'refactor', 'review', 'git-flow', 'deploy'].map(n => entry(n, 'build')),
  ...['editing', 'tone', 'translate', 'summary'].map(n => entry(n, 'write')),
  ...['papers', 'citations', 'survey'].map(n => entry(n, 'research')),
  ...['ui-kit', 'brand', 'diagrams', 'icons', 'layout'].map(n => entry(n, 'design')),
  ...['seo', 'sitemap', 'crawl'].map(n => entry(n, 'web', false)),
  ...['sql', 'charts', 'csv'].map(n => entry(n, 'data')),
  ...['audit', 'secrets'].map(n => entry(n, 'security')),
  ...['pdf', 'slides', 'sheets'].map(n => entry(n, 'docs')),
]

const hex = n => `#${n.toString(16).padStart(6, '0')}`
const lay = layout(index)
const CYCLE = 12 // seconds
const SHOWN = ['skill:testing', 'skill:citations', 'skill:ui-kit', 'skill:sql', 'skill:editing', 'skill:debugging', 'skill:audit', 'skill:pdf']

const out = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="Segoe UI,Helvetica,Arial,sans-serif">`]
out.push(
  '<defs>',
  '<radialGradient id="bg" cx="50%" cy="45%" r="75%"><stop offset="0" stop-color="#0d2547"/><stop offset="1" stop-color="#050a1d"/></radialGradient>',
  '<filter id="glow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="4"/></filter>',
  '</defs>',
  `<rect width="${W}" height="${H}" rx="18" fill="url(#bg)"/>`,
)
for (let i = 1; i <= 5; i++) out.push(`<circle cx="${W / 2}" cy="${H / 2}" r="${i * 55}" fill="none" stroke="#9fb4d6" stroke-opacity="0.05"/>`)
for (const e of lay.edges) out.push(`<line x1="${e.from[0].toFixed(1)}" y1="${e.from[1].toFixed(1)}" x2="${e.to[0].toFixed(1)}" y2="${e.to[1].toFixed(1)}" stroke="${hex(COLOR[e.cat])}" stroke-opacity="0.28"/>`)
out.push(`<circle cx="${W / 2}" cy="${H / 2}" r="14" fill="#6fe3b0" fill-opacity="0.18"/><circle cx="${W / 2}" cy="${H / 2}" r="7" fill="#e8ecf4"/>`)

let lit = 0
for (const n of lay.nodes) {
  const c = hex(COLOR[n.cat] ?? COLOR.other)
  const x = n.x.toFixed(1)
  const y = n.y.toFixed(1)
  if (n.hub) {
    out.push(
      `<circle cx="${x}" cy="${y}" r="13" fill="${c}" fill-opacity="0.2"/><circle cx="${x}" cy="${y}" r="8" fill="${c}"/>`,
      `<text x="${x}" y="${(n.y + (n.reach ?? 24) + 18).toFixed(1)}" fill="${c}" font-size="13" font-weight="600" text-anchor="middle" letter-spacing="0.5">${n.label}</text>`,
    )
    continue
  }
  const base = n.on ? 0.7 : 0.22
  const shown = SHOWN.indexOf(n.key)
  if (shown < 0) {
    out.push(`<circle cx="${x}" cy="${y}" r="4.5" fill="${c}" fill-opacity="${base}"/>`)
    continue
  }
  // Lit in turn: a soft halo swells and fades, the dot brightens and settles.
  const a = (shown / SHOWN.length) * 0.84
  const kt = `0;${a.toFixed(3)};${(a + 0.03).toFixed(3)};${(a + 0.16).toFixed(3)};1`
  const loop = `dur="${CYCLE}s" repeatCount="indefinite" calcMode="linear" keyTimes="${kt}"`
  out.push(
    `<circle cx="${x}" cy="${y}" r="4.5" fill="${c}" opacity="0" filter="url(#glow)"><animate attributeName="opacity" values="0;0;0.95;0;0" ${loop}/><animate attributeName="r" values="4.5;4.5;16;5;4.5" ${loop}/></circle>`,
    `<circle cx="${x}" cy="${y}" r="4.5" fill="${c}" fill-opacity="${base}"><animate attributeName="fill-opacity" values="${base};${base};1;${base};${base}" ${loop}/><animate attributeName="r" values="4.5;4.5;7.5;4.5;4.5" ${loop}/></circle>`,
  )
  lit += 1
}
out.push('</svg>')
writeFileSync(new URL('../docs/map.svg', import.meta.url), `${out.join('')}\n`)
console.log(`docs/map.svg written, ${lit} skills light up in turn`)
