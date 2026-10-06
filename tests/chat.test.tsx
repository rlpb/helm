import { expect, test } from 'claude-code/testing'

import { boot, PROJECT, world } from './world'

const PANE_PROPS = { title: 'Helm', isFocused: true, bodyColumns: 80, placement: 'inline', scroll: {}, view: {} } as any
const BAND_PROPS = { hasSurvey: false, isWorking: false, maxRows: 6, bodyColumns: 100, scroll: {}, view: {} } as any
const band = ($: any) => $.ui.mount({ plugin: 'helm', surface: 'terminal', component: 'AbovePrompt', props: BAND_PROPS })
const textOf = async (ui: any) => (await ui.findAll({ type: 'Text' })).map((t: any) => t.text).join('\n')

test('in a chat already under way the notice offers to read the folder, not to set up from zero', async ($, on) => {
  const w = world($, on, {
    spent: true,
    files: [[`${PROJECT}/package.json`, '{"name":"shop","description":"a website with a sitemap and a report"}']],
  })
  await boot($, PROJECT)
  const notice = await band($)
  const text = await textOf(notice)
  expect(text).toContain('“shop” is already under way')
  expect(text).not.toContain('Set it up?')
  await notice.press({ key: 'look' })
  expect([...w.store.values()]).toContain('ready')
})

test('a prompt typed before the choice also makes the chat an existing one', async ($, on) => {
  world($, on)
  await boot($, PROJECT)
  expect(await textOf(await band($))).toContain('Set it up?')
  await $.prompt.submit({ text: 'hello there' })
  expect(await textOf(await band($))).toContain('already under way')
})

test('a tool is not offered for the word "claude" alone', async ($, on) => {
  world($, on, {
    files: [['/helm-demo-home/.claude/cache/seo/.claude-plugin/plugin.json', JSON.stringify({ description: 'Claude audit for a website: sitemap and markup' })]],
  })
  await boot($, PROJECT)
  await (await band($)).press({ key: 'open' })
  await $.prompt.submit({ text: 'claude fix the login code please' })
  expect(await textOf(await band($))).not.toContain('is off and fits this')
})

for (const surface of ['terminal', 'desktop']) {
  test(`the Map draws with a large index, on ${surface}`, async ($, on) => {
    const cats = ['build', 'write', 'research', 'design', 'web', 'data', 'security', 'docs']
    const files: [string, string][] = Array.from({ length: 190 }, (_, i): [string, string] => [
      `/helm-demo-home/.claude/skills/skill-${i}/SKILL.md`,
      `---\nname: skill-${i}\ndescription: ${cats[i % cats.length]} thing number ${i}\n---\n`,
    ])
    world($, on, { files })
    await boot($, PROJECT)
    const ui = await $.ui.mount({ plugin: 'helm', surface, component: 'Pane', props: PANE_PROPS, requestId: 'helm' })
    await ui.press({ key: 'graph' })
    const drawn = JSON.stringify(await ui.drawn())
    // One card per category, and a dot for every one of the 190 tools.
    expect((drawn.match(/"key":"m-[a-z]+"/g) ?? []).length).toBeGreaterThanOrEqual(3)
    expect((drawn.match(/[●○◉] /g) ?? []).length).toBeGreaterThanOrEqual(190)
    expect(JSON.stringify(await ui.drawn())).not.toContain('could not be drawn')
  })
}
