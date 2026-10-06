// The part of the health check that judges the setup, not just its files: which tools do much the same
// job, and which ones are loaded and never reached for. Pure: the index and the usage record in, findings out.
// A finding is a suggestion with a one-press way out (switch the tool off, which is reversible), never a verdict
// that a tool is useless: Helm only knows what it has seen, and says for how long.

import type { Entry, Issue } from '../types'

/** Days of watching before "never used" means anything. */
export const LEARNING_DAYS = 14

// Words that say nothing about what a tool does: every description has them.
const GENERIC = new Set(['the', 'and', 'for', 'with', 'use', 'using', 'used', 'when', 'that', 'this', 'from', 'your', 'you', 'are', 'can', 'any', 'all', 'not', 'into', 'work', 'working', 'help', 'helps', 'tool', 'tools', 'skill', 'skills', 'plugin', 'claude', 'code', 'file', 'files', 'based', 'including', 'such', 'also', 'will', 'has', 'have', 'its', 'new', 'how', 'what', 'user', 'users', 'task', 'tasks', 'agent', 'agents', 'support', 'provide', 'provides', 'create', 'creating', 'generate', 'analysis', 'analyze', 'data', 'python', 'library'])

const tokens = (e: Entry): Set<string> =>
  new Set(
    `${e.name} ${e.name} ${e.description}`
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(w => w.length >= 4 && !GENERIC.has(w))
      .map(w => w.replace(/(ing|ed|es|s)$/, '')),
  )

/** How much two tools say the same thing: shared meaningful words over all of them, 0 to 1. */
export function overlap(a: Entry, b: Entry): number {
  const x = tokens(a)
  const y = tokens(b)
  if (x.size < 5 || y.size < 5) return 0
  let shared = 0
  for (const w of x) if (y.has(w)) shared += 1
  return shared / (x.size + y.size - shared)
}

/** Pairs that look like the same job done twice, most alike first. */
export function similar(index: Entry[], threshold = 0.5, max = 12): { a: Entry; b: Entry; score: number }[] {
  const out: { a: Entry; b: Entry; score: number }[] = []
  for (let i = 0; i < index.length; i += 1) {
    for (let j = i + 1; j < index.length; j += 1) {
      const a = index[i]
      const b = index[j]
      // The same tool installed twice (a plugin and a copy of its skill) is the clearest case.
      const same = a.name.toLowerCase() === b.name.toLowerCase() && a.kind !== b.kind
      const score = same ? 1 : overlap(a, b)
      if (score >= threshold) out.push({ a, b, score })
    }
  }
  return out.sort((p, q) => q.score - p.score).slice(0, max)
}

/**
 * What to look at: tools that do the same job (suggest switching off the one used less), and, once Helm has watched
 * long enough, tools that are on and were never used. `days` is how long usage has been recorded.
 */
export function review(index: Entry[], uses: Record<string, { n: number; last: number }>, days: number): Issue[] {
  const out: Issue[] = []
  const flagged = new Set<string>()
  for (const { a, b } of similar(index)) {
    // Keep the one that is used more, then the one that is on; suggest the other.
    const rank = (e: Entry) => (uses[e.key]?.n ?? 0) * 2 + (e.on ? 1 : 0)
    const [keep, drop] = rank(a) >= rank(b) ? [a, b] : [b, a]
    if (flagged.has(drop.key) || !drop.on) continue
    flagged.add(drop.key)
    out.push({ kind: 'similar', key: drop.key, a: drop.name, b: keep.name })
  }
  if (days >= LEARNING_DAYS) {
    for (const e of index) {
      // Plugins also work through hooks, commands and servers, which this record does not see: only skills are judged by use.
      if (e.kind !== 'skill' || !e.on || uses[e.key] || flagged.has(e.key)) continue
      out.push({ kind: 'unused', key: e.key, a: e.name, b: String(days) })
    }
  }
  return out
}
