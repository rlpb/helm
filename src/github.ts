import type { Setup } from '../types'

// The GitHub baseline: what a repository needs to look and be trustworthy, as a short brief that
// is added once to the first prompt of a project. Pure. The person picks a license and which
// items apply; the rest is the same for everyone.

export const LICENSES: Setup['license'][] = ['Apache-2.0', 'MIT', 'GPL-3.0', 'none']

export type Item = { id: string; label: string; line: string }

export const ITEMS: Item[] = [
  { id: 'readme', label: 'README', line: 'A README that says what the project does, how to install and use it, and how to contribute; only features that exist.' },
  { id: 'license', label: 'License file', line: 'A LICENSE file matching the chosen license, with the copyright holder named.' },
  { id: 'gitignore', label: '.gitignore', line: 'A .gitignore for the stack, so no build output, logs, .env files or editor folders are committed.' },
  { id: 'ci', label: 'CI', line: 'A GitHub Actions workflow that builds, lints and tests on every push and pull request, with read-only token permissions.' },
  { id: 'security', label: 'SECURITY.md', line: 'A SECURITY.md with a real way to report a vulnerability, and private vulnerability reporting switched on.' },
  { id: 'dependabot', label: 'Dependabot', line: 'Dependabot version and security updates, plus secret scanning with push protection.' },
  { id: 'protection', label: 'Branch protection', line: 'A protected default branch: no force pushes, no deletion.' },
  { id: 'community', label: 'Contributing + conduct', line: 'CONTRIBUTING.md, CODE_OF_CONDUCT.md, and issue and pull request templates.' },
]

export const DEFAULT_SETUP: Setup = { on: false, license: 'Apache-2.0', items: ITEMS.map(i => i.id), details: '' }

/** Whether a GitHub connector is among the tools the session has. */
export const hasGithub = (tools: { name: string; mcp: boolean }[]): boolean => tools.some(t => t.mcp && /github/i.test(t.name))

/** The cycle of the license button. */
export const nextLicense = (current: Setup['license']): Setup['license'] => LICENSES[(LICENSES.indexOf(current) + 1) % LICENSES.length]

/** The text added to the first prompt. Empty when nothing is selected. */
export function brief(s: Setup): string {
  const chosen = ITEMS.filter(i => s.items.includes(i.id))
  if (chosen.length === 0 && s.details.trim() === '') return ''
  const lines = chosen.map(i => `- ${i.line.replace('the chosen license', s.license === 'none' ? 'no license (all rights reserved)' : s.license)}`)
  return [
    '---',
    'GitHub setup requested with this project. Before anything else, set the repository up to professional standards, using the connected GitHub tools:',
    ...lines,
    '- No secrets, personal data or local paths in any file or in the history.',
    s.details.trim() === '' ? '' : `Extra directions from the owner: ${s.details.trim()}`,
    'Work through the list, then report what is done and what still needs the owner.',
  ]
    .filter(l => l !== '')
    .join('\n')
}
