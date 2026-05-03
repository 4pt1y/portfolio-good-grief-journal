const CRISIS_PHRASES = [
  'want to die',
  "don't want to live",
  'end it all',
  'kill myself',
  "can't go on",
  'no reason to live',
  'better off without me',
  'suicide',
  'hurt myself',
  'self harm',
  'not worth living',
  'wish i was dead',
  'want to disappear forever',
  'death seems welcome',
  'death would be welcome',
  'welcome death',
  "don't want to be here",
  "don't want to be here anymore",
  'ready to go',
  'ready to join them',
  "can't do this anymore",
  "can't keep going",
  'no point anymore',
  "what's the point",
  'tired of living',
  'tired of life',
  'everyone would be better off',
  'just want it to end',
  'want it all to end',
  'wish it was over',
  "life isn't worth it",
] as const

const CRISIS_PATTERNS: readonly RegExp[] = [
  /death[\s\w']{1,20}welcome/i,
  /welcome[\s\w']{1,20}death/i,
]

export function findCrisisPhrase(content: string): string | null {
  const lower = content.toLowerCase()
  for (const phrase of CRISIS_PHRASES) {
    if (lower.includes(phrase)) return phrase
  }
  for (const pattern of CRISIS_PATTERNS) {
    const match = lower.match(pattern)
    if (match) return match[0]
  }
  return null
}

export function detectCrisis(content: string): boolean {
  return findCrisisPhrase(content) !== null
}
