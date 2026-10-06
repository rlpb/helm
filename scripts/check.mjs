#!/usr/bin/env node
// Consistency check that needs no Claude Code binary: the versions in plugin.json and
// marketplace.json must agree.

import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = path => JSON.parse(readFileSync(join(root, path), 'utf8'))

const manifest = read('.claude-plugin/plugin.json')
const marketplace = read('.claude-plugin/marketplace.json')
const problems = []
const entry = marketplace.plugins?.find(p => p.name === manifest.name)
if (!entry) problems.push(`marketplace.json has no plugin named "${manifest.name}"`)
else if (entry.version !== manifest.version) problems.push(`plugin.json says ${manifest.version}, marketplace.json says ${entry.version}`)
if (marketplace.metadata?.version !== manifest.version) problems.push(`marketplace.json metadata says ${marketplace.metadata?.version}, plugin.json says ${manifest.version}`)

if (problems.length) {
  for (const p of problems) console.error(`error: ${p}`)
  process.exit(1)
}
console.log(`ok: ${manifest.name} ${manifest.version}`)
