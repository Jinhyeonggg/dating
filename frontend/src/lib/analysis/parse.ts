import type { AnalysisReport, CategoryScore } from '@/types/analysis'
import { ANALYSIS_CATEGORIES } from '@/lib/config/analysis'
import { errors } from '@/lib/errors'

export function parseAnalysisReport(raw: unknown): AnalysisReport {
  if (typeof raw !== 'object' || raw === null) {
    throw errors.validation('분석 결과가 객체가 아닙니다')
  }
  const obj = raw as Record<string, unknown>

  if (typeof obj.score !== 'number' || obj.score < 0 || obj.score > 100) {
    throw errors.validation('score는 0-100 범위여야 합니다')
  }

  if (typeof obj.categories !== 'object' || obj.categories === null) {
    throw errors.validation('categories 객체가 없습니다')
  }
  const rawCategories = obj.categories as Record<string, unknown>
  const categories: Record<string, CategoryScore> = {}

  for (const key of ANALYSIS_CATEGORIES) {
    const entry = rawCategories[key]
    if (typeof entry !== 'object' || entry === null) {
      throw errors.validation(`categories.${key} 누락`)
    }
    const e = entry as Record<string, unknown>
    if (typeof e.score !== 'number') {
      throw errors.validation(`categories.${key}.score 누락`)
    }
    if (typeof e.comment !== 'string') {
      throw errors.validation(`categories.${key}.comment 누락`)
    }
    categories[key] = { score: e.score, comment: e.comment }
  }

  if (typeof obj.summary !== 'string') {
    throw errors.validation('summary 누락')
  }

  const next = obj.recommended_next
  if (next !== 'continue' && next !== 'pause' && next !== 'end') {
    throw errors.validation('recommended_next 값이 유효하지 않음')
  }

  return {
    score: obj.score,
    categories,
    summary: obj.summary,
    recommended_next: next,
  }
}
