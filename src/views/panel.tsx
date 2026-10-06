// The panel's look: one function from the state and a set of actions to a tree of elements. It never
// holds `$`: every effect arrives as a plain function in `act`, built in hooks/register.tsx.

import { tally } from '../catalog'
import { COLOR } from '../graph'
import { ITEMS } from '../github'
import { LANGS, t } from '../i18n'
import type { Key, Lang } from '../i18n'
import { shortlist } from '../shortlist'
import { estimateTokens, refinePrompt } from '../suggest'
import { flagged, isOverridable } from '../skillspector'
import type { Core, Entry, Nav } from '../../types'

export type Act = {
  tab: (tab: Nav['tab']) => void
  sub: (sub: Nav['sub']) => void
  inspect: (key: string) => void
  lang: (pref: string) => void
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
  scan: () => void
  installScanner: () => void
  toggle: (key: string) => void
  anyway: (scope: 'user' | 'local') => void
}

type Props = { ui: any; c: Core; n: Nav; github: boolean; act: Act; terminal: boolean; width: number; map?: any; now: number; lang: Lang }

const LEVEL = { ok: 'success', caution: 'warning', no: 'error' } as const
const WHY: Record<string, Key> = {
  archived: 'why.archived',
  noform: 'why.noform',
  nolicense: 'why.nolicense',
  idle: 'why.idle',
  stars: 'why.stars',
  scanhigh: 'why.scanhigh',
  scanmid: 'why.scanmid',
  unscanned: 'why.unscanned',
  noscanner: 'why.noscanner',
  testsOnly: 'why.testsOnly',
}
const ISSUE: Record<string, Key> = { 'stale-plugin': 'issue.stale', 'broken-skill': 'issue.broken', 'no-description': 'issue.nodesc', duplicate: 'issue.dup' }
const ITEM_LABEL: Record<string, Key> = { license: 'gh.licenseFile', protection: 'gh.branch', community: 'gh.contributing' }

const hex = (cat: string) => `#${(COLOR[cat] ?? COLOR.other).toString(16).padStart(6, '0')}`

/** A short, language-free "how long ago": 40s, 5m, 3h, 2d. */
export function ago(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.round(s / 60)}m`
  if (s < 172800) return `${Math.round(s / 3600)}h`
  return `${Math.round(s / 86400)}d`
}

export function Panel({ ui, c, n, github, act, terminal, width, map, now, lang }: Props) {
  const { Box, Button, Input, Select, Text } = ui
  const T = (key: Key, ...vars: (string | number)[]) => t(lang, key, ...vars)
  const index = c.index ?? []
  const active = index.filter(x => x.on).length
  const here = c.project !== null
  const rule = terminal ? <Text dimColor>{'─'.repeat(Math.max(10, width))}</Text> : null

  const title = (text: string, color?: string) => (
    <Text bold color={color} dimColor={!color}>
      {text.toUpperCase()}
    </Text>
  )
  const card = (key: string, children: any, borderColor = 'subtle') => (
    <Box key={key} flexDirection="column" marginTop={1} borderStyle="round" borderColor={borderColor} paddingX={1}>
      {children}
    </Box>
  )
  const tab = (id: Nav['tab'], label: string) => <Button key={id} label={label} variant={n.tab === id ? 'primary' : 'secondary'} onPress={() => act.tab(id)} />
  const sub = (id: Nav['sub'], label: string) => <Button key={`sub-${id}`} label={`${n.sub === id ? '●' : '○'} ${label}`} plain onPress={() => act.sub(id)} />

  const header = (
    <Box flexDirection="column">
      <Box justifyContent="space-between">
        <Box columnGap={1}>
          <Text bold color="claude">
            Helm
          </Text>
          <Text dimColor>{c.project ? c.project.name : T('head.none')}</Text>
        </Box>
        <Text dimColor>{c.index === null ? T('head.reading') : T('head.counts', index.length, active)}</Text>
      </Box>
      <Box marginTop={1} columnGap={1}>
        {tab('project', T('tab.project'))}
        {tab('global', T('tab.global'))}
        {tab('graph', T('tab.map'))}
      </Box>
      {rule}
    </Box>
  )

  const footer = (
    <Box marginTop={1} flexDirection="column">
      {c.message && <Text color="suggestion">{c.message}</Text>}
      <Select
        key="lang"
        label={`${T('lang.label')}  `}
        value={c.pref}
        options={[{ value: 'auto', label: T('lang.auto') }, ...LANGS.map(l => ({ value: l.code, label: l.name }))]}
        onSelect={act.lang}
      />
    </Box>
  )

  // ---- the research box: the same in Discover and in Global ----
  const discover = card(
    'discover',
    <Box flexDirection="column">
      {title(T('find.title'), '#f2b84b')}
      <Text dimColor>{T('find.about')}</Text>
      <Input key="research" placeholder={T('find.placeholder')} submitLabel={T('find.submit')} onSubmit={act.research} />
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
            <Text dimColor>{`${c.found.meta.license ?? '—'} · ${c.found.meta.stars}★`}</Text>
          </Box>
          <Text color={LEVEL[c.found.verdict.level]} bold>
            {T(c.found.verdict.level === 'ok' ? 'verdict.ok' : c.found.verdict.level === 'caution' ? 'verdict.caution' : 'verdict.no')}
          </Text>
          {c.found.verdict.reasons.map(r => (
            <Text key={r.k} dimColor>{`· ${T(WHY[r.k], r.n ?? 0)}`}</Text>
          ))}
          {(c.found.scan?.top ?? []).map(f => (
            <Text key={`${f.pattern}${f.where}`} dimColor wrap="truncate-end">
              {`  ${f.sev.toLowerCase()} · ${f.pattern} · ${f.where}`}
            </Text>
          ))}
          {c.scanner.state === 'missing' && (
            <Box marginTop={1}>
              <Button key="scanner-install" label={T('sec.install')} onPress={act.installScanner} />
            </Box>
          )}
          {isOverridable(c.found) && (
            <Box marginTop={1}>
              <Button key="anyway" label={c.anyway === c.found.meta.repo ? T('sec.anywayAgain') : T('sec.anyway')} onPress={() => act.anyway(here && n.tab === 'project' ? 'local' : 'user')} />
            </Box>
          )}
          {c.found.verdict.level !== 'no' && (
            <Box marginTop={1}>
              <Button key="install" label={here && n.tab === 'project' ? T('install.here') : T('install.all')} variant="primary" onPress={() => act.install(here && n.tab === 'project' ? 'local' : 'user')} />
            </Box>
          )}
        </Box>
      )}
    </Box>,
    '#f2b84b',
  )

  // ---- Project / Setup ----
  const offs = !!c.ask && c.ask.picks.some(k => index.some(x => x.key === k && !x.on))
  const refinable = !!c.ask && shortlist(index, c.ask.text, 12).length > 1
  const setup = (
    <Box flexDirection="column">
      {card(
        'ask',
        <Box flexDirection="column">
          {title(`1 · ${T('setup.title')}`, '#5aa9ff')}
          <Input key="ask" placeholder={T('setup.placeholder')} value={c.ask?.text ?? ''} submitLabel={T('setup.submit')} onSubmit={act.ask} />
          {!c.ask && <Text dimColor>{T('setup.empty', index.length)}</Text>}
        </Box>,
        '#5aa9ff',
      )}
      {c.ask &&
        card(
          'fits',
          <Box flexDirection="column">
            {title(`2 · ${T('setup.fits')}`, '#6fd08c')}
            {c.ask.picks.length === 0 && <Text dimColor>{T('setup.none')}</Text>}
            {c.ask.picks.map(key => {
              const entry = index.find(x => x.key === key)
              if (!entry) return null
              return (
                <Box key={key} flexDirection="column" marginTop={1}>
                  <Box columnGap={1}>
                    <Text color={entry.on ? hex(entry.category) : 'inactive'}>{entry.on ? '●' : '○'}</Text>
                    <Text bold>{entry.name}</Text>
                    <Text color={hex(entry.category)} dimColor>
                      {T(`cat.${entry.category}` as Key)}
                    </Text>
                  </Box>
                  <Text dimColor wrap="truncate-end">
                    {`   ${entry.description}`}
                  </Text>
                </Box>
              )
            })}
            {(offs || refinable) && (
              <Box marginTop={1} columnGap={1}>
                {offs && <Button key="here" label={T('setup.turnOn')} variant="primary" onPress={act.turnOn} />}
                {offs && <Button key="undo" label={T('setup.undo')} onPress={act.undo} />}
                {refinable && (
                  <Button
                    key="refine"
                    label={T('setup.refine', estimateTokens(refinePrompt(index.filter(x => shortlist(index, c.ask!.text, 12).includes(x.key)), c.ask!.text)))}
                    plain
                    onPress={act.refine}
                  />
                )}
              </Box>
            )}
          </Box>,
          '#6fd08c',
        )}
      {github &&
        card(
          'gh',
          <Box flexDirection="column">
            {title(`3 · ${T('gh.title')}`, '#b28cff')}
            <Box columnGap={1}>
              <Button key="gh" label={`${c.setup.on ? '✓' : '○'} ${T('gh.toggle')}`} onPress={act.gh} />
              {c.setup.on && <Button key="license" label={`${c.setup.license}  ⇄`} plain onPress={act.license} />}
            </Box>
            {c.setup.on && (
              <Box flexDirection="column" marginTop={1}>
                <Box flexDirection="row" flexWrap="wrap" columnGap={2}>
                  {ITEMS.map(i => (
                    <Button key={`i-${i.id}`} label={`${c.setup.items.includes(i.id) ? '✓' : '○'} ${ITEM_LABEL[i.id] ? T(ITEM_LABEL[i.id]) : i.label}`} plain onPress={() => act.item(i.id)} />
                  ))}
                </Box>
                <Input key="details" placeholder={T('gh.details')} value={c.setup.details} submitLabel={T('gh.save')} onSubmit={act.details} />
                <Text dimColor>{T('gh.once')}</Text>
              </Box>
            )}
          </Box>,
          '#b28cff',
        )}
    </Box>
  )

  const projectTab = (
    <Box flexDirection="column">
      {here ? (
        <Box marginTop={1} columnGap={2}>
          {sub('setup', T('sub.setup'))}
          {sub('discover', T('sub.discover'))}
        </Box>
      ) : null}
      {here && n.sub === 'setup' ? setup : discover}
    </Box>
  )

  // ---- Global: a dashboard of tiles, then the categories ----
  const report = c.report
  const issueText = (i: NonNullable<Core['report']>[number]) => T(ISSUE[i.kind], i.a, i.b ?? '')
  const used = Object.entries(c.uses)
    .filter(([key]) => index.some(x => x.key === key))
    .sort((a, b) => b[1].n - a[1].n)
    .slice(0, 5)
  const flaggedList = flagged(c.scans)
  const never = index.filter(x => !c.uses[x.key]?.n).length
  const tw = Math.max(26, Math.floor((width - 1) / 2))
  const tile = (key: string, color: string, children: any) => (
    <Box key={key} flexDirection="column" borderStyle="round" borderColor={color} paddingX={1} width={tw}>
      {children}
    </Box>
  )
  const tiles = (
    <Box flexDirection="row" flexWrap="wrap" columnGap={1} rowGap={1} marginTop={1}>
      {tile(
        'health',
        report && report.length > 0 ? '#f2b84b' : '#6fd08c',
        <Box flexDirection="column">
          {title(T('g.health'), report && report.length > 0 ? '#f2b84b' : '#6fd08c')}
          {report === null ? <Text dimColor>·</Text> : report.length === 0 ? <Text color="success" bold>{`✓ ${T('g.good')}`}</Text> : <Text color="warning" bold>{`▲ ${T('g.todo', report.length)}`}</Text>}
          {(report ?? []).map(i => (
            <Box key={i.key + i.kind} flexDirection="column" marginTop={1}>
              <Text>{issueText(i)}</Text>
              {i.fix && <Button key={`fix-${i.key}`} label={c.confirm === i.key ? T('g.again') : T('g.remove')} onPress={() => act.fix(i.key)} />}
            </Box>
          ))}
          <Box marginTop={1}>
            <Button key="check" label={T('g.tidy')} variant="primary" onPress={act.check} />
          </Box>
        </Box>,
      )}
      {tile(
        'updates',
        '#5aa9ff',
        <Box flexDirection="column">
          {title(T('g.updates'), '#5aa9ff')}
          <Text dimColor>{T('g.updatesText')}</Text>
          <Box marginTop={1}>
            <Button key="update" label={T('g.update')} onPress={act.update} />
          </Box>
        </Box>,
      )}
      {tile(
        'security',
        flaggedList.length > 0 ? '#ff7a6b' : '#6fd08c',
        <Box flexDirection="column">
          {title(T('sec.title'), flaggedList.length > 0 ? '#ff7a6b' : '#6fd08c')}
          {c.scanner.state === 'missing' && <Text dimColor>{T('sec.missing')}</Text>}
          {c.scanner.state === 'ready' && <Text dimColor>{T('sec.ready', c.scanner.version ?? '')}</Text>}
          {c.scanning && <Text color="suggestion">{T('sec.running', c.scanning.done + 1, c.scanning.total)}</Text>}
          {!c.scanning && c.scanner.state === 'ready' && Object.keys(c.scans).length > 0 && flaggedList.length === 0 && <Text color="success" bold>{`✓ ${T('sec.clean', Object.keys(c.scans).length)}`}</Text>}
          {flaggedList.length > 0 && <Text color="error" bold>{`▲ ${T('sec.flagged', flaggedList.length)}`}</Text>}
          {flaggedList.slice(0, 4).map(([key, s]) => {
            const entry = index.find(x => x.key === key)
            return (
              <Box key={key} flexDirection="column" marginTop={1}>
                <Text>{`${entry?.name ?? key} · ${s.score}/100`}</Text>
                <Text dimColor wrap="truncate-end">{s.top[0] ? `${s.top[0].pattern} · ${s.top[0].where}` : s.recommendation}</Text>
                {entry && <Button key={`sw-${key}`} label={entry.on ? T('sec.off') : T('sec.on')} onPress={() => act.toggle(key)} />}
              </Box>
            )
          })}
          <Box marginTop={1}>
            {c.scanner.state === 'ready' ? <Button key="scan" label={T('sec.scan')} variant="primary" onPress={act.scan} /> : <Button key="scanner-install" label={T('sec.install')} variant="primary" onPress={act.installScanner} />}
          </Box>
        </Box>,
      )}
      {tile(
        'usage',
        '#b28cff',
        <Box flexDirection="column">
          {title(T('g.usage'), '#b28cff')}
          {used.length === 0 && <Text dimColor>{T('g.nothingUsed')}</Text>}
          {used.map(([key, u]) => {
            const entry = index.find(x => x.key === key)!
            return (
              <Box key={key} columnGap={1}>
                <Text color={hex(entry.category)}>●</Text>
                <Text bold>{entry.name}</Text>
                <Text dimColor>{`×${u.n} · ${ago(now - u.last)}`}</Text>
              </Box>
            )
          })}
          {index.length > 0 && <Text dimColor>{T('g.never', never)}</Text>}
        </Box>,
      )}
      {c.candidates.length > 0 &&
        tile(
          'promote',
          '#f2b84b',
          <Box flexDirection="column">
            {title(T('g.promote'), '#f2b84b')}
            {c.candidates.map(repo => (
              <Box key={repo} columnGap={1}>
                <Text>{repo}</Text>
                <Button key={`g-${repo}`} label={T('g.installAll')} onPress={() => act.makeGlobal(repo)} />
              </Box>
            ))}
          </Box>,
        )}
    </Box>
  )

  const byCategory = tally(index)
  const categories = (
    <Box flexDirection="row" flexWrap="wrap" columnGap={1} rowGap={1} marginTop={1}>
      {byCategory.map(r => {
        const items = index.filter(x => x.category === r.category)
        const shown = items.slice(0, 6)
        return tile(
          `cat-${r.category}`,
          hex(r.category),
          <Box flexDirection="column">
            <Box columnGap={1}>
              <Text color={hex(r.category)} bold>
                {`● ${T(`cat.${r.category}` as Key)}`}
              </Text>
              <Text dimColor>{`${r.on}/${r.total}`}</Text>
            </Box>
            {shown.map(x => (
              <Text key={x.key} dimColor={!x.on} wrap="truncate-end">
                {`${x.on ? '●' : '○'} ${x.name}`}
              </Text>
            ))}
            {items.length > shown.length && <Text dimColor>{`+${items.length - shown.length}`}</Text>}
          </Box>,
        )
      })}
    </Box>
  )
  const globalTab = (
    <Box flexDirection="column">
      {tiles}
      {categories}
      {discover}
    </Box>
  )

  // ---- Map: the picture, a legend, and a box about one skill ----
  const recent = Object.entries(c.uses)
    .filter(([key]) => index.some(x => x.key === key))
    .sort((a, b) => b[1].last - a[1].last)
  const selected = index.find(x => x.key === (n.inspect ?? recent[0]?.[0])) ?? index[0]
  const sel = selected ? c.uses[selected.key] : undefined
  const mapTab = (
    <Box flexDirection="column">
      <Box marginTop={1}>{map}</Box>
      <Text dimColor>{T('map.legend')}</Text>
      {byCategory.length > 0 && (
        <Box flexDirection="row" flexWrap="wrap" columnGap={2} marginTop={1}>
          {byCategory.map(r => (
            <Text key={r.category} color={hex(r.category)}>
              {`● ${T(`cat.${r.category}` as Key)}`}
            </Text>
          ))}
        </Box>
      )}
      {recent.length > 0 &&
        card(
          'recent',
          <Box flexDirection="column">
            {title(T('map.recent'), '#6fd08c')}
            <Box flexDirection="row" flexWrap="wrap" columnGap={1}>
              {recent.slice(0, 6).map(([key]) => (
                <Button key={`r-${key}`} label={index.find(x => x.key === key)!.name} plain onPress={() => act.inspect(key)} />
              ))}
            </Box>
          </Box>,
          '#6fd08c',
        )}
      {selected &&
        card(
          'inspect',
          <Box flexDirection="column">
            {title(T('map.inspect'), hex(selected.category))}
            <Select
              key="inspect"
              value={selected.key}
              options={[...index].sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)).map((x: Entry) => ({ value: x.key, label: x.name }))}
              onSelect={act.inspect}
            />
            <Box marginTop={1} columnGap={1}>
              <Text bold color={hex(selected.category)}>
                {selected.name}
              </Text>
              <Text dimColor>{`${T(`cat.${selected.category}` as Key)} · ${selected.on ? T('map.on') : T('map.off')}`}</Text>
            </Box>
            <Text dimColor>{sel ? `${T('map.uses', sel.n)} · ${T('map.last', ago(now - sel.last))}` : T('map.never')}</Text>
            <Box marginTop={1}>
              <Text>{selected.description || '—'}</Text>
            </Box>
          </Box>,
          hex(selected.category),
        )}
    </Box>
  )

  return (
    <Box flexDirection="column">
      {header}
      {n.tab === 'graph' ? mapTab : n.tab === 'global' ? globalTab : projectTab}
      {footer}
    </Box>
  )
}
