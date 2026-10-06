// The research box: from what the person typed to a verdict and, after a yes, an install.
import type { Meta, Reason, Verdict } from '../types'

// Everything here is pure; the calls to `gh` live in hooks/register.tsx.

export type Target = { kind: 'repo'; repo: string } | { kind: 'search'; query: string } | { kind: 'none' }

const REPO = /^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/

/** A GitHub link or `owner/name` is a repo; anything else is a name to search for. */
export function parseTarget(input: string): Target {
  const text = input.trim()
  if (text === '') return { kind: 'none' }
  const url = text.match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+?)(?:\.git)?(?:[/?#].*)?$/)
  if (url) return { kind: 'repo', repo: `${url[1]}/${url[2]}` }
  if (REPO.test(text)) return { kind: 'repo', repo: text }
  return /^[\w .:-]{2,60}$/.test(text) ? { kind: 'search', query: text } : { kind: 'none' }
}

export type { Meta, Verdict }

/** A plain verdict. `no` blocks the install button; `caution` shows why and still asks. */
export function judge(m: Meta, now: number): Verdict {
  const no: Reason[] = []
  const caution: Reason[] = []
  if (m.archived) no.push({ k: 'archived' })
  if (!m.marketplace && !m.isSkill) no.push({ k: 'noform' })
  if (!m.license || m.license === 'NOASSERTION') caution.push({ k: 'nolicense' })
  const idle = (now - Date.parse(m.pushedAt)) / 86_400_000
  if (Number.isFinite(idle) && idle > 365) caution.push({ k: 'idle', n: Math.round(idle / 30) })
  if (m.stars < 20) caution.push({ k: 'stars', n: m.stars })
  return no.length ? { level: 'no', reasons: no } : caution.length ? { level: 'caution', reasons: caution } : { level: 'ok', reasons: [] }
}
const SAFE = /^[A-Za-z0-9._-]+$/

/** The commands that install it, or `null` when the form is not one Helm knows. */
export function installPlan(m: Meta, scope: 'user' | 'local', skillsDir: string): string[][] | null {
  if (m.marketplace && SAFE.test(m.marketplace.name) && m.marketplace.plugins.length > 0 && m.marketplace.plugins.every(p => SAFE.test(p))) {
    return [
      ['claude', 'plugin', 'marketplace', 'add', m.repo],
      ...m.marketplace.plugins.map(p => ['claude', 'plugin', 'install', `${p}@${m.marketplace!.name}`, '--scope', scope]),
    ]
  }
  if (m.isSkill) {
    const name = m.repo.split('/')[1]
    return SAFE.test(name) ? [['git', 'clone', '--depth', '1', `https://github.com/${m.repo}.git`, `${skillsDir}/${name}`]] : null
  }
  return null
}

// ---- a whole text instead of one link: every link, repo and name in it ----

export type Item = { kind: 'repo'; repo: string } | { kind: 'search'; query: string } | { kind: 'other'; url: string }

const GH_URL = /(?:https?:\/\/)?(?:www\.)?github\.com\/([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+?)(?:\.git)?(?=[/?#\s)>\]"',;]|$)[^\s)>\]"',;]*/g
const ANY_URL = /https?:\/\/[^\s)>\]"',;]+/g
const PAIR = /(?<![\w/.@:-])([A-Za-z0-9][A-Za-z0-9-]{0,38})\/([A-Za-z0-9][A-Za-z0-9._-]{1,99})(?![\w/])/g
// Pairs that are ordinary words or file paths, not repositories.
const NOT_REPO = new Set(['and/or', 'w/o', 'n/a', 'he/she', 'his/her', 'either/or', 'input/output', 'yes/no', 'true/false', 'on/off', 'read/write', 'client/server', 'pass/fail', 'tcp/ip', 'ci/cd', 'a/b', 'i/o', 'q/a'])
// Words that are the leftovers of a sentence once its links are taken out.
const FILLER = new Set(['and', 'or', 'the', 'see', 'also', 'plus', 'then', 'with', 'try', 'use', 'maybe', 'e', 'o', 'y', 'et', 'ou', 'und', 'oder', 'ed', 'poi', 'anche', 'vedi', 'link', 'links', 'repo', 'repos', 'tool', 'tools', 'skill', 'skills', 'plugin', 'plugins', 'list', 'lista', 'todo', 'note', 'notes'])
const FILE_EXT = /\.(md|txt|json|ya?ml|toml|png|jpe?g|gif|svg|pdf|js|ts|tsx|jsx|py|sh|html|css|lock|zip|csv)$/i

/** The tools a person named in a block of text: GitHub links, `owner/name`, other links (kept, marked), and plain names one to a line or comma. */
export function parseItems(text: string, max = 40): Item[] {
  const out: Item[] = []
  const seen = new Set<string>()
  const add = (item: Item, key: string) => {
    const k = key.toLowerCase()
    if (seen.has(k) || out.length >= max) return
    seen.add(k)
    out.push(item)
  }
  let rest = text.replace(/\r/g, '')
  // Links first, then pairs, then plain names; each group keeps the order of the text.
  const found: { at: number; item: Item; key: string }[] = []
  for (const m of rest.matchAll(GH_URL)) found.push({ at: m.index ?? 0, item: { kind: 'repo', repo: `${m[1]}/${m[2]}` }, key: `${m[1]}/${m[2]}` })
  rest = rest.replace(GH_URL, ' ')
  for (const m of rest.matchAll(ANY_URL)) found.push({ at: m.index ?? 0, item: { kind: 'other', url: m[0] }, key: m[0] })
  rest = rest.replace(ANY_URL, ' ')
  for (const m of rest.matchAll(PAIR)) {
    const name = m[2].replace(/[._-]+$/, '')
    const pair = `${m[1]}/${name}`
    if (name.length < 2 || NOT_REPO.has(pair.toLowerCase()) || FILE_EXT.test(name) || /^\d+$/.test(m[1])) continue
    found.push({ at: m.index ?? 0, item: { kind: 'repo', repo: pair }, key: pair })
  }
  // Names: one per bullet, line or comma; prose lines are left alone.
  const names: { at: number; item: Item; key: string }[] = []
  let offset = 0
  for (const line of rest.split('\n')) {
    const bullet = /^\s*(?:[-*+•]|\d+[.)])\s+/.test(line)
    const clean = line.replace(/^\s*(?:[-*+•]|\d+[.)])\s+/, '').replace(/^\s*\[[ xX]\]\s*/, '').replace(/[*_`#]/g, '').trim()
    // A heading ("Tools to try:") or a sentence is not a list of names.
    const parts = !clean.endsWith(':') && (bullet || clean.length <= 60) ? clean.split(/[,;]|\s+·\s+/) : []
    for (const p of parts) {
      const word = p.replace(PAIR, ' ').replace(/\s+/g, ' ').trim()
      if (/^[\p{L}\p{N}][\p{L}\p{N} ._:+-]{1,39}$/u.test(word) && word.split(' ').length <= 4 && !/^\d+$/.test(word) && !FILLER.has(word.toLowerCase())) names.push({ at: offset, item: { kind: 'search', query: word }, key: `q:${word}` })
    }
    offset += line.length + 1
  }
  for (const f of [...found, ...names]) add(f.item, f.key)
  return out
}
