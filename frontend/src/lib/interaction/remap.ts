import type { InteractionEvent, ClaudeMessage } from '@/types/interaction'
import type { Clone } from '@/types/persona'

export function remapHistoryForSpeaker(
  events: InteractionEvent[],
  speakerCloneId: string,
  cloneNames: Map<string, string>
): ClaudeMessage[] {
  return events.map((e) => {
    if (e.speaker_clone_id === speakerCloneId) {
      return { role: 'assistant' as const, content: e.content }
    }
    const name = cloneNames.get(e.speaker_clone_id) ?? 'Unknown'
    return { role: 'user' as const, content: `[${name}]: ${e.content}` }
  })
}

export function pickSpeaker(participants: Clone[], turnNumber: number): Clone {
  if (participants.length === 0) {
    throw new Error('pickSpeaker: participants cannot be empty')
  }
  return participants[turnNumber % participants.length]
}
