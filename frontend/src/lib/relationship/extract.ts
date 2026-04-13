import { errors } from '@/lib/errors'
import type { ExtractedRelationshipMemory, RelationshipMemoryItem } from '@/types/relationship'

export function parseRelationshipExtraction(raw: unknown): ExtractedRelationshipMemory {
  if (typeof raw !== 'object' || raw === null) {
    throw errors.validation('관계 기억 추출 결과가 객체가 아닙니다')
  }
  const obj = raw as Record<string, unknown>

  if (typeof obj.summary !== 'string' || obj.summary.length === 0) {
    throw errors.validation('summary 필드가 없거나 비어있습니다')
  }

  if (!Array.isArray(obj.new_memories)) {
    throw errors.validation('new_memories 필드가 배열이 아닙니다')
  }

  const validMemories: RelationshipMemoryItem[] = obj.new_memories
    .filter((item): item is Record<string, unknown> =>
      typeof item === 'object' && item !== null
    )
    .filter((item) =>
      typeof item.topic === 'string' && item.topic.length > 0 &&
      typeof item.detail === 'string' && item.detail.length > 0
    )
    .map((item) => ({
      topic: item.topic as string,
      detail: item.detail as string,
      occurred_at: typeof item.occurred_at === 'string' ? item.occurred_at : '',
    }))

  if (validMemories.length === 0) {
    throw errors.validation('유효한 new_memories가 없습니다')
  }

  return {
    summary: obj.summary,
    new_memories: validMemories,
  }
}
