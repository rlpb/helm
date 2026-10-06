// SkillSpector (NVIDIA, Apache-2.0) is the scanner Helm leans on for skills: prompt injection, data
// theft, risky code. This file is the pure side of it: the commands, reading a report, and folding a
// scan into the verdict on a tool. Static analysis only: no model, no API key, nothing leaves the
// computer (`--no-llm`).

import type { Found, Reason, ScanResult, Verdict } from '../types'

export const SOURCE = 'git+https://github.com/NVIDIA/skillspector.git'
export const installCmd = (): string[] => ['uv', 'tool', 'install', SOURCE]
export const upgradeCmd = (): string[] => ['uv', 'tool', 'upgrade', 'skillspector']
export const versionCmd = (): string[] => ['skillspector', '--version']

/** The report goes to stdout as JSON; exit 1 means "do not install", not "it failed". */
export const scanCmd = (target: string): string[] => ['skillspector', 'scan', target, '--no-llm', '--format', 'json']

const REPO = /^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/
export const repoTarget = (repo: string): string | null => (REPO.test(repo) ? `https://github.com/${repo}` : null)

/** `SkillSpector v2.12.0` -> `2.12.0`; null when it is not SkillSpector answering. */
export const parseVersion = (text: string): string | null => text.match(/SkillSpector\s+v?(\d+(?:\.\d+)*)/i)?.[1] ?? null

// A finding in a test, a doc or an example does not decide whether a tool is safe to install.
const SIDE = /(^|\/)(tests?|__tests__|docs?|examples?|fixtures?)\//i
const TESTISH = /\.(test|spec)\.[a-z]+$/i
const isSide = (file: string): boolean => SIDE.test(file.replace(/\\/g, '/')) || TESTISH.test(file)

const RANK = { ok: 0, caution: 1, no: 2 } as const

/** A report read into what the panel shows; null when it is not a SkillSpector report. */
export function parseScan(text: string): ScanResult | null {
  let r: any
  try {
    r = JSON.parse(text)
  } catch {
    return null
  }
  const risk = r?.risk_assessment
  if (!risk || typeof risk.recommendation !== 'string' || !Array.isArray(r.issues)) return null
  const issues = (r.issues as any[]).map(i => ({
    sev: String(i.severity ?? ''),
    pattern: String(i.pattern ?? i.category ?? ''),
    where: `${String(i.location?.file ?? '')}${i.location?.start_line ? `:${i.location.start_line}` : ''}`,
    side: isSide(String(i.location?.file ?? '')),
  }))
  const main = issues.filter(i => !i.side)
  const order = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']
  main.sort((a, b) => order.indexOf(a.sev) - order.indexOf(b.sev))
  return {
    score: Math.round(Number(risk.score ?? 0)),
    severity: String(risk.severity ?? ''),
    recommendation: String(risk.recommendation),
    flagged: main.length,
    critical: main.filter(i => i.sev === 'CRITICAL').length,
    high: main.filter(i => i.sev === 'HIGH').length,
    top: main.slice(0, 4).map(({ sev, pattern, where }) => ({ sev, pattern, where })),
    testOnly: issues.length - main.length,
  }
}

/** SkillSpector scores harshly: a big skill with long docs can reach 100. Helm blocks only on one critical finding or three high ones, outside tests and docs. */
export const blocks = (scan: ScanResult): boolean => scan.critical >= 1 || scan.high >= 3

/** Adds what SkillSpector found to a verdict. The level can only go up. */
export function foldVerdict(v: Verdict, scan: ScanResult | null, scanner: 'unknown' | 'missing' | 'ready'): Verdict {
  const reasons: Reason[] = [...v.reasons]
  let level = v.level
  const raise = (to: Verdict['level']) => {
    if (RANK[to] > RANK[level]) level = to
  }
  if (scanner === 'missing') {
    reasons.push({ k: 'noscanner' })
    raise('caution')
  } else if (!scan) {
    reasons.push({ k: 'unscanned' })
    raise('caution')
  } else if (scan.recommendation !== 'SAFE') {
    if (scan.flagged > 0 && scan.recommendation === 'DO_NOT_INSTALL' && blocks(scan)) {
      reasons.push({ k: 'scanhigh', n: scan.score })
      raise('no')
    } else if (scan.flagged > 0) {
      reasons.push({ k: 'scanmid', n: scan.score })
      raise('caution')
    } else {
      reasons.push({ k: 'testsOnly', n: scan.testOnly })
      raise('caution')
    }
  }
  return { level, reasons }
}

/** A tool Helm may still install on a second, explicit yes: only the scanner said no, nothing about form or upkeep. */
export const isOverridable = (f: Found): boolean => f.verdict.level === 'no' && f.verdict.reasons.some(r => r.k === 'scanhigh') && !f.verdict.reasons.some(r => r.k === 'archived' || r.k === 'noform')

/** Those worth a row in the Security tile: a critical finding or three high ones, worst first. The rest is noise until it is not. */
export const flagged = (scans: Record<string, ScanResult>): [string, ScanResult][] =>
  Object.entries(scans)
    .filter(([, s]) => blocks(s))
    .sort((a, b) => b[1].score - a[1].score)

/** How many scans came back with "do not install" but not enough to block: worth a look, not an alarm. */
export const watched = (scans: Record<string, ScanResult>): number => Object.values(scans).filter(s => s.recommendation === 'DO_NOT_INSTALL' && s.flagged > 0 && !blocks(s)).length
