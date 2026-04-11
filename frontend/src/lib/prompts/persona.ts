import type { Persona, CloneMemory } from '@/types/persona'
import { BEHAVIOR_INSTRUCTIONS } from './behavior'
import { INTERACTION_DEFAULTS } from '@/lib/config/interaction'

export function renderPersonaCore(persona: Persona): string {
  const lines: string[] = [`이름: ${persona.name}`]

  const addField = (label: string, value: string | number | null) => {
    if (value !== null && value !== undefined && value !== '') {
      lines.push(`${label}: ${value}`)
    }
  }
  const addList = (label: string, value: string[] | null) => {
    if (value && value.length > 0) {
      lines.push(`${label}: ${value.join(', ')}`)
    }
  }

  addField('나이', persona.age)
  addField('성별', persona.gender)
  addField('지역', persona.location)
  addField('직업', persona.occupation)
  addField('학력', persona.education)
  addList('사용 언어', persona.languages)

  addField('MBTI', persona.mbti)
  addList('성격 특징', persona.personality_traits)
  addList('강점', persona.strengths)
  addList('약점', persona.weaknesses)
  addField('유머 스타일', persona.humor_style)
  addField('감정 표현', persona.emotional_expression)

  addList('핵심 가치관', persona.core_values)
  addList('신념', persona.beliefs)
  addField('인생관', persona.life_philosophy)
  addList('절대 받아들일 수 없는 것', persona.dealbreakers)

  addList('취미', persona.hobbies)
  addList('음식 취향', persona.food_preferences)
  addField('여행 스타일', persona.travel_style)

  addField('성장 배경', persona.background_story)
  addList('인생 주요 사건', persona.key_life_events)
  addField('커리어', persona.career_history)

  addField('가족', persona.family_description)
  addField('가족 관계', persona.relationship_with_family)
  addField('사교 스타일', persona.social_style)

  addField('일과', persona.daily_routine)
  addField('수면 습관', persona.sleep_schedule)
  addField('운동 습관', persona.exercise_habits)
  addField('식사', persona.diet)
  addField('반려동물', persona.pets)
  addField('거주 형태', persona.living_situation)

  addField('커뮤니케이션 스타일', persona.communication_style)
  addList('대화 선호', persona.conversation_preferences)
  addField('메시지 스타일', persona.texting_style)
  addField('응답 속도', persona.response_speed)

  addList('단기 목표', persona.short_term_goals)
  addList('장기 목표', persona.long_term_goals)
  addField('상대에게 바라는 점', persona.what_seeking_in_others)

  addField('자기소개', persona.self_description)
  addList('태그', persona.tags)

  return lines.join('\n')
}

export function renderRecentMemories(
  memories: CloneMemory[],
  limit: number = INTERACTION_DEFAULTS.MEMORY_INJECTION_LIMIT
): string {
  if (memories.length === 0) return ''

  const sorted = [...memories].sort((a, b) =>
    b.occurred_at.localeCompare(a.occurred_at)
  )
  const picked = sorted.slice(0, limit)
  const lines = picked.map((m) => `- ${m.occurred_at}: ${m.content}`)
  return `최근 기억:\n${lines.join('\n')}`
}

export function buildSystemPrompt(
  persona: Persona,
  memories: CloneMemory[] = []
): string {
  const sections = [
    renderPersonaCore(persona),
    renderRecentMemories(memories),
    BEHAVIOR_INSTRUCTIONS,
  ].filter((s) => s.length > 0)
  return sections.join('\n\n')
}
