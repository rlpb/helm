// Two ways to pick tools with more care than a word match, both pure:
//  - a hint while working: a tool that is off and fits the prompt just typed
//  - a refinement: one small-model call that reads the shortlist's candidates and keeps the ones that fit

import type { Entry } from '../types'
import { scored } from './shortlist'

/** A score of 3: one word of the name, or three of the description. */
export const HINT_MIN = 3
/** A tool is only offered when the prompt names it (a word of its name) and a second word fits. A description alone is too wide: long ones match any prompt. */
/** Different words of the prompt that must hit: one word, however strong, is a coincidence. */
export const HINT_WORDS = 2

/** The one off tool that fits a prompt best, or null. Ignored tools never come back. */
export function hintFor(index: Entry[], prompt: string, ignored: string[]): string | null {
  const off = new Map(index.filter(e => !e.on && !ignored.includes(e.key)).map(e => [e.key, e]))
  const best = scored([...off.values()], prompt).find(r => r.words >= HINT_WORDS && r.named >= 1)
  return best && best.score >= HINT_MIN ? best.key : null
}

/** A rough size of a text in tokens, for the price shown before the call. */
export const estimateTokens = (text: string): number => Math.ceil(text.length / 4)

/** The question for the small model: a numbered list of candidates and the person's words. */
export function refinePrompt(candidates: Entry[], text: string): string {
  const list = candidates.map((e, i) => `${i + 1}. ${e.name}: ${e.description || 'no description'}`).join('\n')
  return [
    `A person is working on: "${text}".`,
    'Which of these tools would help? Answer with the numbers of the useful ones as a JSON array, nothing else. Use [] when none help.',
    list,
  ].join('\n')
}

/** The keys the model chose; anything that is not a valid number in range is dropped. */
export function parseChoice(reply: string, candidates: Entry[]): string[] {
  const array = reply.match(/\[[\d,\s]*\]/)
  if (!array) return []
  try {
    const numbers = JSON.parse(array[0]) as unknown[]
    return [...new Set(numbers.filter((n): n is number => Number.isInteger(n) && n >= 1 && n <= candidates.length))].map(n => candidates[n - 1].key)
  } catch {
    return []
  }
}
