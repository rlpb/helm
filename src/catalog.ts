// The index of everything installed: plugins and skills, each with a short description and a
// category. It is the one list the rest of Helm reads: the shortlist for a project, the graph, and
// the research box (to see what is already there). Pure: files in, entries out.

import type { Entry } from '../types'

export const CATEGORIES = ['build', 'write', 'research', 'science', 'design', 'web', 'data', 'security', 'business', 'docs', 'setup', 'other'] as const
export type Category = (typeof CATEGORIES)[number]

// A word that points at a category. A stem matches the start of a word, so "program" covers
// "programming". The category with the most hits wins; on a tie the earlier one in CATEGORIES does.
// Nothing here knows a person's own tools: a new install is sorted from what each one says about itself.
const STEMS: Record<Exclude<Category, 'other'>, string[]> = {
  build: ['code', 'coding', 'debug', 'test', 'refactor', 'git', 'github', 'commit', 'typescript', 'javascript', 'python', 'rust', 'api', 'develop', 'program', 'tdd', 'lint', 'compil', 'script', 'function', 'repo', 'pull', 'engineer', 'software', 'react', 'node', 'backend', 'frontend', 'deploy', 'build', 'docker', 'kubernetes', 'devops', 'terraform', 'cloud', 'server', 'cli', 'terminal', 'sdk', 'library', 'package', 'architect'],
  write: ['write', 'writing', 'edit', 'draft', 'prose', 'copy', 'tone', 'voice', 'humaniz', 'blog', 'essay', 'article', 'translat', 'grammar', 'thesis', 'dissert', 'tesi', 'latex', 'manuscript', 'author', 'story', 'poem', 'letter', 'cover'],
  research: ['research', 'paper', 'literature', 'cite', 'citation', 'scholar', 'hypothes', 'study', 'survey', 'analy', 'review', 'evidence', 'peer', 'brainstorm', 'critical', 'journal', 'preprint'],
  science: ['science', 'scientific', 'lab', 'laborator', 'quantum', 'qubit', 'qiskit', 'cirq', 'chem', 'molecul', 'genom', 'gene', 'protein', 'bio', 'neuro', 'physic', 'astro', 'spectr', 'mass', 'sequenc', 'cell', 'drug', 'pharma', 'medic', 'clinic', 'imaging', 'microscop', 'robot', 'material', 'simulat', 'ecolog', 'climate', 'geo', 'math', 'experiment', 'protocol', 'dicom', 'omics', 'patient', 'health'],
  design: ['design', 'ui', 'ux', 'interface', 'brand', 'logo', 'layout', 'figma', 'palette', 'typograph', 'diagram', 'visual', 'illustrat', 'image', 'icon', 'animation', 'animat', 'scroll', 'landing', 'css', 'style', 'theme', 'color', 'font'],
  web: ['seo', 'website', 'web', 'browser', 'scrap', 'crawl', 'ecommerce', 'campaign', 'newsletter', 'sitemap', 'ads', 'social', 'http', 'url', 'search', 'link'],
  data: ['data', 'sql', 'database', 'dataset', 'csv', 'spreadsheet', 'excel', 'chart', 'plot', 'statistic', 'dataframe', 'pandas', 'machine', 'model', 'train', 'neural', 'tensor', 'learning', 'forecast', 'predict', 'regress', 'cluster', 'embedding', 'graph'],
  security: ['security', 'secure', 'vulnerab', 'exploit', 'malware', 'threat', 'forensic', 'pentest', 'penetration', 'owasp', 'cve', 'crypto', 'incident', 'compliance', 'audit', 'attack', 'phishing', 'ransomware', 'detect', 'hardening', 'encrypt'],
  business: ['sales', 'crm', 'lead', 'finance', 'financial', 'account', 'invoice', 'budget', 'legal', 'contract', 'recruit', 'hiring', 'interview', 'resume', 'cv', 'career', 'job', 'candidat', 'product', 'roadmap', 'customer', 'support', 'ticket', 'okr', 'strategy', 'startup', 'market', 'pricing', 'vendor', 'meeting', 'stakeholder', 'grant', 'hr', 'people', 'onboard', 'enterprise', 'operation'],
  docs: ['doc', 'pdf', 'word', 'slide', 'presentation', 'pptx', 'docx', 'xlsx', 'report', 'readme', 'changelog', 'markdown', 'notes', 'office', 'poster', 'template'],
  // Words every description uses ("skill", "plugin", "claude", "agent") say nothing, so they are not here.
  setup: ['setup', 'config', 'configur', 'memory', 'workflow', 'organiz', 'session', 'hook', 'loop', 'goal', 'stack', 'observ', 'radar', 'token', 'compress', 'terse', 'concise', 'lazy', 'adhd', 'habit', 'productiv', 'routine', 'schedul', 'automat', 'prompt', 'persona', 'caveman', 'ponytail', 'superpower', 'lesson', 'extras', 'creator', 'autoskill', 'skillopt'],
}

const words = (text: string): string[] => text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)

/** The category a name and a description point at; `other` only when nothing does. A name that runs words together ("pylabrobot") is read by the stems inside it. */
export function categorize(name: string, description: string): Category {
  const found = words(`${name} ${name} ${description}`)
  let best: Category = 'other'
  let top = 0
  for (const id of CATEGORIES) {
    if (id === 'other') continue
    const score = STEMS[id].reduce((n, stem) => n + found.filter(w => w.startsWith(stem)).length, 0)
    if (score > top) {
      top = score
      best = id
    }
  }
  if (best !== 'other') return best
  const joined = name.toLowerCase().replace(/[^a-z0-9]+/g, '')
  for (const id of CATEGORIES) {
    if (id === 'other') continue
    const score = STEMS[id].filter(stem => stem.length >= 4 && joined.includes(stem)).length
    if (score > top) {
      top = score
      best = id
    }
  }
  if (best !== 'other') return best
  // Last resort: a tool whose only word is about Claude Code itself is a setup tool.
  return /skill|plugin|claude|agent/.test(joined) ? 'setup' : 'other'
}

/** `name` and `description` from the frontmatter of a SKILL.md, however it is quoted. */
export function parseFrontmatter(raw: string): { name?: string; description?: string } {
  const block = raw.match(/^---\s*\r?\n([\s\S]*?)\r?\n---/)
  if (!block) return {}
  const value = (key: string): string | undefined => {
    const m = block[1].match(new RegExp(`^${key}:\\s*(.*)$`, 'm'))
    if (!m) return undefined
    const text = m[1].trim().replace(/^["']|["']$/g, '')
    return text === '>' || text === '|' || text === '' ? undefined : text
  }
  return { name: value('name'), description: value('description') }
}

const brief = (text: string, max = 160): string => {
  const one = text.replace(/\s+/g, ' ').trim()
  return one.length <= max ? one : `${one.slice(0, max - 1).replace(/\s+\S*$/, '')}…`
}

/** The friendly name of an id: "claude-seo@community" is "Claude SEO". */
export function friendly(raw: string): string {
  const acronyms = new Set(['seo', 'ui', 'ux', 'ai', 'mcp', 'api', 'pdf', 'sql', 'css', 'html', 'ocr', 'llm', 'sdk', 'cli'])
  return raw
    .split('@')[0]
    .split(/[-_.\s]+/)
    .filter(Boolean)
    .map((p, i) => (acronyms.has(p.toLowerCase()) ? p.toUpperCase() : i === 0 ? p.charAt(0).toUpperCase() + p.slice(1) : p.toLowerCase()))
    .join(' ')
}

export type Source = {
  plugins: { id: string; description?: string; on: boolean }[]
  skills: { name: string; description?: string; on: boolean }[]
}

/** Every installed plugin and own skill as one kind of row, plugins first, each group by name. */
export function buildIndex(source: Source): Entry[] {
  const plugin = (p: Source['plugins'][number]): Entry => {
    const description = brief(p.description ?? '')
    return { key: `plugin:${p.id}`, kind: 'plugin', name: friendly(p.id), description, category: categorize(p.id, description), on: p.on }
  }
  const skill = (s: Source['skills'][number]): Entry => {
    const description = brief(s.description ?? '')
    return { key: `skill:${s.name}`, kind: 'skill', name: friendly(s.name), description, category: categorize(s.name, description), on: s.on }
  }
  const byName = (a: Entry, b: Entry) => a.name.localeCompare(b.name)
  return [...source.plugins.map(plugin).sort(byName), ...source.skills.map(skill).sort(byName)]
}

/** How many entries each category holds, biggest first, empty ones left out. */
export function tally(entries: Entry[]): { category: string; total: number; on: number }[] {
  const rows = new Map<string, { total: number; on: number }>()
  for (const e of entries) {
    const row = rows.get(e.category) ?? { total: 0, on: 0 }
    row.total += 1
    if (e.on) row.on += 1
    rows.set(e.category, row)
  }
  return [...rows].map(([category, r]) => ({ category, ...r })).sort((a, b) => b.total - a.total || a.category.localeCompare(b.category))
}
