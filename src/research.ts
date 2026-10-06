// The research box: from what the person typed to a verdict and, after a yes, an install.
import type { Meta, Verdict } from '../types'

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
  const no: string[] = []
  const caution: string[] = []
  if (m.archived) no.push('The repository is archived: nobody maintains it.')
  if (!m.marketplace && !m.isSkill) no.push('No plugin catalog or SKILL.md at the top of the repository: Helm cannot install it.')
  if (!m.license || m.license === 'NOASSERTION') caution.push('No clear license.')
  const idle = (now - Date.parse(m.pushedAt)) / 86_400_000
  if (Number.isFinite(idle) && idle > 365) caution.push(`Not updated for ${Math.round(idle / 30)} months.`)
  if (m.stars < 20) caution.push(`Only ${m.stars} stars: few people have used it.`)
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
