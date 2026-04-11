---
name: persona
description: Clone의 Persona 스키마 및 에피소드 메모리(CloneMemory)를 정의·업데이트·검증할 때 사용. 페르소나 폼, clones 테이블 컬럼, system prompt 생성, 메모리 주입 로직을 작업할 때 참조.
---

# Persona & Clone Memory

Clone의 정체성은 두 레이어로 나뉜다:

1. **Persona Core** — 드물게 변하는 정적 정체성 (성격, 가치관, 과거). `clones.persona_json`에 저장.
2. **Episodic Memory** — 자주 업데이트되는 동적 기억 ("오늘 영화 봤음"). `clone_memories` 테이블에 append.

두 레이어는 업데이트 빈도, 수명, 주입 전략이 다르므로 **절대 섞지 않는다**.

---

## Persona Core 스키마

페르소나는 **가능한 한 구체적이고 풍부하게** 정의한다. 사용자가 제공하지 않은 필드는 `null`로 저장한다.

**LLM 주입 원칙**: `null` 필드는 system prompt에 포함하지 않거나 "알 수 없음"으로 표기하고, 프롬프트에서 "알 수 없는 주제는 자연스럽게 회피하거나 즉흥적으로 답하라"고 지시한다. 빈 필드를 억지로 채우지 않는다.

```ts
interface Persona {
  // Identity — 기본 정보
  name: string
  age: number | null
  gender: string | null
  location: string | null          // "서울 마포구"
  occupation: string | null
  education: string | null         // "대학교 졸업, 디자인 전공"
  languages: string[] | null

  // Personality — 성격
  mbti: string | null
  personality_traits: string[] | null  // ["내향적", "호기심 많음", "계획적"]
  strengths: string[] | null
  weaknesses: string[] | null
  humor_style: string | null       // "드라이한 유머, 말장난"
  emotional_expression: string | null  // "감정 표현 서툼, 글로는 솔직"

  // Values — 가치관 & 신념
  core_values: string[] | null     // ["진정성", "성장", "자율성"]
  beliefs: string[] | null         // 종교·정치·윤리관 — 본인이 밝히길 원하는 선에서
  life_philosophy: string | null
  dealbreakers: string[] | null    // 절대 받아들일 수 없는 것

  // Interests — 취미 & 관심사
  hobbies: string[] | null
  favorite_media: {
    movies: string[] | null
    books: string[] | null
    music: string[] | null
    games: string[] | null
  } | null
  food_preferences: string[] | null
  travel_style: string | null

  // History — 과거 & 경험
  background_story: string | null  // 자유 서술: 어린 시절, 성장 배경
  key_life_events: string[] | null // ["2020 해외 교환학생", "2023 이직"]
  career_history: string | null
  past_relationships_summary: string | null  // 민감 — optional

  // Relationships — 인간관계
  family_description: string | null
  close_friends_count: number | null
  social_style: string | null      // "소수와 깊게"
  relationship_with_family: string | null

  // Lifestyle — 라이프스타일
  daily_routine: string | null
  sleep_schedule: string | null
  exercise_habits: string | null
  diet: string | null
  pets: string | null
  living_situation: string | null  // "1인 가구"

  // Communication — 커뮤니케이션
  communication_style: string | null       // 자유 서술
  conversation_preferences: string[] | null // ["깊은 대화", "유머", "침묵 OK"]
  texting_style: string | null             // "이모지 적게, 긴 문장"
  response_speed: string | null            // "느긋", "즉답형"

  // Goals — 목표 & 바람
  short_term_goals: string[] | null
  long_term_goals: string[] | null
  what_seeking_in_others: string | null    // 상대에게 바라는 것 (관계 목적 무관)
  relationship_goal: string | null         // 1:1 관계 맥락에서만 사용

  // Self — 자기소개
  self_description: string | null          // 자유 서술
  tags: string[] | null                    // 자유 태그
}
```

### 필드 추가/수정 시 규칙
- 신규 필드도 **반드시 nullable**로 추가 (기존 클론 마이그레이션 부담 제거)
- 열거형(enum) 값은 하드코딩하지 말고 `lib/constants/persona.ts`에 상수로 정의
- 민감한 필드(`past_relationships_summary`, `beliefs` 등)는 UI에서 "공유 안 함" 토글 제공

---

## Episodic Memory 스키마

```ts
interface CloneMemory {
  id: string
  clone_id: string
  kind: 'event' | 'mood' | 'fact' | 'preference_update'
  content: string            // "인사이드 아웃 2 관람, 매우 긍정적"
  tags: string[]
  occurred_at: string        // ISO date — "오늘", "어제" 입력은 절대 시간으로 변환
  created_at: string
  relevance_score: number | null  // 최근성·중요도 (주입 우선순위용)
}
```

### Memory kind 구분
- **event**: 특정 시점의 사건 ("어제 친구랑 술 마심")
- **mood**: 일시적 감정 상태 ("요즘 무기력함")
- **fact**: 새로 알게 된 사실·취향 ("김치찜 좋아한다는 걸 깨달음")
- **preference_update**: 기존 persona core 필드 변경 후보 ("이제 고양이 키우고 싶어짐" → pets 필드 업데이트 제안)

---

## 업데이트 플로우 (자연어 → 메모리)

```
User 입력: "나 오늘 인사이드 아웃 2 봤어, 완전 재밌었어"
        ↓
추출 Claude (haiku로 비용 절감)
        ↓
{
  kind: 'event',
  content: '인사이드 아웃 2 관람, 매우 긍정적 반응',
  tags: ['영화', '애니메이션'],
  occurred_at: '2026-04-11'
}
        ↓
clone_memories INSERT
        ↓
(kind === 'preference_update'인 경우)
persona core 업데이트 제안 → 사용자 승인 시 반영
```

### 구현 포인트
- 상대 시간("오늘", "어제", "지난주") → 절대 ISO 날짜로 변환하는 책임은 **추출 단계**에서
- `tags`는 LLM이 자유 생성하되, 자주 쓰는 태그는 추후 정규화 고려
- `preference_update`는 자동 반영 금지 — 반드시 사용자 확인 게이트

---

## system prompt 생성 로직

```ts
function buildSystemPrompt(clone: Clone, recentMemories: CloneMemory[]): string {
  return [
    renderPersonaCore(clone.persona_json),   // null 필드는 제외
    renderRecentMemories(recentMemories),    // 최근 N개, relevance_score 내림차순
    renderBehaviorInstructions(),            // "알 수 없는 주제는 회피", "페르소나 오염 방지"
  ].join('\n\n')
}
```

- **토큰 예산**: system prompt 총 길이 목표 ≤ 1500 토큰 (persona 1000 + memories 500)
- **최근 메모리 주입 개수**: 기본 10개, 설정값으로 조정 가능 (`INTERACTION_MEMORY_INJECTION_LIMIT`)
- 템플릿은 `lib/prompts/persona.ts`에 함수로 관리 (문자열 상수 금지)

---

## 관련 파일 (Phase 1 이후 예정 경로)

- `frontend/src/types/persona.ts` — Persona/CloneMemory 인터페이스
- `frontend/src/lib/prompts/persona.ts` — system prompt 템플릿 함수
- `frontend/src/lib/constants/persona.ts` — 열거형 상수
- `frontend/src/components/persona/` — 입력 폼 컴포넌트
- `frontend/src/app/api/clones/` — Clone CRUD API
- `frontend/src/app/api/memories/` — 메모리 업데이트 API
