// The local first pass of "which tools fit this project": words of the person's description against
// each entry's name and description. Free and instant; a small model can refine the result later.

import type { Entry } from '../types'

const STOP = new Set(['a', 'an', 'the', 'and', 'or', 'to', 'of', 'for', 'in', 'on', 'with', 'my', 'is', 'it', 'i', 'want', 'build', 'make', 'app', 'project'])

const stems = (text: string): string[] =>
  [...new Set(text.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 1 && !STOP.has(w)))]

/** The keys of the entries that fit `text` best, best first; entries with no match are left out. */
export function shortlist(index: Entry[], text: string, max = 8): string[] {
  const want = stems(text)
  if (want.length === 0) return []
  const hit = (found: string[], w: string) => found.some(f => f.startsWith(w) || w.startsWith(f))
  return index
    .map(e => {
      const inName = stems(e.name)
      const inText = stems(e.description)
      const score = want.reduce((n, w) => n + (hit(inName, w) ? 3 : 0) + (hit(inText, w) ? 1 : 0), 0)
      return { key: e.key, score }
    })
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score || a.key.localeCompare(b.key))
    .slice(0, max)
    .map(r => r.key)
}
