import type { InteractionEvent } from '@/types/interaction'
import {
  INTERACTION_DEFAULTS,
  END_PROMISE_MARKER,
} from '@/lib/config/interaction'

export function shouldEnd(
  events: InteractionEvent[],
  maxTurns: number,
  lastResponse: string
): boolean {
  if (events.length >= maxTurns) return true
  if (lastResponse.includes(END_PROMISE_MARKER)) return true

  const threshold = INTERACTION_DEFAULTS.END_SIGNAL_SHORT_TURNS_THRESHOLD
  if (events.length >= threshold) {
    const recent = events.slice(-threshold)
    const allShort = recent.every(
      (e) => e.content.length < INTERACTION_DEFAULTS.MIN_RESPONSE_LENGTH
    )
    if (allShort) return true
  }
  return false
}
