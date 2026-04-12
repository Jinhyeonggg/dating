# Implicit Persona 온보딩 + Clone 관계 기억 설계

> **상태**: Approved (2026-04-12)
> **범위**: Phase 2-A (Implicit Persona 온보딩) + Phase 2-B (Clone 관계 기억)

---

## 1. 배경 & 동기

### 문제 1: 페르소나 입력 장벽
유저가 40개+ 필드를 직접 채울 동기가 없다. 빈약한 페르소나 → 뻔한 Interaction → 유저 이탈.

### 문제 2: Clone 정체성 부재
Interaction 간 기억이 연결되지 않는다. 같은 상대와 재대화해도 처음 만난 것처럼 행동. "살아있는 디지털 존재"가 아닌 느낌.

### 해결 방향
- **Phase 2-A**: Clone 생성 후 시나리오 반응형 + 선택지 퀴즈 온보딩 (2-3분). 폼과 독립적으로 행동 패턴 추론.
- **Phase 2-B**: Interaction 종료 후 양방향 관계 기억 자동 추출. 재대화 시 system prompt에 주입.

---

## 2. Phase 2-A — Implicit Persona 온보딩

### 2.1 플로우

```
Clone 생성 (Quick Form)
    ↓
"/clones/[id]/onboarding" 페이지로 이동
    ↓
시나리오 반응형 + 선택지 퀴즈 5-7문항 (카드 형태, 한 문항씩)
    ↓
마지막에 "분석 중..." → LLM 1회 호출 (Haiku)
    ↓
추론된 traits 프리뷰 ("AI가 파악한 당신의 성격")
    ↓
유저 확인/수정 → clones.inferred_traits에 저장
    ↓
"/clones/[id]" 상세 페이지로 이동
```

- 온보딩은 **스킵 가능** (상단에 "나중에 하기" 링크)
- Clone 상세에서 "온보딩 다시하기" 버튼으로 재진행 가능
- 폼과 독립적 — 폼을 꼼꼼히 쓴 유저도 온보딩을 하면 추가 정보가 쌓임

### 2.2 질문 설계

질문은 `lib/constants/onboardingQuestions.ts`에 데이터로 관리.

```ts
interface OnboardingQuestion {
  id: string
  type: 'scenario' | 'choice'
  text: string
  choices?: { id: string; label: string }[]  // choice 타입만
  inferTargets: string[]  // 이 질문이 추론하려는 trait 영역
}
```

**시나리오 반응형 (3문항)** — 자유 텍스트 응답, 성격/가치관 추론용:
- "금요일 저녁, 친구가 갑자기 약속을 취소했어요. 어떻게 보내실 것 같아요?"
  → 내향/외향, 즉흥성, 혼자 시간 선호도
- "친한 친구가 당신이 동의하지 않는 결정을 내렸어요. 어떻게 하실 것 같아요?"
  → 갈등 대처 스타일, 직접성, 관계 우선순위
- "처음 만난 사람과 대화가 잘 통하고 있어요. 어떤 주제일 때 가장 신나요?"
  → 관심사 깊이, 대화 선호도

**선택지 퀴즈 (3-4문항)** — 이지선다/사지선다, 커뮤니케이션/라이프스타일 추론용:
- "대화할 때 당신에 더 가까운 쪽은?" A: 생각을 정리한 다음 말한다 / B: 말하면서 생각을 정리한다
- "주말 이상적인 하루는?" A: 집에서 넷플릭스 / B: 카페에서 작업 / C: 친구들과 외출 / D: 새로운 장소 탐험
- "갈등이 생겼을 때?" A: 바로 이야기한다 / B: 시간을 두고 정리한 뒤 이야기한다 / C: 상대가 먼저 꺼내길 기다린다

질문은 최종 구현 시 확정. 위는 설계 의도를 보여주는 예시.

### 2.3 추론 파이프라인

유저 응답 완료 후 **Haiku 1회 호출**:

- 입력: 질문 + 유저 응답 전체
- 프롬프트: "아래 응답을 분석해서 이 사람의 성격 특성을 JSON으로 추출하세요"
- 출력: `InferredTraits` JSON

```ts
interface InferredTraits {
  personality_summary: string       // "내향적이면서 호기심이 많고, 갈등 회피 경향"
  communication_tendency: string    // "생각을 정리한 후 말하는 편, 깊은 대화 선호"
  social_style: string              // "소수와 깊게, 혼자 시간도 중요시"
  value_priorities: string[]        // ["진정성", "자율성", "성장"]
  conflict_style: string            // "직접 대면보다 시간을 두고 정리하는 편"
  energy_pattern: string            // "평일 루틴형, 주말은 여유"
  conversation_topics: string[]     // ["영화", "심리학", "여행 계획"]
  raw_answers: Record<string, string>  // 원본 응답 보존 (재추론/디버깅용)
}
```

- 모든 필드가 자연어 서술 — persona_json 필드와 중복되지 않는 **행동 패턴 중심**
- `raw_answers`는 system prompt에 주입하지 않음. 추후 재추론이나 질문 세트 교체 시 사용

### 2.4 데이터 모델

```sql
ALTER TABLE clones ADD COLUMN inferred_traits jsonb DEFAULT NULL;
```

- 온보딩 미완료 시 `NULL`
- 온보딩 재진행 시 덮어쓰기

### 2.5 System Prompt 주입

기존 `buildEnhancedSystemPrompt`에 `inferred_traits` 레이어 추가. 렌더링 함수: `renderInferredTraits()` (신규).

렌더링 예시:
```
[AI가 파악한 성격 패턴]
- 성격: 내향적이면서 호기심이 많고, 갈등 회피 경향
- 소통: 생각을 정리한 후 말하는 편, 깊은 대화 선호
- 가치관 우선순위: 진정성, 자율성, 성장
- 갈등 대처: 직접 대면보다 시간을 두고 정리하는 편
```

### 2.6 UI

- `/clones/[id]/onboarding` — 신규 페이지. 카드 형태로 한 문항씩 표시, 진행 바
- `/clones/[id]` — 추론 traits 섹션 추가 ("AI가 파악한 성격"). 온보딩 미완료 시 CTA 배너
- `/clones/[id]/edit` — 추론 traits는 편집 불가 (온보딩 재진행으로만 갱신)

---

## 3. Phase 2-B — Clone 관계 기억

### 3.1 데이터 모델

```sql
CREATE TABLE clone_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clone_id uuid NOT NULL REFERENCES clones(id) ON DELETE CASCADE,
  target_clone_id uuid NOT NULL REFERENCES clones(id) ON DELETE CASCADE,
  interaction_count int NOT NULL DEFAULT 1,
  summary text NOT NULL,
  memories jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(clone_id, target_clone_id)
);
```

- `(A, B)`와 `(B, A)`는 별개 row — 각 Clone 관점의 기억
- 하나의 Interaction이 끝나면 **2개의 row** 생성/업데이트 (양방향)
- 첫 Interaction 시 INSERT, 재대화 시 UPDATE (summary 재요약 + memories append)

### 3.2 추출 파이프라인

Interaction 종료 후, 기존 에피소드 메모리 추출과 **같은 타이밍에 병렬 실행**:

```
Interaction 완료
    ↓  (병렬)
├── 기존: 각 Clone별 에피소드 메모리 추출 (Haiku)
└── 신규: 각 Clone별 관계 기억 추출 (Haiku)
    ↓
clone_relationships UPSERT (2 rows)
```

추출 프롬프트 입력:
- 전체 대화 로그
- 이 Clone의 관점 (speaker 기준)
- 이 Clone의 persona (성격/가치관 기반 판단용)
- 상대 Clone의 이름

추출 출력:
```ts
interface ExtractedRelationshipMemory {
  summary: string
  new_memories: {
    topic: string        // "영화 취향"
    detail: string       // "호러 영화 좋아함, 특히 조던 필 팬"
    occurred_at: string  // ISO date
  }[]
}
```

기존 row가 있으면:
- `summary`는 이전 summary + 새 대화를 합쳐 **재요약** (LLM 1회 추가)
- `memories`는 새 항목 append
- `interaction_count` += 1

### 3.3 추출 프롬프트 원칙 — 솔직한 내면 평가

관계 기억 추출 시 AI의 기본 성향(항상 긍정적, 공감적)을 억제하고 **사람다운 솔직한 평가**를 내려야 한다.

프롬프트에 반드시 포함할 원칙:

1. **솔직한 내면 평가** — 겉으로 공감했더라도 실제로 흥미 있었는지, 어색했는지, 지루했는지를 이 Clone의 성격 기준으로 판단
2. **온도 차이 인식** — 한쪽이 열정적이고 다른 쪽이 미지근했으면 그걸 기록
3. **비호감 요소도 기록** — "말을 좀 끊는 편", "관심사가 안 맞았다" 같은 부정적 인상도 포함
4. **페르소나 기반 판단** — 이 Clone의 personality_traits, core_values, dealbreakers에 비추어 상대를 어떻게 느꼈을지 추론

예시 비교:

| AI스러운 추출 (금지) | 사람스러운 추출 (목표) |
|---|---|
| "다양한 주제로 대화를 나눔" | "영화 얘기는 통했는데 운동 쪽은 관심 없는 듯" |
| "서로의 가치관을 공유함" | "가치관 얘기를 꺼냈는데 좀 뜬금없었음" |
| "즐거운 대화였음" | "초반은 어색했고 중반부터 좀 풀림" |
| "상대의 취미에 관심을 보임" | "등산 얘기를 길게 했는데 솔직히 별로" |

실제 프롬프트는 `lib/prompts/relationship.ts`에서 튜닝.

### 3.4 System Prompt 주입

Interaction 시작 시 `orchestrate.ts`에서:
1. `clone_relationships` 테이블에서 `(speaker_clone_id, listener_clone_id)` 조회
2. row가 있으면 관계 기억을 렌더링해서 system prompt에 주입

렌더링 함수: `renderRelationshipMemory()` (신규)

렌더링 예시:
```
[이전 대화 기억 — 상대: 민지]
대화 2회. 영화 취향이 비슷하고 유머 코드가 맞았다.
- 호러 영화를 좋아함, 특히 조던 필 팬 (2026-04-10)
- 주말에 주로 카페에서 시간을 보낸다고 함 (2026-04-10)
- 최근 이직을 고민 중이라고 했음 (2026-04-12)
```

### 3.5 토큰 예산

- `memories` 배열은 **최근 20개**만 주입 (`RELATIONSHIP_MEMORY_INJECTION_LIMIT`)
- `summary`는 재요약 시 **2-3문장 이내**로 제한
- 예상 추가 토큰: 관계당 ~200-300 토큰

### 3.6 RLS

```sql
CREATE POLICY "Users can view their clones' relationships"
  ON clone_relationships FOR SELECT
  USING (clone_id IN (SELECT id FROM clones WHERE user_id = auth.uid()));
```

INSERT/UPDATE는 service client (memory extract 파이프라인).

---

## 4. Phase 확장 로드맵

| Phase | 범위 | 비고 |
|---|---|---|
| **2-A** | Implicit Persona 온보딩 | 페르소나 풍부화. 선행 조건 |
| **2-B** | Clone 관계 기억 (사실 기반) | 양방향 대화 기억 축적 |
| **3+** | 주관적 평가 (`impression`, `affinity_score`) | `clone_relationships`에 컬럼 추가 |
| **3+** | 관계 그래프 | `clone_relationships`가 곧 edge |
| **4+** | 적응형 온보딩 (정적→동적 질문 전환) | 정적 질문 세트가 전반부가 됨 |

---

## 5. System Prompt 조립 순서 (전체)

Interaction 시 Clone별 system prompt는 다음 순서로 조립:

```
1. TEXTURE_RULES              ← lib/prompts/texture.ts
2. PERSONA CORE               ← persona_json (null 필드 제외)
3. INFERRED TRAITS (신규)     ← inferred_traits (null이면 생략)
4. RELATIONSHIP MEMORY (신규) ← clone_relationships (해당 상대, 없으면 생략)
5. EPISODIC MEMORIES          ← clone_memories 최근 10개
6. MOOD HINT                  ← rollMood()
7. STYLE CARDS                ← pickStyleCards()
8. WORLD CONTEXT              ← world_context 테이블
9. BEHAVIOR INSTRUCTIONS      ← lib/prompts/behavior.ts
```

---

## 6. 변경 파일 요약

### DB (마이그레이션)
- `clones`에 `inferred_traits jsonb` 컬럼 추가
- `clone_relationships` 테이블 신설 + RLS

### API (신규)
- `POST /api/clones/[id]/onboarding` — 온보딩 응답 제출 → 추론 → 저장
- (관계 기억 추출은 기존 Interaction run 파이프라인 내부에서 처리, 별도 API 없음)

### API (수정)
- `GET /api/clones/[id]` — `inferred_traits` 포함
- `POST /api/interactions/[id]/run` — 관계 기억 조회 + 추출 로직 추가

### 페이지 (신규)
- `/clones/[id]/onboarding` — 온보딩 퀴즈 UI

### 페이지 (수정)
- `/clones/[id]` — 추론 traits 섹션 + 온보딩 CTA
- Clone 생성 완료 후 → 온보딩 페이지로 리다이렉트

### 코드 (신규)
- `lib/constants/onboardingQuestions.ts` — 질문 세트 데이터
- `lib/prompts/onboarding.ts` — 추론 프롬프트 템플릿
- `lib/prompts/relationship.ts` — 관계 기억 추출 프롬프트 템플릿
- `lib/prompts/persona.ts` — `renderInferredTraits()`, `renderRelationshipMemory()` 추가
- `lib/relationship/extract.ts` — 관계 기억 추출 순수 함수
- `lib/relationship/service.ts` — UPSERT 서비스
- `lib/validation/onboarding.ts` — 온보딩 응답 Zod 스키마
- `lib/validation/relationship.ts` — 관계 기억 Zod 스키마

### 코드 (수정)
- `lib/interaction/orchestrate.ts` — inferred_traits + 관계 기억 주입
- `lib/prompts/persona.ts` — `buildEnhancedSystemPrompt` 입력 확장

---

## 7. Clone 데이터 필드 전체 맵

> 별도 참조 문서: `docs/reference/clone-data-fields.md`

### 저장 레이어

| 레이어 | 저장 위치 | 성격 | 업데이트 빈도 |
|---|---|---|---|
| **Persona Core** | `clones.persona_json` | 유저 직접 입력, 정적 정체성 | 유저가 폼에서 수정할 때 |
| **Inferred Traits** | `clones.inferred_traits` | AI 추론, 행동 패턴 | 온보딩 완료/재진행 시 |
| **Episodic Memory** | `clone_memories` 테이블 | 시간에 따른 경험 | Interaction 후 자동 / 유저 수동 |
| **Relationship Memory** | `clone_relationships` 테이블 | 특정 상대와의 기억 | Interaction 후 자동 |

### Persona Core 필드 (`persona_json`)

| 카테고리 | 필드 |
|---|---|
| Identity | `name`, `age`, `gender`, `location`, `occupation`, `education`, `languages` |
| Personality | `mbti`, `personality_traits`, `strengths`, `weaknesses`, `humor_style`, `emotional_expression` |
| Values | `core_values`, `beliefs`, `life_philosophy`, `dealbreakers` |
| Interests | `hobbies`, `favorite_media` (movies/books/music/games), `food_preferences`, `travel_style` |
| History | `background_story`, `key_life_events`, `career_history`, `past_relationships_summary` |
| Relationships | `family_description`, `close_friends_count`, `social_style`, `relationship_with_family` |
| Lifestyle | `daily_routine`, `sleep_schedule`, `exercise_habits`, `diet`, `pets`, `living_situation` |
| Communication | `communication_style`, `conversation_preferences`, `texting_style`, `response_speed` |
| Goals | `short_term_goals`, `long_term_goals`, `what_seeking_in_others`, `relationship_goal` |
| Self | `self_description`, `tags` |

### Inferred Traits 필드 (`inferred_traits`)

| 필드 | 예시 |
|---|---|
| `personality_summary` | "내향적이면서 호기심이 많고, 갈등 회피 경향" |
| `communication_tendency` | "생각을 정리한 후 말하는 편, 깊은 대화 선호" |
| `social_style` | "소수와 깊게, 혼자 시간도 중요시" |
| `value_priorities` | ["진정성", "자율성", "성장"] |
| `conflict_style` | "직접 대면보다 시간을 두고 정리하는 편" |
| `energy_pattern` | "평일 루틴형, 주말은 여유" |
| `conversation_topics` | ["영화", "심리학", "여행 계획"] |
| `raw_answers` | {원본 응답 보존, prompt에 주입 안 함} |

### Episodic Memory (`clone_memories`)

| 필드 | 설명 |
|---|---|
| `kind` | `event` / `mood` / `fact` / `preference_update` |
| `content` | 자연어 기억 내용 |
| `tags` | 자유 태그 |
| `occurred_at` | ISO date |
| `relevance_score` | 주입 우선순위 (nullable) |

### Relationship Memory (`clone_relationships`)

| 필드 | 설명 |
|---|---|
| `clone_id` | 기억의 주체 |
| `target_clone_id` | 기억의 대상 |
| `interaction_count` | 대화 횟수 |
| `summary` | 1-2문장 관계 요약 |
| `memories` | `[{topic, detail, occurred_at}]` |
| *(Phase 3+)* `impression` | 주관적 인상 |
| *(Phase 3+)* `affinity_score` | 호감도 0.0~1.0 |

### 튜닝 포인트

| 튜닝 대상 | 수정 파일 |
|---|---|
| 카톡 리얼리즘 규칙 | `lib/prompts/texture.ts` |
| 페르소나 렌더링 | `lib/prompts/persona.ts` → `renderPersonaCore()` |
| 추론 traits 렌더링 | `lib/prompts/persona.ts` → `renderInferredTraits()` |
| 관계 기억 렌더링 | `lib/prompts/persona.ts` → `renderRelationshipMemory()` |
| 관계 기억 추출 프롬프트 | `lib/prompts/relationship.ts` |
| 온보딩 추론 프롬프트 | `lib/prompts/onboarding.ts` |
| 에피소드 메모리 주입 개수 | `lib/config/interaction.ts` → `MEMORY_INJECTION_LIMIT` |
| 관계 기억 주입 개수 | `lib/config/interaction.ts` → `RELATIONSHIP_MEMORY_INJECTION_LIMIT` |
| 기분 롤 로직 | `lib/mood/roll.ts` |
| 말투 스타일 카드 | `lib/styles/cards/*.ts` |
| 세계 맥락 주입 | `lib/world/inject.ts` |
| 대화 행동 규칙 | `lib/prompts/behavior.ts` |
| 온보딩 질문 세트 | `lib/constants/onboardingQuestions.ts` |
| 프롬프트 조립 순서 | `lib/interaction/orchestrate.ts` |

---

## 8. 승인 상태

- [x] Phase 2-A / 2-B 순서 및 범위
- [x] 온보딩: 정적 질문 세트 (시나리오 3 + 선택지 3-4), 2-3분
- [x] 온보딩: 폼과 독립적, 스킵 가능
- [x] 저장: `inferred_traits` jsonb 컬럼 (별도 레이어)
- [x] 관계 기억: `clone_relationships` 테이블 (별도 1급 엔티티)
- [x] 관계 기억: 양방향 (A→B, B→A 별개 row)
- [x] 관계 기억: 솔직한 내면 평가 원칙
- [x] 관계 기억: Interaction 종료 시 일괄 추출
- [x] System prompt 조립 순서 9단계
- [x] Clone 데이터 필드 맵 별도 참조 문서로도 관리
