#!/usr/bin/env node
// Composes the repository's branding from pieces that are already in docs/:
//
//   docs/banner.png          README banner (1280x640)
//   docs/social-preview.png  the same picture, for the repository's social preview
//   docs/feature-*.png       one card per feature: a headline and the real panel beside it
//
// The only generated picture is docs/art/backdrop.jpg (FLUX/Seedream art, no text). Everything with
// words on it is set here in HTML and rendered by Chrome, so the type is sharp and can be edited.
// Run `node scripts/shots.mjs` first when the panel changed: the cards use docs/screenshot-*.png.
//
// Needs Chrome, Chromium or Edge (CHROME, or found on PATH).

import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const docs = join(root, 'docs')
const data = file => `data:${file.endsWith('.png') ? 'image/png' : 'image/jpeg'};base64,${readFileSync(join(docs, file)).toString('base64')}`

const INK = '#e8ecf4'
const DIM = '#93a0b8'
const MINT = '#6fe3b0'
const FONT = "'Segoe UI Variable Display','Segoe UI','Inter','SF Pro Display','Helvetica Neue',Arial,sans-serif"

const base = `
  *{box-sizing:border-box;margin:0}
  html,body{width:100%;height:100%;overflow:hidden}
  body{font-family:${FONT};color:${INK};background:#040818}
`

const banner = () => `<!doctype html><meta charset="utf-8"><style>${base}
  body{background:radial-gradient(1200px 700px at 78% 40%,#0d2547 0%,#07122a 45%,#040818 100%)}
  .art{position:absolute;right:-70px;top:-100px;width:840px;height:840px;background:url(${data('art/backdrop.jpg')}) center/cover;
       -webkit-mask-image:radial-gradient(circle at 50% 50%,#000 38%,transparent 69%);mask-image:radial-gradient(circle at 50% 50%,#000 38%,transparent 69%)}
  .grain{position:absolute;inset:0;background:linear-gradient(90deg,#040818 0%,rgba(4,8,24,.88) 30%,transparent 62%)}
  .text{position:absolute;left:88px;top:50%;transform:translateY(-52%)}
  .mark{display:flex;align-items:center;gap:22px}
  h1{font-size:132px;font-weight:700;letter-spacing:-5px;line-height:1;background:linear-gradient(180deg,#ffffff 20%,#9fb4d6 100%);-webkit-background-clip:text;color:transparent}
  .dot{width:16px;height:16px;border-radius:50%;background:${MINT};box-shadow:0 0 28px 6px rgba(111,227,176,.55);margin-top:62px}
  p{margin-top:22px;font-size:30px;line-height:1.35;color:${DIM};max-width:520px;font-weight:400}
  p b{color:${INK};font-weight:600}
  .chips{margin-top:34px;display:flex;gap:12px}
  .chips span{font-size:17px;padding:8px 16px;border-radius:999px;border:1px solid rgba(147,160,184,.28);background:rgba(255,255,255,.04);color:${DIM}}
</style>
<div class="art"></div><div class="grain"></div>
<div class="text">
  <div class="mark"><h1>Helm</h1><div class="dot"></div></div>
  <p>The control panel for <b>Claude Code</b>. Set up projects, see what runs, vet new tools.</p>
  <div class="chips"><span>Per-project setup</span><span>Live map</span><span>Vet before install</span></div>
</div>`

const CARDS = [
  { file: 'project', accent: '#5aa9ff', kicker: 'Set up', title: 'Tell it what you are building', text: 'Helm shortlists the fitting tools you already have, and one press turns them on for that folder only. Undo restores it exactly.' },
  { file: 'research', accent: '#f2b84b', kicker: 'Vet', title: 'Check a tool before it comes in', text: 'Paste a link or a name. Helm reads the repository, gives a plain verdict, and installs only after your yes.' },
  { file: 'global', accent: '#6fd08c', kicker: 'Keep healthy', title: 'Tidy up and update in a press', text: 'Find plugins whose files are gone, broken skills and duplicates. Update every plugin at once, without touching a project.' },
  { file: 'band', accent: '#b28cff', kicker: 'Start', title: 'A quiet notice, never in the way', text: 'In a folder it has not seen, Helm asks once: Open or Not here. It remembers the answer for that folder.' },
]

const card = c => `<!doctype html><meta charset="utf-8"><style>${base}
  body{background:radial-gradient(900px 600px at 85% 30%,${c.accent}33 0%,transparent 60%),radial-gradient(700px 500px at 0% 100%,#0d2547 0%,transparent 70%),#050a1d;display:flex;align-items:center;padding:0 72px;gap:56px}
  .copy{flex:0 0 380px}
  .kicker{font-size:17px;letter-spacing:3px;text-transform:uppercase;color:${c.accent};font-weight:600}
  h2{margin-top:16px;font-size:46px;line-height:1.1;letter-spacing:-1.2px;font-weight:700}
  p{margin-top:20px;font-size:21px;line-height:1.5;color:${DIM}}
  .win{flex:1;display:flex;justify-content:center}
  .win img{width:100%;border-radius:18px;box-shadow:0 40px 90px -20px rgba(0,0,0,.75),0 0 0 1px rgba(255,255,255,.08),0 0 80px -10px ${c.accent}55}
</style>
<div class="copy"><div class="kicker">${c.kicker}</div><h2>${c.title}</h2><p>${c.text}</p></div>
<div class="win"><img src="${data(`screenshot-${c.file}.png`)}"></div>`

function findChrome() {
  const candidates = [
    process.env.CHROME,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    'google-chrome',
    'chromium',
  ].filter(Boolean)
  return candidates.find(c => existsSync(c) || spawnSync(c, ['--version'], { stdio: 'ignore' }).status === 0)
}

const chrome = findChrome()
if (!chrome) throw new Error('No Chrome, Chromium or Edge found. Set CHROME to its path.')
const work = mkdtempSync(join(tmpdir(), 'helm-brand-'))

function render(html, out, w, h) {
  const page = join(work, 'page.html')
  writeFileSync(page, html)
  const profile = mkdtempSync(join(tmpdir(), 'helm-chrome-'))
  const r = spawnSync(chrome, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--user-data-dir=${profile}`, `--window-size=${w},${h}`, '--force-device-scale-factor=1', `--screenshot=${out}`, pathToFileURL(page).href], { stdio: 'ignore' })
  rmSync(profile, { recursive: true, force: true })
  if (r.status !== 0 || !existsSync(out)) throw new Error(`Chrome did not write ${out}`)
  console.log(out.replace(`${root}${process.platform === 'win32' ? '\\' : '/'}`, ''))
}

try {
  render(banner(), join(docs, 'banner.png'), 1280, 640)
  render(banner(), join(docs, 'social-preview.png'), 1280, 640)
  for (const c of CARDS) render(card(c), join(docs, `feature-${c.file}.png`), 1280, 640)
} finally {
  rmSync(work, { recursive: true, force: true })
}
