// The panel's look: one function from the state and a set of actions to a tree of elements. It never
// holds `$`: every effect arrives as a plain function in `act`, built in hooks/register.tsx.

import { tally } from '../catalog'
import { COLOR, glow } from '../graph'
import { ITEMS } from '../github'
import { LANGS, t } from '../i18n'
import type { Key, Lang } from '../i18n'
import { shortlist } from '../shortlist'
import { estimateTokens, refinePrompt } from '../suggest'
import { flagged, isOverridable, watched } from '../skillspector'
import { LEARNING_DAYS, visible } from '../health'
import { installPlan, runsText } from '../research'
import type { Core, Entry, Nav } from '../../types'

export type Act = {
  tab: (tab: Nav['tab']) => void
  fold: (cat: string) => void
  foldAll: (cats: string[]) => void
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
  pickRow: (i: number) => void
  installBatch: (scope: 'user' | 'local') => void
  clearBatch: () => void
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

type Props = { ui: any; c: Core; n: Nav; github: boolean; act: Act; terminal: boolean; width: number; now: number; lang: Lang }

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
const ISSUE: Record<string, Key> = { 'stale-plugin': 'issue.stale', 'broken-skill': 'issue.broken', 'no-description': 'issue.nodesc', duplicate: 'issue.dup', similar: 'issue.similar', unused: 'issue.unused' }
const ITEM_LABEL: Record<string, Key> = { license: 'gh.licenseFile', protection: 'gh.branch', community: 'gh.contributing' }

// "Not scanned" says why: too big for the scanner, or too slow.
const whyKey = (r: { k: string; n?: number }): Key => (r.k === 'unscanned' && r.n === 1 ? 'why.toobig' : r.k === 'unscanned' && r.n === 2 ? 'why.slow' : WHY[r.k])

const hex = (cat: string) => `#${(COLOR[cat] ?? COLOR.other).toString(16).padStart(6, '0')}`

/** A short, language-free "how long ago": 40s, 5m, 3h, 2d. */
export function ago(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.round(s / 60)}m`
  if (s < 172800) return `${Math.round(s / 3600)}h`
  return `${Math.round(s / 86400)}d`
}

export function Panel({ ui, c, n, github, act, terminal, width, now, lang }: Props) {
  const { Box, Button, Input, Select, Text } = ui
  const T = (key: Key, ...vars: (string | number)[]) => t(lang, key, ...vars)
  const index = c.index ?? []
  // A copy switched off beside an active twin of the same name is not listed again.
  const listed = visible(index)
  const active = listed.filter(x => x.on).length
  const here = c.project !== null
  const rule = terminal ? <Text dimColor>{'─'.repeat(Math.max(10, width))}</Text> : null

  const title = (text: string, color?: string) => (
    <Text bold color={color} dimColor={!color}>
      {text.toUpperCase()}
    </Text>
  )
  const card = (key: string, children: any, borderColor = 'subtle') => (
    <Box key={`card-${key}`} flexDirection="column" marginTop={1} borderStyle="round" borderColor={borderColor} paddingX={1}>
      {children}
    </Box>
  )
  const tab = (id: Nav['tab'], label: string) => <Button key={id} label={label} variant={n.tab === id ? 'primary' : 'secondary'} onPress={() => act.tab(id)} />

  const runs = (meta: Core['found'] extends infer F ? (F extends { meta: infer M } ? M : never) : never) => runsText(installPlan(meta, here && n.tab === 'project' ? 'local' : 'user', `${c.dir}/skills`, `${c.dir}/helm-markets`) ?? [])
  const topLine = c.scanning ? T('sec.running', c.scanning.done, c.scanning.total) : c.message
  const header = (
    <Box flexDirection="column">
      <Box justifyContent="space-between">
        <Text bold>{c.project ? c.project.name : T('head.none')}</Text>
        <Text dimColor>{c.index === null ? T('head.reading') : T('head.counts', listed.length, active)}</Text>
      </Box>
      <Box marginTop={1} columnGap={1}>
        {tab('project', T('tab.project'))}
        {tab('global', T('tab.global'))}
      </Box>
      {rule}
      {topLine && (
        <Box marginTop={1}>
          <Text color={c.failed ? 'error' : c.busy || c.scanning ? 'suggestion' : 'success'}>{`${c.failed ? '✗ ' : c.busy || c.scanning ? '◌ ' : '✓ '}${topLine}`}</Text>
        </Box>
      )}
    </Box>
  )

  const footer = (
    <Box marginTop={1} flexDirection="column">
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
            <Box key={`hit-${h.repo}`} columnGap={1}>
              <Button key={`h-${h.repo}`} label={h.repo} onPress={() => act.pick(h.repo)} />
              <Text dimColor wrap="truncate-end">{`${h.stars}★  ${h.description}`}</Text>
            </Box>
          ))}
        </Box>
      )}
      {c.batch && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold>{T('batch.title', c.batch.length)}</Text>
          {c.batch.map((row, i) => {
            const f = row.found
            const level = f?.verdict.level
            // Not a skill or a plugin at all is not a danger: it is greyed, not red.
            const other = row.state === 'done' && !!f && level === 'no' && f.verdict.reasons.every(r => r.k === 'noform')
            const color = row.state === 'installed' || row.state === 'have' ? 'success' : row.state === 'failed' ? 'error' : row.state === 'wait' || row.state === 'check' ? 'suggestion' : row.state === 'missing' || row.state === 'unsupported' || other ? 'inactive' : level ? LEVEL[level] : 'inactive'
            const mark = row.state === 'installed' || row.state === 'have' ? '✓' : row.state === 'failed' ? '✗' : row.state === 'wait' || row.state === 'check' ? '◌' : row.state === 'missing' || row.state === 'unsupported' ? '?' : other ? '–' : level === 'ok' ? '●' : level === 'caution' ? '▲' : '✗'
            const ready = row.state === 'done' && !!f && level !== 'no'
            const note = (() => {
              if (row.state === 'wait' || row.state === 'check') return T('batch.checking')
              if (row.state === 'have') return T('batch.have')
              if (other) return T('why.noform')
              if (row.state === 'missing') return T('batch.missing')
              if (row.state === 'unsupported') return T('batch.unsupported')
              if (row.state === 'installed') return T('batch.installed')
              if (row.state === 'failed') return `${T('batch.failed')}${row.why ? `: ${row.why}` : ''}`
              return [T(level === 'ok' ? 'verdict.ok' : level === 'caution' ? 'verdict.caution' : 'verdict.no'), ...(f?.verdict.reasons ?? []).map(r => T(whyKey(r), r.n ?? 0)), ...(row.via ? [T('batch.matched', row.via)] : [])].join(' · ')
            })()
            return (
              <Box key={`b-${i}`} flexDirection="column" marginTop={1}>
                <Box columnGap={1}>
                  {ready ? <Button key={`b-pick-${i}`} label={row.pick ? '☑' : '☐'} plain onPress={() => act.pickRow(i)} /> : <Text color={color}>{mark}</Text>}
                  <Text bold>{f?.meta.repo ?? row.label}</Text>
                  {f && <Text dimColor>{`${f.meta.license ?? '—'} · ${f.meta.stars}★`}</Text>}
                </Box>
                <Text color={color} dimColor wrap="truncate-end">{`   ${note}`}</Text>
                {ready && f && runs(f.meta) !== '' && <Text dimColor wrap="truncate-end">{`   ${T('batch.runs', runs(f.meta))}`}</Text>}
              </Box>
            )
          })}
          <Box marginTop={1} columnGap={1}>
            {c.batch.some(row => row.pick && row.state === 'done') && (
              <Button
                key="b-install"
                label={`${here && n.tab === 'project' ? T('install.here') : T('install.all')} · ${c.batch.filter(row => row.pick && row.state === 'done').length}`}
                variant="primary"
                onPress={() => act.installBatch(here && n.tab === 'project' ? 'local' : 'user')}
              />
            )}
            <Button key="b-clear" label={T('batch.clear')} plain onPress={act.clearBatch} />
          </Box>
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
            <Text key={r.k} dimColor>{`· ${T(whyKey(r), r.n ?? 0)}`}</Text>
          ))}
          {(c.found.scan?.top ?? []).map(f => (
            <Text key={`${f.pattern}${f.where}`} dimColor wrap="truncate-end">
              {`  ${f.sev.toLowerCase()} · ${f.pattern} · ${f.where}`}
            </Text>
          ))}
          {c.scanner.state === 'missing' && (
            <Box marginTop={1}>
              <Button key="scanner-install-found" label={T('sec.install')} onPress={act.installScanner} />
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
                <Box key={`row-${key}`} flexDirection="column" marginTop={1}>
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

  // ---- what Claude used in this project: by category, with how much ----
  const hereRows = Object.entries(c.puses ?? {}).flatMap(([key, u]) => {
    const entry = index.find(x => x.key === key)
    return entry ? [{ u, entry }] : []
  })
  const hereMax = Math.max(1, ...hereRows.map(r => r.u.n))
  const hereGroups = [...new Set(hereRows.map(r => r.entry.category))]
    .map(cat => {
      const rows = hereRows.filter(r => r.entry.category === cat).sort((a, b) => b.u.n - a.u.n)
      return { cat, rows, total: rows.reduce((sum, r) => sum + r.u.n, 0) }
    })
    .sort((a, b) => b.total - a.total)
  const usedHere = card(
    'used',
    <Box flexDirection="column">
      <Box justifyContent="space-between">
        {title(T('proj.used'), '#6fd08c')}
        {hereRows.length > 0 ? <Text dimColor>{T('map.uses', hereRows.reduce((sum, r) => sum + r.u.n, 0))}</Text> : null}
      </Box>
      {hereGroups.length === 0 && <Text dimColor>{T('proj.empty')}</Text>}
      {hereGroups.map(g => (
        <Box key={`ug-${g.cat}`} flexDirection="column" marginTop={1}>
          <Box columnGap={1}>
            <Text bold color={hex(g.cat)}>
              {T(`cat.${g.cat}` as Key)}
            </Text>
            <Text dimColor>{`×${g.total}`}</Text>
          </Box>
          {g.rows.map(({ u, entry }) => {
            const lit = glow(c.used, entry.key, now) > 0
            return (
              <Box key={`ur-${entry.key}`} columnGap={1}>
                <Text color={lit ? '#ffffff' : hex(g.cat)} bold={lit}>
                  {lit ? '◉' : '●'}
                </Text>
                <Box width={13}>
                  <Text color={hex(g.cat)}>{'█'.repeat(Math.max(1, Math.round((u.n / hereMax) * 12)))}</Text>
                </Box>
                <Text bold>{entry.name}</Text>
                <Text dimColor>{`×${u.n} · ${ago(now - u.last)}`}</Text>
              </Box>
            )
          })}
        </Box>
      ))}
    </Box>,
    '#6fd08c',
  )

  const projectTab = (
    <Box flexDirection="column">
      {here && usedHere}
      {here && setup}
      {discover}
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
  // A state kept across a reload may predate this field.
  const open = n.open ?? []
  // What each tile can honestly say. A green mark means the whole thing was looked at and nothing is left to do:
  // anything not yet looked at, not finished or not known is said, never rounded up to "all good".
  const unscanned = index.filter(x => !c.scans[x.key])
  const cautions = Object.entries(c.scans).filter(([key, sc]) => sc.recommendation !== 'SAFE' && sc.flagged > 0 && !flaggedList.some(f => f[0] === key))
  const learning = report !== null && report.length === 0 && c.tracked < LEARNING_DAYS
  const healthGood = report !== null && report.length === 0 && !learning
  const secKnown = c.scanner.state === 'ready' && Object.keys(c.scans).length > 0
  const secGood = secKnown && !c.scanning && unscanned.length === 0 && flaggedList.length === 0 && cautions.length === 0
  const upd = c.updates
  const updFailed = upd ? upd.rows.filter(r => r.state === 'failed') : []
  const updGood = !!upd && updFailed.length === 0
  const known = report !== null && secKnown && !!upd
  const attention = (report?.length ?? 0) + flaggedList.length + cautions.length + (unscanned.length > 0 && secKnown ? 1 : 0) + updFailed.length
  const allGood = known && healthGood && secGood && updGood
  const overall = !known ? 'subtle' : flaggedList.length > 0 ? '#ff7a6b' : allGood ? '#6fd08c' : '#f2b84b'
  const tw = Math.max(22, Math.floor((width - 7) / 3))
  const tile = (key: string, color: string, children: any) => (
    <Box key={`tile-${key}`} flexDirection="column" borderStyle="round" borderColor={color} paddingX={1} flexGrow={1} minWidth={tw}>
      {children}
    </Box>
  )
  const healthColor = report === null ? 'subtle' : report.length > 0 ? '#f2b84b' : learning ? '#5aa9ff' : '#6fd08c'
  const secColor = flaggedList.length > 0 ? '#ff7a6b' : secGood ? '#6fd08c' : secKnown ? '#f2b84b' : 'subtle'
  const shown = (report ?? []).slice(0, 6)

  // The status section: health, updates and security side by side in one card, with the verdict on top.
  const status = card(
    'status',
    <Box flexDirection="column">
      <Box justifyContent="space-between">
        {title(T('g.status'), overall)}
        {known ? (
          <Text bold color={allGood ? 'success' : 'warning'}>
            {allGood ? `✓ ${T('g.good')}` : learning && attention === 0 ? `● ${T('g.learning', Math.min(c.tracked + 1, LEARNING_DAYS), LEARNING_DAYS)}` : `▲ ${T('g.todo', attention)}`}
          </Text>
        ) : (
          <Text dimColor>{T('g.unchecked')}</Text>
        )}
      </Box>
      <Box flexDirection="row" flexWrap="wrap" columnGap={1} rowGap={1} marginTop={1}>
        {tile(
          'health',
          healthColor,
          <Box flexDirection="column">
            {title(T('g.health'), healthColor)}
            {report === null ? (
              <Text dimColor>{T('g.unchecked')}</Text>
            ) : report.length > 0 ? (
              <Text color="warning" bold>{`▲ ${T('g.todo', report.length)}`}</Text>
            ) : learning ? (
              <Text color="suggestion">{`● ${T('g.learning', Math.min(c.tracked + 1, LEARNING_DAYS), LEARNING_DAYS)}`}</Text>
            ) : (
              <Text color="success" bold>{`✓ ${T('g.good')}`}</Text>
            )}
            {shown.map(i => (
              <Box key={`issue-${i.key}${i.kind}`} flexDirection="column" marginTop={1}>
                <Text>{issueText(i)}</Text>
                {i.fix && <Button key={`fix-${i.key}`} label={c.confirm === i.key ? T('g.again') : T('g.remove')} onPress={() => act.fix(i.key)} />}
                {(i.kind === 'similar' || i.kind === 'unused') && <Button key={`off-${i.key}`} label={T('sec.off')} onPress={() => act.toggle(i.key)} />}
              </Box>
            ))}
            {(report ?? []).length > shown.length && <Text dimColor>{T('g.more', (report ?? []).length - shown.length)}</Text>}
            <Box flexGrow={1} />
            <Box marginTop={1}>
              <Button key="check" label={T('g.recheck')} onPress={act.check} />
            </Box>
          </Box>,
        )}
        {tile(
          'updates',
          updFailed.length > 0 ? '#f2b84b' : upd ? '#6fd08c' : '#5aa9ff',
          <Box flexDirection="column">
            {title(T('g.updates'), updFailed.length > 0 ? '#f2b84b' : upd ? '#6fd08c' : '#5aa9ff')}
            {!upd && <Text dimColor>{T('g.updatesText')}</Text>}
            {upd && updFailed.length === 0 && <Text color="success" bold>{`✓ ${T('up.current', upd.rows.length)}`}</Text>}
            {upd && updFailed.length > 0 && <Text color="warning" bold>{`▲ ${T('up.failed', updFailed.length)}`}</Text>}
            {upd && upd.rows.some(r => r.state === 'updated') && <Text dimColor>{T('up.updated', upd.rows.filter(r => r.state === 'updated').length)}</Text>}
            {updFailed.slice(0, 4).map(r => (
              <Text key={`uf-${r.id}`} dimColor wrap="truncate-end">{`${r.name}${r.note ? `: ${r.note}` : ''}`}</Text>
            ))}
            {upd && upd.unsourced > 0 && <Text dimColor>{T('up.manual', upd.unsourced)}</Text>}
            {upd && <Text dimColor>{ago(now - upd.at)}</Text>}
            <Box flexGrow={1} />
            <Box marginTop={1}>
              <Button key="update" label={T('g.update')} onPress={act.update} />
            </Box>
          </Box>,
        )}
        {tile(
          'security',
          secColor,
          <Box flexDirection="column">
            {title(T('sec.title'), secColor)}
            {c.scanner.state === 'missing' && <Text dimColor>{T('sec.missing')}</Text>}
            {c.scanner.state === 'ready' && !secGood && <Text dimColor>{T('sec.ready', c.scanner.version ?? '')}</Text>}
            {c.scanning && <Text color="suggestion">{T('sec.running', c.scanning.done, c.scanning.total)}</Text>}
            {secGood && <Text color="success" bold>{`✓ ${T('sec.clean', Object.keys(c.scans).length)}`}</Text>}
            {flaggedList.length > 0 && <Text color="error" bold>{`▲ ${T('sec.flagged', flaggedList.length)}`}</Text>}
            {[...flaggedList, ...cautions].slice(0, 4).map(([key, s]) => {
              const entry = index.find(x => x.key === key)
              return (
                <Box key={`row-${key}`} flexDirection="column" marginTop={1}>
                  <Text>{`${entry?.name ?? key} · ${s.score}/100`}</Text>
                  <Text dimColor wrap="truncate-end">{s.top[0] ? `${s.top[0].pattern} · ${s.top[0].where}` : s.recommendation}</Text>
                  {entry && <Button key={`sw-${key}`} label={entry.on ? T('sec.off') : T('sec.on')} onPress={() => act.toggle(key)} />}
                </Box>
              )
            })}
            {secKnown && !c.scanning && unscanned.length > 0 && (
              <Box flexDirection="column" marginTop={1}>
                <Text color="warning" bold>{`▲ ${T('sec.unscanned', unscanned.length)}`}</Text>
                <Text dimColor wrap="truncate-end">{unscanned.slice(0, 3).map(x => x.name).join(', ')}</Text>
              </Box>
            )}
            <Box flexGrow={1} />
            <Box marginTop={1}>
              {c.scanner.state === 'ready' ? <Button key="scan" label={T('sec.scan')} onPress={act.scan} /> : <Button key="scanner-install" label={T('sec.install')} onPress={act.installScanner} />}
            </Box>
          </Box>,
        )}
      </Box>
    </Box>,
    overall,
  )

  // What Claude reaches for most, and what was added for one project.
  const habits =
    used.length > 0 || c.candidates.length > 0
      ? card(
          'habits',
          <Box flexDirection="column">
            {title(T('g.usage'), '#b28cff')}
            {used.length === 0 && <Text dimColor>{T('g.nothingUsed')}</Text>}
            <Box flexDirection="row" flexWrap="wrap" columnGap={3}>
              {used.map(([key, u]) => {
                const entry = index.find(x => x.key === key)!
                return (
                  <Box key={`use-${key}`} columnGap={1}>
                    <Text color={hex(entry.category)}>●</Text>
                    <Text bold>{entry.name}</Text>
                    <Text dimColor>{`×${u.n} · ${ago(now - u.last)}`}</Text>
                  </Box>
                )
              })}
            </Box>
            {index.length > 0 && <Text dimColor>{T('g.never', never)}</Text>}
            {c.candidates.length > 0 && (
              <Box flexDirection="column" marginTop={1}>
                {title(T('g.promote'), '#f2b84b')}
                {c.candidates.map(repo => (
                  <Box key={`cand-${repo}`} columnGap={1}>
                    <Text>{repo}</Text>
                    <Button key={`g-${repo}`} label={T('g.installAll')} onPress={() => act.makeGlobal(repo)} />
                  </Box>
                ))}
              </Box>
            )}
          </Box>,
          '#b28cff',
        )
      : null

  // Every tool and skill, folded by category; each category opens to the whole list.
  const byCategory = tally(listed)
  const tools = card(
    'tools',
    <Box flexDirection="column">
      <Box justifyContent="space-between">
        {title(`${T('g.tools')}  ·  ${shown.length}`, '#5aa9ff')}
        <Button key="fold-all" label={open.length > 0 ? T('g.collapseAll') : T('g.expandAll')} plain onPress={() => act.foldAll(byCategory.map(r => r.category))} />
      </Box>
      {byCategory.map(r => {
        const items = listed.filter(x => x.category === r.category)
        const isOpen = open.includes(r.category)
        return (
          <Box key={`cat-${r.category}`} flexDirection="column" marginTop={1}>
            <Box columnGap={1}>
              <Text color={hex(r.category)}>●</Text>
              <Button key={`fold-${r.category}`} label={`${isOpen ? '▾' : '▸'} ${T(`cat.${r.category}` as Key)}`} plain onPress={() => act.fold(r.category)} />
              <Text dimColor>{`${r.on}/${r.total}`}</Text>
            </Box>
            {isOpen && (
              <Box flexDirection="column" paddingLeft={3}>
                <Box flexDirection="row" flexWrap="wrap" columnGap={1}>
                  {items.map(x => (
                    <Box key={`pick-${x.key}`} columnGap={0}>
                      <Text color={x.on ? hex(r.category) : 'inactive'}>{x.on ? '●' : '○'}</Text>
                      <Button key={`pickb-${x.key}`} label={`${n.inspect === x.key ? '▸ ' : ' '}${x.name}`} plain onPress={() => act.inspect(x.key)} />
                    </Box>
                  ))}
                </Box>
                {/* What the chosen name is, right under the list: part of the page, so nothing is covered. */}
                {items
                  .filter(x => x.key === n.inspect)
                  .map(x => {
                    const u = c.uses[x.key]
                    return (
                      <Box key={`info-${x.key}`} flexDirection="column" marginTop={1} borderStyle="round" borderColor={hex(r.category)} paddingX={1}>
                        <Text bold color={hex(r.category)}>
                          {x.name}
                        </Text>
                        <Text dimColor>{`${T(`cat.${x.category}` as Key)} · ${x.on ? T('map.on') : T('map.off')}${u ? ` · ${T('map.uses', u.n)} · ${T('map.last', ago(now - u.last))}` : ` · ${T('map.never')}`}`}</Text>
                        <Text>{x.description || '—'}</Text>
                      </Box>
                    )
                  })}
              </Box>
            )}
          </Box>
        )
      })}
    </Box>,
    '#5aa9ff',
  )

  const globalTab = (
    <Box flexDirection="column">
      {discover}
      {status}
      {habits}
      {tools}
    </Box>
  )

  return (
    <Box flexDirection="column">
      {header}
      {n.tab === 'global' ? globalTab : projectTab}
      {footer}
    </Box>
  )
}
