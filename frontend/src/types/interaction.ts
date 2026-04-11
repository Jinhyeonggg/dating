export type InteractionStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'

export interface Interaction {
  id: string
  kind: string
  scenario: string
  setting: string | null
  status: InteractionStatus
  max_turns: number
  metadata: Record<string, unknown>
  created_by: string | null
  started_at: string | null
  ended_at: string | null
  created_at: string
}

export interface InteractionEvent {
  id: string
  interaction_id: string
  turn_number: number
  speaker_clone_id: string
  content: string
  created_at: string
}

export interface InteractionParticipant {
  interaction_id: string
  clone_id: string
  role: string | null
  joined_at: string
}

export interface ClaudeMessage {
  role: 'user' | 'assistant'
  content: string
}
