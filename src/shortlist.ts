// The local first pass of "which tools fit this project": words of the person's description against
// each entry's name and description. Free and instant; a small model can refine the result later.

import type { Entry } from '../types'

// Words that say nothing about what is being built, and words every tool name here shares ("claude", "plugin"):
// a name match on one of them would offer a tool for any prompt.
const STOP = new Set([
  'a', 'an', 'the', 'and', 'or', 'to', 'of', 'for', 'in', 'on', 'with', 'my', 'is', 'it', 'i', 'want', 'build', 'make', 'app', 'project',
  'claude', 'code', 'plugin', 'plugins', 'skill', 'skills', 'tool', 'tools', 'helm', 'anthropic', 'use', 'using', 'add', 'fix', 'new', 'file', 'files',
  'this', 'that', 'can', 'you', 'how', 'what', 'are', 'be', 'we', 'not', 'but', 'from', 'at', 'by', 'as', 'so', 'if', 'then', 'do', 'does', 'please',
])

const stems = (text: string): string[] =>
  [...new Set(text.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 1 && !STOP.has(w)))]

/** Every entry that matches `text` at all, with its score and how many different words hit, best first. A hit in the name counts 3, in the description 1. */
export function scored(index: Entry[], text: string): { key: string; score: number; words: number }[] {
  const want = stems(text)
  if (want.length === 0) return []
  const hit = (found: string[], w: string) => found.some(f => f.startsWith(w) || w.startsWith(f))
  return index
    .map(e => {
      const inName = stems(e.name)
      const inText = stems(e.description)
      return {
        key: e.key,
        score: want.reduce((n, w) => n + (hit(inName, w) ? 3 : 0) + (hit(inText, w) ? 1 : 0), 0),
        words: want.filter(w => hit(inName, w) || hit(inText, w)).length,
      }
    })
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score || a.key.localeCompare(b.key))
}

/** The keys of the entries that fit `text` best, best first; entries with no match are left out. */
export const shortlist = (index: Entry[], text: string, max = 8): string[] => scored(index, text).slice(0, max).map(r => r.key)
