// Redraws docs/map.svg from made-up data, through the same code the panel uses.
// Run with: bun scripts/shots.mjs

import { writeFileSync } from 'node:fs'
import { layout, svg } from '../src/graph.ts'

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
const now = 100_000
const used = { 'skill:testing': now - 1500, 'skill:debugging': now - 3000, 'skill:citations': now - 5000 }
const body = svg(layout(index), used, now)
writeFileSync(new URL('../docs/map.svg', import.meta.url), `${body.replace('<svg ', '<svg style="background:#05061f" ')}\n`)
console.log('docs/map.svg written')
