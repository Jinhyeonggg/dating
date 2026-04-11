import type { CloneMemoryKind } from '@/types/persona'
import { errors } from '@/lib/errors'

const VALID_KINDS: readonly CloneMemoryKind[] = [
  'event',
  'mood',
  'fact',
  'preference_update',
]

export interface ExtractedMemory {
  kind: CloneMemoryKind
  content: string
  tags: string[]
  occurred_at: string
}

export function parseMemoryExtraction(raw: unknown): ExtractedMemory {
  if (typeof raw !== 'object' || raw === null) {
    throw errors.validation('추출 결과가 객체가 아닙니다')
  }
  const obj = raw as Record<string, unknown>

  if (typeof obj.kind !== 'string') {
    throw errors.validation('kind 필드가 없습니다')
  }
  if (!VALID_KINDS.includes(obj.kind as CloneMemoryKind)) {
    throw errors.validation(`알 수 없는 kind: ${obj.kind}`)
  }
  if (typeof obj.content !== 'string' || obj.content.length === 0) {
    throw errors.validation('content 필드가 없습니다')
  }
  if (typeof obj.occurred_at !== 'string') {
    throw errors.validation('occurred_at 필드가 없습니다')
  }

  const tags = Array.isArray(obj.tags)
    ? obj.tags.filter((t): t is string => typeof t === 'string')
    : []

  return {
    kind: obj.kind as CloneMemoryKind,
    content: obj.content,
    tags,
    occurred_at: obj.occurred_at,
  }
}

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

const RELATIVE_DAYS: Record<string, number> = {
  '오늘': 0,
  '어제': -1,
  '그저께': -2,
  '내일': 1,
  '모레': 2,
  '지난주': -7,
  '다음주': 7,
}

function formatDate(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function normalizeOccurredAt(raw: string, now: Date): string {
  if (ISO_DATE_REGEX.test(raw)) return raw

  const dayDelta = RELATIVE_DAYS[raw.trim()]
  if (dayDelta !== undefined) {
    const d = new Date(now)
    d.setUTCDate(d.getUTCDate() + dayDelta)
    return formatDate(d)
  }

  throw errors.validation(`occurred_at 파싱 실패: ${raw}`)
}
