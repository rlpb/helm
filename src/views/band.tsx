// The row above the prompt, in three moods: a new folder asks once, a tool that fits the prompt offers
// itself, and otherwise a quiet line that shows the project, the limits and the skill in use.

import { COLOR } from '../graph'
import { flagged, watched } from '../skillspector'
import { t } from '../i18n'
import type { Lang } from '../i18n'
import type { Core } from '../../types'
import { Meter } from './meter'

export type BandAct = {
  open: () => void
  accept: (key: string, scope: 'project' | 'session') => void
  dismiss: (key: string) => void
  start: () => void
  look: () => void
  skip: () => void
  security: () => void
}

type Props = { ui: any; c: Core; lang: Lang; act: BandAct; terminal: boolean; width: number; litName?: string; litCat?: string }

export function Band({ ui, c, lang, act, terminal, width, litName, litCat }: Props) {
  const { Box, Button, Text } = ui
  const hinted = c.hint ? (c.index ?? []).find(x => x.key === c.hint) : undefined

  if (c.project && c.state === 'new') {
    // A chat already under way is joined, not set up from zero: Helm reads the folder and proposes tools.
    return (
      <Box columnGap={1}>
        <Text bold color="claude">⎈</Text>
        <Text dimColor>{t(lang, c.chat ? 'band.existing' : 'band.new', c.project.name)}</Text>
        {c.chat ? (
          <Button key="look" label={t(lang, 'band.look')} variant="primary" onPress={act.look} />
        ) : (
          <Button key="open" label={t(lang, 'band.open')} variant="primary" onPress={act.start} />
        )}
        <Button key="skip" label={t(lang, 'band.skip')} onPress={act.skip} />
      </Box>
    )
  }

  if (hinted && c.project) {
    return (
      <Box columnGap={1}>
        <Text bold color="claude">⎈</Text>
        <Text dimColor>{t(lang, 'hint.fits', hinted.name)}</Text>
        <Button key="hint-session" label={t(lang, 'hint.session')} variant="primary" onPress={() => act.accept(hinted.key, 'session')} />
        <Button key="hint-project" label={t(lang, 'hint.project')} onPress={() => act.accept(hinted.key, 'project')} />
        <Button key="hint-no" label={t(lang, 'hint.no')} onPress={() => act.dismiss(hinted.key)} />
      </Box>
    )
  }

  const index = c.index ?? []
  const active = index.filter(x => x.on).length
  const u = c.usage
  // On a narrow row the least urgent limit gives way.
  const meters = [
    u?.five != null && { id: 'five', label: t(lang, 'meter.five'), pct: u.five },
    u?.week != null && { id: 'week', label: t(lang, 'meter.week'), pct: u.week },
    u?.ctx != null && width >= 120 && { id: 'ctx', label: t(lang, 'meter.context'), pct: u.ctx },
  ].filter(Boolean) as { id: string; label: string; pct: number }[]
  // The security dot: green when the last scan was clean, amber for cautions, red for a "do not install", dim when nothing was scanned yet.
  const found = flagged(c.scans)
  const scanned = Object.keys(c.scans).length > 0
  const shield = c.scanning ? 'suggestion' : !scanned ? 'inactive' : found.length > 0 ? 'error' : watched(c.scans) > 0 ? 'warning' : 'success'
  const dot = litCat ? `#${(COLOR[litCat] ?? COLOR.other).toString(16).padStart(6, '0')}` : '#6fd08c'

  return (
    <Box justifyContent="space-between">
      <Box columnGap={2}>
        <Box columnGap={1}>
          <Text bold color="claude">⎈</Text>
          <Text dimColor>{c.project ? `${c.project.name}  ·  ${active}/${index.length}` : t(lang, 'head.none')}</Text>
        </Box>
        {meters.map(m => Meter({ ui, terminal, id: m.id, label: m.label, pct: m.pct }))}
        <Box>
          <Text color={shield}>●</Text>
          <Button key="helm-security" label={c.scanning ? `${t(lang, 'sec.title')} ${c.scanning.done}/${c.scanning.total}` : found.length > 0 ? `${t(lang, 'sec.title')} ${found.length}` : t(lang, 'sec.title')} plain onPress={act.security} />
        </Box>
        {litName && <Text color={dot}>{`●  ${litName}`}</Text>}
      </Box>
      <Button key="helm-open" label={t(lang, 'band.openHelm')} onPress={act.open} />
    </Box>
  )
}
