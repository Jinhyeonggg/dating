# 튜닝 가이드

> 마지막 업데이트: 2026-04-13
> Clone 대화 품질, 온보딩, 대화 패턴 등을 조정하기 위한 실전 가이드.
> 모든 경로는 `frontend/src/` 기준.

---

## 1. System Prompt 튜닝

Interaction 시 Clone별 system prompt는 9개 레이어로 조립된다. 각 레이어를 독립적으로 수정 가능.

### 1-1. 카톡 리얼리즘 규칙 (Texture Rules)

**파일:** `lib/prompts/texture.ts` → `TEXTURE_RULES` 상수

**역할:** 모든 Clone에 공통 적용되는 한국어 카톡 대화 규칙. 마침표 사용, 줄임말, 감정 표현, 문법 등.

**튜닝 방법:** 문자열을 직접 수정. 규칙 추가/제거/수정.

**예시:**
- 이모지 사용 빈도를 높이고 싶으면 → "이모지는 쓰는 사람만 써" 규칙을 완화
- 반말/존댓말 구분을 더 엄격하게 하고 싶으면 → 섹션 3, 6의 register 규칙 강화
- 문장 길이를 줄이고 싶으면 → "2~4개로 나눠서 보내는 게 보통" 수치 조정

---

### 1-2. 페르소나 렌더링

**파일:** `lib/prompts/persona.ts` → `renderPersonaCore(persona)`

**역할:** `persona_json`의 null 아닌 필드를 `이름: 민지\n나이: 28\n...` 형태로 렌더링.

**튜닝 방법:** 렌더링 순서, 포맷, 어떤 필드를 강조할지 수정.

**예시:**
- 특정 필드를 더 강조하고 싶으면 → `★ 핵심 취미: ${hobbies}` 처럼 마커 추가
- 필드 순서를 바꾸고 싶으면 → `PERSONA_SECTIONS` 순서 변경 (`lib/constants/personaFields.ts`)

---

### 1-3. 추론 Traits 렌더링

**파일:** `lib/prompts/persona.ts` → `renderInferredTraits(traits)`

**역할:** 온보딩에서 추론된 행동 패턴을 `[AI가 파악한 성격 패턴]` 블록으로 렌더링.

**튜닝 방법:** 렌더링 포맷, 어떤 필드를 포함할지, 톤 수정.

**예시:**
- 추론 결과를 더 강하게 반영하고 싶으면 → "이 패턴을 강하게 유지하세요" 지시 추가
- 특정 trait만 주입하고 싶으면 → 조건부 렌더링 추가

---

### 1-4. 에피소드 메모리 주입

**파일:** `lib/prompts/persona.ts` → `renderRecentMemories(memories, limit)`

**설정:** `lib/config/interaction.ts` → `INTERACTION_DEFAULTS.MEMORY_INJECTION_LIMIT` (기본 10)

**튜닝 방법:**
- 주입 개수 조정: `MEMORY_INJECTION_LIMIT` 값 변경 (5~20 범위 추천)
- 정렬 기준 변경: 현재 `occurred_at` 역순 (최신 우선). `relevance_score` 기반으로 바꿀 수도 있음
- 렌더링 포맷 변경: 현재 `- 2026-04-12: 영화 봤음` 형태

---

### 1-5. Mood 롤

**파일:** `lib/mood/roll.ts` + `lib/prompts/mood.ts` + `lib/mood/fallback.ts`

**역할:** Interaction 시작 시 Clone의 기분을 결정. Haiku가 persona + 메모리 + 세계 맥락을 보고 추론.

**튜닝 방법:**
- 가능한 기분 종류 변경: `mood.ts`의 `primary` 목록 (`평온/설렘/짜증/우울/활기/피곤/긴장`)
- 기분이 대화에 미치는 영향: `persona.ts`의 `renderMoodHint()` — 현재 1-2줄 자연어
- Haiku 호출 실패 시 폴백: `fallback.ts` — 코드로 결정적(deterministic) 기분 생성
- Haiku 호출을 아예 끄고 싶으면: `orchestrate.ts`에서 `rollMood` 대신 `fallbackMoodRoll` 직접 호출

**주의:** Mood는 tint(색조)이지 driver가 아님. 대화를 지배하면 안 됨. 1-2줄 힌트로 충분.

---

### 1-6. 스타일 카드

**파일:** `lib/styles/cards/*.ts` (6장 시드)

**역할:** 말투 few-shot 예시. Clone의 페르소나에 맞는 카드 2장을 자동 매칭해서 시스템 프롬프트에 주입.

**카드 추가 방법:**
1. `lib/styles/cards/` 에 새 `.ts` 파일 생성
2. 기존 카드(`casual_close_male.ts` 등) 구조를 따라 작성:
   ```ts
   import type { StyleCard } from '../types'
   export const card: StyleCard = {
     id: 'unique_id',
     label: '설명',
     match: {
       age_range: [20, 35],      // 나이 범위
       gender: ['남성'],          // 성별 필터
       register: 'casual',       // casual | formal | mixed
       energy: 'high',           // high | mid | low
       humor: 'playful',         // dry | playful | warm | none
     },
     sample: `A: 예시 대화\nB: 응답`,  // few-shot 예시
     texture_notes: '반말. 짧은 문장.',  // 추가 톤 지시
   }
   ```
3. `lib/styles/index.ts`의 `getAllStyleCards()`에 자동 등록됨 (dynamic import)

**매칭 로직 튜닝:** `lib/styles/match.ts` → `pickStyleCards()`
- 4-tier 가중치: Communication 필드 > Personality > 나이/성별 > 에너지/유머
- `REALISM_DEFAULTS.STYLE_CARD_TOP_K` (기본 2) — 주입할 카드 수

**현재 카드 6장:**
- `formal_polite_young` — 존댓말 젊은 톤
- `formal_polite_mature` — 존댓말 성숙한 톤
- `casual_close_female` — 반말 여성 친근 톤
- `casual_close_male` — 반말 남성 친근 톤
- `mixed_warming_up` — 존댓말→반말 전환 중
- `default_casual` — 기본 캐주얼

---

### 1-7. 세계 맥락 (World Context)

**관리:** `/admin/world` 페이지에서 수동 추가/삭제

**설정:** `lib/config/interaction.ts`:
- `REALISM_DEFAULTS.WORLD_CONTEXT_TOP_N` (기본 5) — Clone당 주입할 맥락 수
- `REALISM_DEFAULTS.WORLD_CONTEXT_FALLBACK_DAYS` (기본 7) — 최근 N일 맥락 검색

**튜닝:** 오늘의 뉴스, 날씨, 이벤트 등을 `/admin/world`에서 입력하면 Interaction 시 Clone에게 주입됨.

---

### 1-8. 행동 규칙 (Behavior Instructions)

**파일:** `lib/prompts/behavior.ts` → `BEHAVIOR_INSTRUCTIONS` 상수

**역할:** 정체성 유지, 대화 밀도, AI 티 금지, 종료 신호, 다음 발화자 태그 등 핵심 행동 규칙.

**튜닝 방법:** 문자열 직접 수정.

**주요 조정 포인트:**
- 질문 비율: 현재 "질문 턴과 진술 턴의 비율은 대략 3:7" → 비율 변경
- 인사 규칙: 현재 "인사는 1턴이면 충분" → 완화 또는 강화
- 종료 신호: `<promise>END</promise>` 패턴
- 연속 발화: `<continue/>` / `<end/>` 태그 사용 규칙
- AI 티 금지 목록: 메타 언급, 어시스턴트 톤, 공감 인플레이션 등

---

## 2. 온보딩 질문 변경

**파일:** `lib/constants/onboardingQuestions.ts`

**구조:**
```ts
{
  id: 'unique_id',           // 고유 ID (raw_answers 키로 사용)
  type: 'scenario' | 'choice',
  text: '질문 문구',
  choices?: [{ id: 'choice_id', label: '선택지 텍스트' }],  // choice 타입만
  inferTargets: ['personality_summary', ...],  // 추론 대상 (문서용, 실제 추론은 프롬프트가 결정)
}
```

**질문 추가/수정/삭제:** 배열 항목을 직접 수정. 코드 변경 외 별도 작업 없음.

**추론 프롬프트 튜닝:** `lib/prompts/onboarding.ts` → `buildTraitsInferencePrompt()`
- 추론 결과 JSON 구조를 바꾸고 싶으면 프롬프트의 JSON 템플릿 수정
- 추론 규칙("과도한 추론 금지" 등) 조정 가능
- **주의:** JSON 구조를 바꾸면 `lib/onboarding/extract.ts`의 파서도 함께 수정해야 함

---

## 3. 대화 패턴 · 턴 수 조절

### 3-1. 턴 수

**파일:** `lib/config/interaction.ts` → `INTERACTION_DEFAULTS.MAX_TURNS` (기본 20)

**영향:**
- 턴 수 ↑ → 대화 길어짐, API 비용 증가, 타임아웃 위험 증가
- 턴 수 ↓ → 대화 짧아짐, 비용 절감, 속도 개선
- **권장 범위:** 12~20. 12턴 이하는 대화가 너무 짧을 수 있음

**타임아웃과의 관계:**
- 엔진 타임아웃: `engine.ts`의 `ENGINE_TIMEOUT_MS` (기본 270초)
- 1턴당 평균 5~15초 → 20턴 = 최대 300초 → 타임아웃 가능
- 15턴으로 줄이면 타임아웃 위험 크게 감소

### 3-2. 종료 조건

**파일:** `lib/interaction/endCheck.ts` → `shouldEnd()`

**현재 종료 조건 3가지:**
1. `events.length >= maxTurns` — 최대 턴 도달
2. `<promise>END</promise>` 마커 — AI가 자연스러운 끝을 감지
3. 연속 5턴이 모두 4자 미만 — 대화 고갈

**튜닝:**
- `END_SIGNAL_SHORT_TURNS_THRESHOLD` (기본 5) — 짧은 응답 연속 몇 턴이면 종료
- `MIN_RESPONSE_LENGTH` (기본 4) — "짧은 응답" 기준 글자 수

### 3-3. 연속 발화

**파일:** `lib/interaction/engine.ts` → `MAX_CONSECUTIVE_SAME_SPEAKER` (기본 3)

**역할:** 한 Clone이 연속으로 몇 턴까지 말할 수 있는지. 카톡처럼 한 사람이 여러 메시지를 연속 전송하는 패턴.

**튜닝:**
- 2로 줄이면 → 더 엄격한 교대, 연속 발화 거의 없음
- 4~5로 늘리면 → 한 사람이 길게 이어 말할 수 있음
- `<continue/>` 태그 사용 빈도는 `behavior.ts`의 규칙에서도 조절

### 3-4. 첫 메시지 패턴

**파일:** `lib/prompts/interaction.ts` → `buildFirstUserMessage()`

**역할:** 첫 발화자에게 주어지는 시작 컨텍스트. 시나리오 설명 + 상대 프로필 하이라이트.

**튜닝:**
- 시작 톤 변경: "인사는 짧게 1번만 하고 바로 관심 가는 주제로" 부분 수정
- 프로필 하이라이트 선택 기준: `engine.ts` 117~125행에서 `occupation/hobbies/mbti/self_description` 추출

### 3-5. 시나리오

**파일:** `lib/config/interaction.ts` → `DEFAULT_SCENARIOS` 배열

**현재 3개:**
- `online-first-match` — 온라인 처음 매칭
- `casual-chat` — 친구의 친구로 가볍게
- `deep-talk` — 깊은 주제 토론

**추가 방법:** 배열에 `{ id, label, description }` 객체 추가. UI(ScenarioPicker)에 자동 반영.

---

## 4. 모델 · 비용 조절

**파일:** `lib/config/claude.ts`

### 모델 선택
| 용도 | 현재 모델 | 변경 가능 |
|---|---|---|
| `INTERACTION` | `claude-sonnet-4-6` | Haiku로 바꾸면 비용 ↓ 품질 ↓ |
| `EXTRACTION` (메모리) | `claude-haiku-4-5-20251001` | 경량 태스크라 Haiku 유지 권장 |
| `ANALYSIS` (호환성 분석) | `claude-sonnet-4-6` | 분석 품질이 중요하면 Sonnet 유지 |
| `ONBOARDING` (추론) | `claude-haiku-4-5-20251001` | Haiku로 충분 |

### 토큰 한도
| 용도 | 현재 | 효과 |
|---|---|---|
| `MAX_OUTPUT_TOKENS_INTERACTION` | 512 | 한 턴 최대 길이. 줄이면 짧은 대화, 늘리면 장문 가능 |
| `MAX_OUTPUT_TOKENS_EXTRACTION` | 256 | 메모리 추출 결과 길이 |
| `MAX_OUTPUT_TOKENS_ANALYSIS` | 2048 | 호환성 분석 리포트 길이 |
| `MAX_OUTPUT_TOKENS_ONBOARDING` | 512 | 성격 추론 결과 길이 |

### Temperature
- 대화 (`engine.ts`): `0.9` — 높을수록 다양하고 창의적, 낮을수록 일관적
- 추론/분석: `0.2~0.3` — 구조화된 출력이므로 낮게 유지

### 재시도
- `CLAUDE_RETRY.MAX_ATTEMPTS` (기본 3) — 429/5xx 시 재시도 횟수
- `CLAUDE_RETRY.INITIAL_DELAY_MS` (기본 1000) — 첫 재시도 대기
- `CLAUDE_RETRY.BACKOFF_MULTIPLIER` (기본 2) — 지수 증가 배수

---

## 5. 기타 튜닝 포인트

### 5-1. 메모리 추출 프롬프트

**파일:** `lib/prompts/memory.ts` → `buildMemoryExtractionPrompt()`

**역할:** 유저가 입력한 자연어 → 구조화된 메모리 JSON 추출.

**튜닝:** kind 분류 기준, content 요약 스타일, tags 생성 규칙 등.

### 5-2. 호환성 분석 프롬프트

**파일:** `lib/analysis/prompt.ts`

**역할:** Interaction 로그를 보고 호환성 리포트 생성.

**튜닝:** 분석 카테고리, 점수 기준, 요약 톤 등.

### 5-3. 메모리 업데이트 유도 배너

**파일:** `components/memory/MemoryPromptBanner.tsx`

- `ONE_HOUR_MS` — 재방문 감지 간격 (현재 1시간)
- 배너 문구 변경: JSX 내 텍스트 직접 수정

### 5-4. 랜덤 팁

**파일:** `components/nav/TipBanner.tsx` → `TIPS` 배열

**추가 방법:** `{ text, href, linkLabel }` 객체 추가. 세션 시작 시 랜덤 1개 표시.

### 5-5. 엔진 타임아웃

**파일:** `lib/interaction/engine.ts` → `ENGINE_TIMEOUT_MS` (기본 270000ms = 270초)

**역할:** Vercel 300초 타임아웃 전에 안전하게 종료. 줄이면 더 안전하지만 턴 수 제한.

---

## 6. 튜닝 워크플로우

1. **코드 수정** — 위 파일들 직접 수정
2. **로컬 테스트** — `npm run interact` (Dev CLI)로 NPC 간 대화 시뮬레이션
3. **테스트 실행** — `npx vitest run` (순수 함수 변경 시)
4. **배포** — `git push` → Vercel 자동 배포
5. **프로덕션 확인** — 실제 Interaction 실행 후 결과 확인

**Dev CLI (`npm run interact`):**
- NPC 이름/번호로 빠른 선택
- clone 이름 검색 지원
- 자동 체크리스트 평가 (마침표 빈도, 감정 표현, 문어체 접속사 등)
- 프로덕션 배포 없이 프롬프트 튜닝 가능
