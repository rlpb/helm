// Words for the panel in 16 languages. The language follows the computer's by default and can be
// changed from the panel; the choice is kept.

import { ar } from './ar'
import { de } from './de'
import { en } from './en'
import type { Dict, Key } from './en'
import { es } from './es'
import { fr } from './fr'
import { hi } from './hi'
import { id } from './id'
import { it } from './it'
import { ja } from './ja'
import { ko } from './ko'
import { nl } from './nl'
import { pl } from './pl'
import { pt } from './pt'
import { ru } from './ru'
import { tr } from './tr'
import { zh } from './zh'

export type { Dict, Key }

export const DICTS = { en, it, es, fr, de, pt, nl, ru, zh, ja, ko, hi, ar, tr, pl, id } as const
export type Lang = keyof typeof DICTS

/** Each language written in itself, in the order the picker shows them. */
export const LANGS: { code: Lang; name: string }[] = [
  { code: 'en', name: 'English' },
  { code: 'it', name: 'Italiano' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'pt', name: 'Português' },
  { code: 'nl', name: 'Nederlands' },
  { code: 'ru', name: 'Русский' },
  { code: 'zh', name: '中文' },
  { code: 'ja', name: '日本語' },
  { code: 'ko', name: '한국어' },
  { code: 'hi', name: 'हिन्दी' },
  { code: 'ar', name: 'العربية' },
  { code: 'tr', name: 'Türkçe' },
  { code: 'pl', name: 'Polski' },
  { code: 'id', name: 'Bahasa Indonesia' },
]

export const isLang = (code: unknown): code is Lang => typeof code === 'string' && code in DICTS

/** `it_IT.UTF-8`, `pt-BR`, `zh_CN`, `C`: the language part, when we have it. */
export function fromLocale(locale: string | undefined | null): Lang | null {
  const code = String(locale ?? '').toLowerCase().split(/[._@:-]/)[0]
  return isLang(code) ? code : null
}

/** The computer's language: the usual environment variables first, then what the runtime reports. */
export function detectLang(env: Record<string, string | undefined>, runtime?: string): Lang {
  for (const name of ['LC_ALL', 'LC_MESSAGES', 'LANGUAGE', 'LANG']) {
    const found = fromLocale((env[name] ?? '').split(':')[0])
    if (found) return found
  }
  return fromLocale(runtime) ?? 'en'
}

/** A phrase in a language, with {0}, {1} filled in. A missing word falls back to English. */
export function t(lang: Lang, key: Key, ...vars: (string | number)[]): string {
  const text = (DICTS[lang] as Dict)[key] ?? en[key]
  return text.replace(/\{(\d+)\}/g, (_, i) => String(vars[Number(i)] ?? ''))
}
