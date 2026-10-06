import { describe, expect, test } from 'claude-code/testing'

import { buildIndex, categorize, friendly, parseFrontmatter, tally } from '../src/catalog'
import { loadIndex } from '../src/load'
import { isProject, projectKey, projectName } from '../src/project'

const BASE = '/helm-demo/.claude'

describe('sorting tools into categories', () => {
  test('a tool lands in the category of what it is for', () => {
    expect(categorize('systematic-debugging', 'Find the root cause of a bug')).toBe('build')
    expect(categorize('ui-ux-pro-max', 'Design systems, layout and brand for interfaces')).toBe('design')
    expect(categorize('claude-seo', 'Audit a website: pages, links, sitemap')).toBe('web')
    expect(categorize('office-extras', 'Lessons for docx, pptx, xlsx and pdf files')).toBe('docs')
    expect(categorize('zzz', 'qqq www')).toBe('other')
  })

  test('ids read as names', () => {
    expect(friendly('claude-seo@market')).toBe('Claude SEO')
    expect(friendly('i-have-adhd')).toBe('I have adhd')
  })

  test('frontmatter is read however it is quoted', () => {
    expect(parseFrontmatter('---\nname: x\ndescription: "Does a thing"\n---\nbody')).toEqual({ name: 'x', description: 'Does a thing' })
    expect(parseFrontmatter('no header')).toEqual({})
  })
})

describe('the index', () => {
  test('plugins come first, each group by name, and the tally counts what is on', () => {
    const index = buildIndex({
      plugins: [{ id: 'b@m', description: 'Debug code and tests', on: true }],
      skills: [{ name: 'zeta', description: 'Write a blog post', on: false }, { name: 'alpha', description: 'Write an essay', on: true }],
    })
    expect(index.map(e => e.key)).toEqual(['plugin:b@m', 'skill:alpha', 'skill:zeta'])
    expect(tally(index)).toEqual([
      { category: 'write', total: 2, on: 1 },
      { category: 'build', total: 1, on: 1 },
    ])
  })

  test('it is read from the config folder, off by settings', async () => {
    const files = new Map<string, string>([
      [`${BASE}/plugins/installed_plugins.json`, JSON.stringify({ plugins: { 'tdd@m': [{ installPath: `${BASE}/cache/tdd` }] } })],
      [`${BASE}/cache/tdd/.claude-plugin/plugin.json`, JSON.stringify({ description: 'Test driven development' })],
      [`${BASE}/skills/slop/SKILL.md`, '---\nname: slop\ndescription: Edit prose\n---\n'],
    ])
    const disk = {
      read: async (p: string) => files.get(p) ?? Promise.reject(new Error('missing')),
      list: async (p: string) => (p === `${BASE}/skills` ? [{ name: 'slop', kind: 'dir' }, { name: 'stray', kind: 'dir' }] : []),
      exists: async (p: string) => files.has(p),
    }
    const index = await loadIndex(disk, BASE, { enabledPlugins: { 'tdd@m': true }, skillOverrides: { slop: 'off' } })
    expect(index.map(e => [e.key, e.on])).toEqual([['plugin:tdd@m', true], ['skill:slop', false]])
  })
})

describe('the project', () => {
  test('the same folder has one key whichever the slash, and a name', () => {
    expect(projectKey('D:\\demo\\app')).toBe(projectKey('d:/demo/app/'))
    expect(projectName('D:\\demo\\app')).toBe('app')
  })

  test('home and the config folder are not projects', () => {
    expect(isProject('/helm-demo', BASE, '/helm-demo')).toBe(false)
    expect(isProject(BASE, BASE, '/helm-demo')).toBe(false)
    expect(isProject('/helm-demo/app', BASE, '/helm-demo')).toBe(true)
  })
})
