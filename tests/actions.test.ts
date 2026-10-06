import { describe, expect, test } from 'claude-code/testing'

import { applyPicks, undoPicks } from '../src/apply'
import { checkup, updateAll } from '../src/tidy'
import { brief, hasGithub, nextLicense } from '../src/github'
import { estimateTokens, hintFor, parseChoice, refinePrompt } from '../src/suggest'
import type { Entry } from '../types'

const entry = (key: string, on: boolean): Entry => ({ key, kind: key.startsWith('plugin:') ? 'plugin' : 'skill', name: key, description: '', category: 'other', on })

describe('turning picks on for one project', () => {
  test('only off picks are written, and undo restores the file exactly', () => {
    const start = JSON.stringify({ env: { A: '1' }, skillOverrides: { keep: 'off', slop: 'off' } }, null, 2) + '\n'
    const done = applyPicks(start, [entry('plugin:tdd@m', false), entry('skill:slop', false), entry('skill:already', true)])!
    const written = JSON.parse(done.text)
    expect(written.enabledPlugins).toEqual({ 'tdd@m': true })
    expect(written.skillOverrides).toEqual({ keep: 'off', slop: 'on' })
    expect(Object.keys(done.before).sort()).toEqual(['plugin:tdd@m', 'skill:slop'])
    expect(JSON.parse(undoPicks(done.text, done.before)!)).toEqual(JSON.parse(start))
  })

  test('a file that is not an object is left alone', () => {
    expect(applyPicks('[1]', [entry('skill:a', false)])).toBeNull()
    expect(applyPicks('{nope', [entry('skill:a', false)])).toBeNull()
    expect(JSON.parse(applyPicks('', [entry('skill:a', false)])!.text)).toEqual({ skillOverrides: { a: 'on' } })
  })
})

describe('the health check', () => {
  const BASE = '/helm-demo/.claude'
  test('it finds gone plugins and broken skills, and offers one fix', async () => {
    const files = new Map<string, string>([
      [`${BASE}/plugins/installed_plugins.json`, JSON.stringify({ plugins: { 'gone@m': [{ installPath: `${BASE}/cache/gone` }], 'ok@m': [{ installPath: `${BASE}/cache/ok` }] } })],
      [`${BASE}/cache/ok/.claude-plugin/plugin.json`, '{}'],
      [`${BASE}/skills/good/SKILL.md`, '---\nname: good\ndescription: Does a thing\n---\n'],
      [`${BASE}/skills/mute/SKILL.md`, '---\nname: mute\n---\n'],
    ])
    const disk = {
      read: async (p: string) => files.get(p) ?? Promise.reject(new Error('x')),
      list: async (p: string) => (p === `${BASE}/skills` ? [{ name: 'good', kind: 'dir' }, { name: 'mute', kind: 'dir' }, { name: 'empty', kind: 'dir' }] : []),
      exists: async (p: string) => files.has(p),
    }
    const issues = await checkup(disk, BASE)
    expect(issues.map(i => [i.kind, i.key])).toEqual([['stale-plugin', 'plugin:gone@m'], ['no-description', 'skill:mute'], ['broken-skill', 'skill:empty']])
    expect(issues[0].fix).toEqual(['claude', 'plugin', 'uninstall', 'gone@m'])
    expect(issues[1].fix).toBeUndefined()
  })

  test('update commands are one per plugin and refuse odd ids', () => {
    expect(updateAll(['a@m', 'b;rm@m'])).toEqual([['claude', 'plugin', 'update', 'a@m']])
  })
})

describe('the GitHub brief', () => {
  test('it lists only the chosen items, names the license, and is empty when nothing is chosen', () => {
    const base = { on: true, license: 'MIT' as const, items: ['readme', 'license'], details: 'private repo' }
    const text = brief(base)
    expect(text).toContain('README')
    expect(text).toContain('MIT')
    expect(text).not.toContain('Dependabot')
    expect(text).toContain('private repo')
    expect(brief({ ...base, items: [], details: '' })).toBe('')
  })

  test('a GitHub connector is found among MCP tools only', () => {
    expect(hasGithub([{ name: 'mcp__github__create_issue', mcp: true }])).toBe(true)
    expect(hasGithub([{ name: 'github_helper', mcp: false }])).toBe(false)
    expect(nextLicense('none')).toBe('Apache-2.0')
  })
})

describe('suggestions while working', () => {
  const idx = (over: Partial<Entry>[]): Entry[] => over.map((o, i) => ({ key: `skill:s${i}`, kind: 'skill', name: `s${i}`, description: '', category: 'other', on: false, ...o }))

  test('only an off tool with a strong match is offered, and an ignored one never is', () => {
    const index = idx([{ name: 'Seo audit', description: 'Audit a website sitemap' }, { name: 'Notes', description: 'Keep notes', on: true }])
    expect(hintFor(index, 'please audit the website sitemap', [])).toBe('skill:s0')
    expect(hintFor(index, 'please audit the website sitemap', ['skill:s0'])).toBeNull()
    expect(hintFor(index, 'rename a variable', [])).toBeNull()
    expect(hintFor(index, 'keep notes', [])).toBeNull()
  })

  test('the model reply is read as numbers in range, and nothing else', () => {
    const c = idx([{}, {}, {}])
    expect(parseChoice('Sure: [1, 3]', c)).toEqual(['skill:s0', 'skill:s2'])
    expect(parseChoice('[0, 9, 2, 2]', c)).toEqual(['skill:s1'])
    expect(parseChoice('none', c)).toEqual([])
    expect(estimateTokens('x'.repeat(40))).toBe(10)
    expect(refinePrompt(c, 'a report')).toContain('3. s2')
  })
})
