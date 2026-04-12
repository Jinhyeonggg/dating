import { describe, it, expect } from 'vitest'
import { buildEnhancedSystemPrompt } from './persona'
import type { MoodState } from '@/lib/mood/types'

describe('buildEnhancedSystemPrompt', () => {
  it('모든 섹션을 포함한 프롬프트를 생성한다', () => {
    const result = buildEnhancedSystemPrompt({
      persona: { name: '테스트' } as any,
      memories: [],
      textureRules: '[텍스처 규칙]',
      styleCards: [{
        id: 'test', label: '테스트', match: {},
        sample: 'A: 안녕\nB: 응',
      }],
      mood: { primary: '활기', energy: 0.8, openness: 0.7, warmth: 0.6, reason_hint: '' },
      worldSnippet: { items: [], promptText: '[오늘 뉴스]' },
    })

    expect(result).toContain('[텍스처 규칙]')
    expect(result).toContain('테스트')
    expect(result).toContain('활기')
    expect(result).toContain('스타일 참고')
    expect(result).toContain('[오늘 뉴스]')
  })

  it('선택적 파라미터 없이도 동작한다', () => {
    const result = buildEnhancedSystemPrompt({
      persona: { name: '최소' } as any,
    })
    expect(result).toContain('최소')
    expect(result).not.toContain('스타일 참고')
    expect(result).not.toContain('기분')
  })
})
