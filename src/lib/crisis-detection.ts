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
] as const

export function findCrisisPhrase(content: string): string | null {
  const lower = content.toLowerCase()
  for (const phrase of CRISIS_PHRASES) {
    if (lower.includes(phrase)) return phrase
  }
  return null
}

export function detectCrisis(content: string): boolean {
  return findCrisisPhrase(content) !== null
}
