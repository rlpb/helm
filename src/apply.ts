// Turning a shortlist on for one project only: the picks are written to the folder's own
// `.claude/settings.local.json`, and the previous value of every key is kept so one press undoes it.

import type { Entry } from '../types'

export type Before = Record<string, { had: boolean; value?: unknown }>

const GROUP = (key: string) => (key.startsWith('plugin:') ? 'enabledPlugins' : 'skillOverrides')
const NAME = (key: string) => key.slice(key.indexOf(':') + 1)

function parse(text: string): Record<string, any> | null {
  try {
    const v = JSON.parse(text.trim() === '' ? '{}' : text)
    return v && typeof v === 'object' && !Array.isArray(v) ? v : null
  } catch {
    return null
  }
}

/** The file with each off pick switched on; `null` when the file is not a JSON object (left alone). */
export function applyPicks(text: string, picks: Entry[]): { text: string; before: Before } | null {
  const root = parse(text)
  if (!root) return null
  const before: Before = {}
  for (const e of picks.filter(p => !p.on)) {
    const group = GROUP(e.key)
    const bucket = root[group] && typeof root[group] === 'object' ? root[group] : {}
    before[e.key] = { had: NAME(e.key) in bucket, value: bucket[NAME(e.key)] }
    bucket[NAME(e.key)] = e.kind === 'plugin' ? true : 'on'
    root[group] = bucket
  }
  return { text: `${JSON.stringify(root, null, 2)}\n`, before }
}

/** The file with every key `applyPicks` touched put back as it was; other keys stay as they are. */
export function undoPicks(text: string, before: Before): string | null {
  const root = parse(text)
  if (!root) return null
  for (const [key, old] of Object.entries(before)) {
    const group = GROUP(key)
    const bucket = root[group]
    if (!bucket || typeof bucket !== 'object') continue
    if (old.had) bucket[NAME(key)] = old.value
    else delete bucket[NAME(key)]
    if (Object.keys(bucket).length === 0) delete root[group]
  }
  return `${JSON.stringify(root, null, 2)}\n`
}
