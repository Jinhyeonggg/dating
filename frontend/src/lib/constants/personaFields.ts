// frontend/src/lib/constants/personaFields.ts
import type { Persona } from '@/types/persona'

export type PersonaFieldType =
  | 'text'
  | 'number'
  | 'textarea'
  | 'array'
  | 'select'

export interface PersonaFieldDef {
  key: keyof Persona
  label: string
  type: PersonaFieldType
  placeholder?: string
  helpText?: string
  options?: readonly string[]
}

export interface PersonaSectionDef {
  category: string
  label: string
  fields: readonly PersonaFieldDef[]
}

export const PERSONA_SECTIONS: readonly PersonaSectionDef[] = [
  {
    category: 'identity',
    label: '기본 정보',
    fields: [
      { key: 'name', label: '이름', type: 'text', placeholder: '예: 김지수' },
      { key: 'age', label: '나이', type: 'number' },
      { key: 'gender', label: '성별', type: 'select', options: ['여성', '남성', '논바이너리', '기타'] },
      { key: 'location', label: '지역', type: 'text', placeholder: '예: 서울 마포구' },
      { key: 'occupation', label: '직업', type: 'text' },
      { key: 'education', label: '학력', type: 'text' },
      { key: 'languages', label: '사용 언어', type: 'array', helpText: '쉼표로 구분' },
    ],
  },
  {
    category: 'personality',
    label: '성격',
    fields: [
      { key: 'mbti', label: 'MBTI', type: 'text', placeholder: 'INFJ' },
      { key: 'personality_traits', label: '성격 특징', type: 'array' },
      { key: 'strengths', label: '강점', type: 'array' },
      { key: 'weaknesses', label: '약점', type: 'array' },
      { key: 'humor_style', label: '유머 스타일', type: 'textarea' },
      { key: 'emotional_expression', label: '감정 표현 방식', type: 'textarea' },
    ],
  },
  {
    category: 'values',
    label: '가치관 & 신념',
    fields: [
      { key: 'core_values', label: '핵심 가치관', type: 'array' },
      { key: 'beliefs', label: '신념', type: 'array', helpText: '종교·정치관 — 공유하고 싶은 선에서' },
      { key: 'life_philosophy', label: '인생관', type: 'textarea' },
      { key: 'dealbreakers', label: '절대 받아들일 수 없는 것', type: 'array' },
    ],
  },
  {
    category: 'interests',
    label: '취미 & 관심사',
    fields: [
      { key: 'hobbies', label: '취미', type: 'array' },
      { key: 'food_preferences', label: '음식 취향', type: 'array' },
      { key: 'travel_style', label: '여행 스타일', type: 'textarea' },
    ],
  },
  {
    category: 'history',
    label: '과거 & 경험',
    fields: [
      { key: 'background_story', label: '성장 배경', type: 'textarea' },
      { key: 'key_life_events', label: '인생 주요 사건', type: 'array' },
      { key: 'career_history', label: '커리어', type: 'textarea' },
      { key: 'past_relationships_summary', label: '과거 연애사 (선택)', type: 'textarea', helpText: '민감 — 공유 원할 때만' },
    ],
  },
  {
    category: 'relationships',
    label: '인간관계',
    fields: [
      { key: 'family_description', label: '가족', type: 'textarea' },
      { key: 'close_friends_count', label: '친한 친구 수', type: 'number' },
      { key: 'social_style', label: '사교 스타일', type: 'textarea' },
      { key: 'relationship_with_family', label: '가족 관계', type: 'textarea' },
    ],
  },
  {
    category: 'lifestyle',
    label: '라이프스타일',
    fields: [
      { key: 'daily_routine', label: '일과', type: 'textarea' },
      { key: 'sleep_schedule', label: '수면 습관', type: 'text' },
      { key: 'exercise_habits', label: '운동 습관', type: 'text' },
      { key: 'diet', label: '식사', type: 'text' },
      { key: 'pets', label: '반려동물', type: 'text' },
      { key: 'living_situation', label: '거주 형태', type: 'text', placeholder: '1인 가구, 가족과 거주 등' },
    ],
  },
  {
    category: 'communication',
    label: '커뮤니케이션',
    fields: [
      { key: 'communication_style', label: '커뮤니케이션 스타일', type: 'textarea' },
      { key: 'conversation_preferences', label: '대화 선호', type: 'array' },
      { key: 'texting_style', label: '메시지 스타일', type: 'textarea' },
      { key: 'response_speed', label: '응답 속도', type: 'text' },
    ],
  },
  {
    category: 'goals',
    label: '목표 & 바람',
    fields: [
      { key: 'short_term_goals', label: '단기 목표', type: 'array' },
      { key: 'long_term_goals', label: '장기 목표', type: 'array' },
      { key: 'what_seeking_in_others', label: '상대에게 바라는 점', type: 'textarea' },
      { key: 'relationship_goal', label: '관계 목적', type: 'textarea' },
    ],
  },
  {
    category: 'self',
    label: '자기소개',
    fields: [
      { key: 'self_description', label: '자기소개', type: 'textarea' },
      { key: 'tags', label: '태그', type: 'array' },
    ],
  },
] as const

export const QUICK_FORM_FIELD_KEYS: ReadonlyArray<keyof Persona> = [
  'name',
  'age',
  'gender',
  'occupation',
  'mbti',
  'personality_traits',
  'core_values',
  'hobbies',
  'communication_style',
  'self_description',
] as const

export const QUICK_FORM_FIELDS: readonly PersonaFieldDef[] = PERSONA_SECTIONS
  .flatMap((s) => s.fields)
  .filter((f) => QUICK_FORM_FIELD_KEYS.includes(f.key))
