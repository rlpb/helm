import { describe, expect, test } from 'claude-code/testing'

import { DICTS, LANGS, detectLang, fromLocale, t } from '../src/i18n'
import { en } from '../src/i18n/en'

const slots = (s: string) => [...s.matchAll(/\{(\d+)\}/g)].map(m => m[1]).sort().join(',')

describe('languages', () => {
  test('there are at least 16, each listed once and each with a dictionary', () => {
    expect(LANGS.length).toBeGreaterThanOrEqual(16)
    expect(new Set(LANGS.map(l => l.code)).size).toBe(LANGS.length)
    expect(Object.keys(DICTS).sort()).toEqual(LANGS.map(l => l.code).sort())
  })

  test('every language has every phrase, no extra, and keeps every {n} slot', () => {
    for (const [code, dict] of Object.entries(DICTS)) {
      expect(Object.keys(dict).sort(), code).toEqual(Object.keys(en).sort())
      for (const key of Object.keys(en) as (keyof typeof en)[]) {
        expect(typeof dict[key], `${code} ${key}`).toBe('string')
        expect(dict[key].length, `${code} ${key}`).toBeGreaterThan(0)
        expect(slots(dict[key]), `${code} ${key}`).toBe(slots(en[key]))
      }
    }
  })

  test('a phrase is filled in, and the other languages really differ from English', () => {
    expect(t('en', 'g.todo', 3)).toBe('3 to look at')
    expect(t('it', 'g.todo', 3)).toBe('3 da guardare')
    const same = Object.keys(en).filter(k => DICTS.it[k as keyof typeof en] === en[k as keyof typeof en])
    expect(same.length).toBeLessThan(12)
  })
})

describe('the default language', () => {
  test('it follows the environment, then the runtime, then English', () => {
    expect(detectLang({ LANG: 'it_IT.UTF-8' })).toBe('it')
    expect(detectLang({ LC_ALL: 'pt_BR.UTF-8', LANG: 'en_US.UTF-8' })).toBe('pt')
    expect(detectLang({ LANGUAGE: 'de:en' })).toBe('de')
    expect(detectLang({}, 'ja-JP')).toBe('ja')
    expect(detectLang({ LANG: 'C' })).toBe('en')
    expect(detectLang({})).toBe('en')
    expect(fromLocale('zh_CN.UTF-8')).toBe('zh')
    expect(fromLocale('xx')).toBeNull()
  })
})
