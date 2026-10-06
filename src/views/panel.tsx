// The panel's look: one function from the state and a set of actions to a tree of elements. It never
// holds `$`: every effect arrives as a plain function in `act`, built in hooks/register.tsx.

import { tally } from '../catalog'
import { ITEMS } from '../github'
import { estimateTokens, refinePrompt } from '../suggest'
import { shortlist } from '../shortlist'
import type { Core, Nav } from '../../types'

export type Act = {
  tab: (tab: Nav['tab']) => void
  ask: (text: string) => void
  refine: () => void
  turnOn: () => void
  undo: () => void
  gh: () => void
  license: () => void
  item: (id: string) => void
  details: (text: string) => void
  research: (text: string) => void
  pick: (repo: string) => void
  install: (scope: 'user' | 'local') => void
  check: () => void
  update: () => void
  fix: (key: string) => void
  makeGlobal: (repo: string) => void
}

type Props = { ui: any; c: Core; n: Nav; github: boolean; act: Act; terminal: boolean; width: number; map?: any }

const LEVEL = { ok: 'success', caution: 'warning', no: 'error' } as const

export function Panel({ ui, c, n, github, act, terminal, width, map }: Props) {
  const { Box, Button, Input, Text } = ui
  // A small caps title for a block, so the eye finds the next thing to do.
  const Title = (text: string) => (
    <Box marginTop={1}>
      <Text dimColor bold>
        {text.toUpperCase()}
      </Text>
    </Box>
  )
  const index = c.index ?? []
  const active = index.filter(x => x.on).length
  const here = n.tab === 'project' && c.project !== null
  const nothingElse = !(c.ask || c.found || c.hits)

  const tab = (id: Nav['tab'], label: string) => <Button key={id} label={label} variant={n.tab === id ? 'primary' : 'secondary'} onPress={() => act.tab(id)} />

  const header = (
    <Box flexDirection="column">
      <Box justifyContent="space-between">
        <Box>
          <Text bold color="claude">
            Helm
          </Text>
          <Text dimColor>{c.project ? `  ·  ${c.project.name}` : '  ·  no project here'}</Text>
        </Box>
        <Text dimColor>{c.index === null ? 'reading…' : `${index.length} tools · ${active} on`}</Text>
      </Box>
      <Box marginTop={1} columnGap={1}>
        {tab('project', 'Project')}
        {tab('global', 'Global')}
        {tab('graph', 'Map')}
      </Box>
      {terminal && <Text dimColor>{'─'.repeat(Math.max(10, width))}</Text>}
    </Box>
  )

  if (n.tab === 'graph') {
    return (
      <Box flexDirection="column">
        {header}
        <Box marginTop={1}>{map}</Box>
        <Text dimColor>Lit dots are tools Claude just used.</Text>
      </Box>
    )
  }

  const ask = here && (
    <Box flexDirection="column">
      {Title("What are you building?")}
      <Input key="ask" placeholder="a web shop, a CLI tool, a data report…" value={c.ask?.text ?? ''} submitLabel="find tools" onSubmit={act.ask} />
    </Box>
  )

  const offs = !!c.ask && c.ask.picks.some(k => index.some(x => x.key === k && !x.on))
  const refinable = !!c.ask && shortlist(index, c.ask.text, 12).length > 1
  const fits = here && c.ask && (
    <Box flexDirection="column">
      {Title("Fits this")}
      {c.ask.picks.length === 0 && <Text dimColor>Nothing installed fits that yet.</Text>}
      {c.ask.picks.map(key => {
        const entry = index.find(x => x.key === key)
        if (!entry) return null
        return (
          <Box key={key} columnGap={1}>
            <Text color={entry.on ? 'success' : 'inactive'}>{entry.on ? '●' : '○'}</Text>
            <Text bold>{entry.name}</Text>
            <Text dimColor wrap="truncate-end">
              {entry.description}
            </Text>
          </Box>
        )
      })}
      {(offs || refinable) && (
      <Box marginTop={1} columnGap={1}>
        {offs && <Button key="here" label="Turn on for this project" variant="primary" onPress={act.turnOn} />}
        {offs && <Button key="undo" label="Undo" onPress={act.undo} />}
        {refinable && (
          <Button
            key="refine"
            label={`Refine (≈${estimateTokens(refinePrompt(index.filter(x => shortlist(index, c.ask!.text, 12).includes(x.key)), c.ask.text))} tokens)`}
            plain
            dimColor
            onPress={act.refine}
          />
        )}
      </Box>
      )}
    </Box>
  )

  const baseline = here && github && (
    <Box flexDirection="column">
      {Title("GitHub baseline")}
      <Box columnGap={1}>
        <Button key="gh" label={`${c.setup.on ? '[x]' : '[ ]'} Set up to professional standards`} onPress={act.gh} />
        {c.setup.on && <Button key="license" label={`${c.setup.license} ↻`} plain onPress={act.license} />}
      </Box>
      {c.setup.on && (
        <Box flexDirection="column">
          <Box flexDirection="row" flexWrap="wrap" columnGap={1}>
            {ITEMS.map(i => (
              <Button key={`i-${i.id}`} label={`${c.setup.items.includes(i.id) ? '[x]' : '[ ]'} ${i.label}`} plain onPress={() => act.item(i.id)} />
            ))}
          </Box>
          <Input key="details" placeholder="extra directions, e.g. a private repo, a Ko-fi link" value={c.setup.details} submitLabel="save" onSubmit={act.details} />
          <Text dimColor>Added once to your first prompt here.</Text>
        </Box>
      )}
    </Box>
  )

  const globalTab = n.tab === 'global' && (
    <Box flexDirection="column">
      {Title("Everything installed")}
      <Box columnGap={1}>
        <Button key="check" label="Tidy up" variant="primary" onPress={act.check} />
        <Button key="update" label="Update all" onPress={act.update} />
      </Box>
      {(c.report ?? []).map(i => (
        <Box key={i.key + i.kind} marginTop={1} columnGap={1}>
          <Text color="warning">▲</Text>
          <Text>{i.text}</Text>
          {i.fix && <Button key={`fix-${i.key}`} label={c.confirm === i.key ? 'Press again to remove' : 'Remove'} onPress={() => act.fix(i.key)} />}
        </Box>
      ))}
      {c.candidates.length > 0 && (
        <Box flexDirection="column">
          {Title("Added for one project")}
          {c.candidates.map(repo => (
            <Box key={repo} columnGap={1}>
              <Text>{repo}</Text>
              <Button key={`g-${repo}`} label="Install for all" onPress={() => act.makeGlobal(repo)} />
            </Box>
          ))}
        </Box>
      )}
    </Box>
  )

  const results = (
    <Box flexDirection="column">
      {c.hits && (
        <Box flexDirection="column" marginTop={1}>
          {c.hits.map(h => (
            <Box key={h.repo} columnGap={1}>
              <Button key={`h-${h.repo}`} label={h.repo} onPress={() => act.pick(h.repo)} />
              <Text dimColor wrap="truncate-end">{`${h.stars}★  ${h.description}`}</Text>
            </Box>
          ))}
        </Box>
      )}
      {c.found && (
        <Box flexDirection="column" marginTop={1} borderStyle="round" borderColor={LEVEL[c.found.verdict.level]} paddingX={1}>
          <Box columnGap={1}>
            <Text bold>{c.found.meta.repo}</Text>
            <Text dimColor>{`${c.found.meta.license ?? 'no license'} · ${c.found.meta.stars}★`}</Text>
          </Box>
          <Text color={LEVEL[c.found.verdict.level]} bold>
            {c.found.verdict.level === 'ok' ? 'Looks fine' : c.found.verdict.level === 'caution' ? 'Check before you install' : 'Do not install'}
          </Text>
          {c.found.verdict.reasons.map(reason => (
            <Text key={reason} dimColor>
              {`· ${reason}`}
            </Text>
          ))}
          {c.found.verdict.level !== 'no' && (
            <Box marginTop={1}>
              <Button key="install" label={here ? 'Yes, install for this project' : 'Yes, install for all'} variant="primary" onPress={() => act.install(here ? 'local' : 'user')} />
            </Box>
          )}
        </Box>
      )}
    </Box>
  )

  const rows = tally(index)
  const summary = (n.tab === 'global' || nothingElse) && rows.length > 0 && (
    <Box flexDirection="column">
      {Title("By category")}
      <Text dimColor>{rows.map(r => `${r.category} ${r.on}/${r.total}`).join('  ·  ')}</Text>
    </Box>
  )

  return (
    <Box flexDirection="column">
      {header}
      {ask}
      {fits}
      {baseline}
      {globalTab}
      <Box flexDirection="column">
        {Title("Find a tool")}
        <Input key="research" placeholder="GitHub link, owner/name, or a name" submitLabel="look" onSubmit={act.research} />
        {results}
      </Box>
      {c.message && (
        <Box marginTop={1}>
          <Text color="suggestion">{c.message}</Text>
        </Box>
      )}
      {summary}
    </Box>
  )
}
