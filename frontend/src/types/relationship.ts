export interface RelationshipMemoryItem {
  topic: string
  detail: string
  occurred_at: string  // ISO date
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
