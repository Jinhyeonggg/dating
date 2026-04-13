export interface RelationshipMemoryItem {
  topic: string
  detail: string
  occurred_at: string  // ISO date
  interaction_id?: string  // 이 기억이 생성된 interaction (UI에서 링크용)
}

export interface CloneRelationship {
  id: string
  clone_id: string
  target_clone_id: string
  interaction_count: number
  summary: string
  memories: RelationshipMemoryItem[]
  created_at: string
  updated_at: string
}

export interface ExtractedRelationshipMemory {
  summary: string
  new_memories: RelationshipMemoryItem[]
}
