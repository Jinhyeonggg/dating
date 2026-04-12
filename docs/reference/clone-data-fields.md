# Clone 데이터 필드 & System Prompt 레퍼런스

> 마지막 업데이트: 2026-04-12
> Clone의 모든 데이터 레이어, Interaction 시 system prompt에 주입되는 필드, 튜닝 포인트를 정리한 문서.

---

## 1. 저장 레이어 요약

| 레이어 | 저장 위치 | 성격 | 업데이트 빈도 |
|---|---|---|---|
| **Persona Core** | `clones.persona_json` | 유저 직접 입력, 정적 정체성 | 유저가 폼에서 수정할 때 |
| **Inferred Traits** | `clones.inferred_traits` | AI 추론, 행동 패턴 | 온보딩 완료/재진행 시 |
| **Episodic Memory** | `clone_memories` 테이블 | 시간에 따른 경험 | Interaction 후 자동 / 유저 수동 |
| **Relationship Memory** | `clone_relationships` 테이블 | 특정 상대와의 기억 | Interaction 후 자동 |

---

## 2. Persona Core (`clones.persona_json`)

유저가 폼에서 직접 입력하는 정적 정체성. 모든 필드는 `name` 제외 nullable.

### Identity
| 필드 | 타입 | 예시 |
|---|---|---|
| `name` | `string` | "민지" |
| `age` | `number \| null` | 28 |
| `gender` | `string \| null` | "여성" |
| `location` | `string \| null` | "서울 마포구" |
| `occupation` | `string \| null` | "UX 디자이너" |
| `education` | `string \| null` | "대학교 졸업, 디자인 전공" |
| `languages` | `string[] \| null` | ["한국어", "영어"] |

### Personality
| 필드 | 타입 | 예시 |
|---|---|---|
| `mbti` | `string \| null` | "INFP" |
| `personality_traits` | `string[] \| null` | ["내향적", "호기심 많음"] |
| `strengths` | `string[] \| null` | ["경청", "공감 능력"] |
| `weaknesses` | `string[] \| null` | ["우유부단", "거절 못함"] |
| `humor_style` | `string \| null` | "드라이한 유머, 말장난" |
| `emotional_expression` | `string \| null` | "감정 표현 서툼, 글로는 솔직" |

### Values
| 필드 | 타입 | 예시 |
|---|---|---|
| `core_values` | `string[] \| null` | ["진정성", "성장", "자율성"] |
| `beliefs` | `string[] \| null` | ["개인의 자유 존중"] |
| `life_philosophy` | `string \| null` | "지금 이 순간을 즐기자" |
| `dealbreakers` | `string[] \| null` | ["거짓말", "무례함"] |

### Interests
| 필드 | 타입 | 예시 |
|---|---|---|
| `hobbies` | `string[] \| null` | ["독서", "카페 탐방", "등산"] |
| `favorite_media` | `object \| null` | `{movies: ["인셉션"], books: [...], music: [...], games: [...]}` |
| `food_preferences` | `string[] \| null` | ["매운 음식", "일식"] |
| `travel_style` | `string \| null` | "계획형, 현지 맛집 중심" |

### History
| 필드 | 타입 | 예시 |
|---|---|---|
| `background_story` | `string \| null` | 자유 서술 |
| `key_life_events` | `string[] \| null` | ["2020 해외 교환학생"] |
| `career_history` | `string \| null` | 자유 서술 |
| `past_relationships_summary` | `string \| null` | 민감, optional |

### Relationships
| 필드 | 타입 | 예시 |
|---|---|---|
| `family_description` | `string \| null` | "부모님, 여동생 1명" |
| `close_friends_count` | `number \| null` | 3 |
| `social_style` | `string \| null` | "소수와 깊게" |
| `relationship_with_family` | `string \| null` | "가까운 편" |

### Lifestyle
| 필드 | 타입 | 예시 |
|---|---|---|
| `daily_routine` | `string \| null` | "9-6 출퇴근, 저녁 운동" |
| `sleep_schedule` | `string \| null` | "12시 취침, 7시 기상" |
| `exercise_habits` | `string \| null` | "주 3회 필라테스" |
| `diet` | `string \| null` | "특별한 제한 없음" |
| `pets` | `string \| null` | "고양이 1마리" |
| `living_situation` | `string \| null` | "1인 가구" |

### Communication
| 필드 | 타입 | 예시 |
|---|---|---|
| `communication_style` | `string \| null` | 자유 서술 |
| `conversation_preferences` | `string[] \| null` | ["깊은 대화", "유머"] |
| `texting_style` | `string \| null` | "이모지 적게, 긴 문장" |
| `response_speed` | `string \| null` | "느긋" |

### Goals
| 필드 | 타입 | 예시 |
|---|---|---|
| `short_term_goals` | `string[] \| null` | ["이직 성공"] |
| `long_term_goals` | `string[] \| null` | ["해외 거주"] |
| `what_seeking_in_others` | `string \| null` | "유머감각, 솔직함" |
| `relationship_goal` | `string \| null` | "진지한 관계" |

### Self
| 필드 | 타입 | 예시 |
|---|---|---|
| `self_description` | `string \| null` | 자유 서술 |
| `tags` | `string[] \| null` | ["독서러", "카페러"] |

---

## 3. Inferred Traits (`clones.inferred_traits`)

온보딩 시나리오/퀴즈에서 AI가 추론한 행동 패턴. persona_json과 중복되지 않는 차원.

| 필드 | 타입 | 프롬프트 주입 | 예시 |
|---|---|---|---|
| `personality_summary` | `string` | O | "내향적이면서 호기심이 많고, 갈등 회피 경향" |
| `communication_tendency` | `string` | O | "생각을 정리한 후 말하는 편, 깊은 대화 선호" |
| `social_style` | `string` | O | "소수와 깊게, 혼자 시간도 중요시" |
| `value_priorities` | `string[]` | O | ["진정성", "자율성", "성장"] |
| `conflict_style` | `string` | O | "직접 대면보다 시간을 두고 정리하는 편" |
| `energy_pattern` | `string` | O | "평일 루틴형, 주말은 여유" |
| `conversation_topics` | `string[]` | O | ["영화", "심리학", "여행 계획"] |
| `raw_answers` | `Record<string, string>` | **X** | 원본 응답 보존, 재추론/디버깅용 |

---

## 4. Episodic Memory (`clone_memories` 테이블)

시간에 따른 경험 기억. Interaction 후 Haiku가 자동 추출하거나, 유저가 직접 입력.

| 필드 | 타입 | 프롬프트 주입 | 설명 |
|---|---|---|---|
| `kind` | `enum` | O | `event` / `mood` / `fact` / `preference_update` |
| `content` | `string` | O | "인사이드 아웃 2 관람, 매우 긍정적" |
| `tags` | `string[]` | X | 분류용 |
| `occurred_at` | `string` | O | ISO date |
| `relevance_score` | `number \| null` | 정렬용 | 주입 우선순위 |

주입 개수: 최근 **10개** (`MEMORY_INJECTION_LIMIT`)

---

## 5. Relationship Memory (`clone_relationships` 테이블)

특정 상대 Clone과의 대화 기억. `(A, B)`와 `(B, A)`는 별개 row.

| 필드 | 타입 | 프롬프트 주입 | 설명 |
|---|---|---|---|
| `clone_id` | `uuid` | X | 기억의 주체 |
| `target_clone_id` | `uuid` | X | 기억의 대상 |
| `interaction_count` | `int` | O | 대화 횟수 |
| `summary` | `text` | O | "2회 대화. 영화 취향 비슷, 유머 코드 맞음" |
| `memories` | `jsonb` | O | `[{topic, detail, occurred_at}]` |
| *(Phase 3+)* `impression` | `text` | O | 주관적 인상 |
| *(Phase 3+)* `affinity_score` | `float` | X | 호감도 0.0~1.0 |

주입 개수: memories 배열 최근 **20개** (`RELATIONSHIP_MEMORY_INJECTION_LIMIT`)

---

## 6. System Prompt 조립 순서

Interaction 시 Clone별 system prompt 조립 순서. 위에서 아래로 이어붙임.

| # | 레이어 | 소스 | 생략 조건 |
|---|---|---|---|
| 1 | Texture Rules | `lib/prompts/texture.ts` | 없음 (항상 포함) |
| 2 | Persona Core | `clones.persona_json` | null 필드만 생략 |
| 3 | Inferred Traits | `clones.inferred_traits` | 전체가 null이면 생략 |
| 4 | Relationship Memory | `clone_relationships` | 해당 상대 row 없으면 생략 |
| 5 | Episodic Memories | `clone_memories` | 메모리 0개면 생략 |
| 6 | Mood Hint | `rollMood()` | 없음 (항상 생성) |
| 7 | Style Cards | `pickStyleCards()` | 매칭 0개면 생략 |
| 8 | World Context | `world_context` 테이블 | 데이터 없으면 생략 |
| 9 | Behavior Instructions | `lib/prompts/behavior.ts` | 없음 (항상 포함) |

---

## 7. 튜닝 가이드

| 바꾸고 싶은 것 | 파일 | 함수/상수 |
|---|---|---|
| 카톡 리얼리즘 규칙 | `lib/prompts/texture.ts` | `TEXTURE_RULES` |
| 페르소나 렌더링 방식 | `lib/prompts/persona.ts` | `renderPersonaCore()` |
| 추론 traits 렌더링 | `lib/prompts/persona.ts` | `renderInferredTraits()` |
| 관계 기억 렌더링 | `lib/prompts/persona.ts` | `renderRelationshipMemory()` |
| 관계 기억 추출 프롬프트 | `lib/prompts/relationship.ts` | 전체 |
| 온보딩 추론 프롬프트 | `lib/prompts/onboarding.ts` | 전체 |
| 온보딩 질문 세트 | `lib/constants/onboardingQuestions.ts` | 전체 |
| 에피소드 메모리 주입 개수 | `lib/config/interaction.ts` | `MEMORY_INJECTION_LIMIT` |
| 관계 기억 주입 개수 | `lib/config/interaction.ts` | `RELATIONSHIP_MEMORY_INJECTION_LIMIT` |
| 기분 롤 로직 | `lib/mood/roll.ts` | `rollMood()` |
| 말투 스타일 카드 추가/수정 | `lib/styles/cards/*.ts` | 카드별 파일 |
| 스타일 카드 매칭 로직 | `lib/styles/match.ts` | `pickStyleCards()` |
| 세계 맥락 주입 형식 | `lib/world/inject.ts` | `buildWorldSnippet()` |
| 대화 행동 규칙 | `lib/prompts/behavior.ts` | `BEHAVIOR_INSTRUCTIONS` |
| 프롬프트 조립 순서/구조 | `lib/interaction/orchestrate.ts` | `prepareClonePrompts()` |
| 토큰 예산 (전체) | `lib/config/claude.ts` | `CLAUDE_LIMITS` |
