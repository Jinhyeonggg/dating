# Phase 2 · P0 — Realism & World Context 설계

> **상태**: Draft (작성일 2026-04-12)
> **범위**: Phase 2의 첫 번째 sub-project. 이 스펙이 승인되면 Plan 6으로 이어져 구현된다.
> **선행 조건**: Phase 1 완료 (`docs/PROJECT_STATE.md` 기준 `phase1-complete` 태그)

---

## 0. 용어 한 줄 정리

- **Phase**: 제품 로드맵의 큰 단계. 지금은 Phase 2.
- **P0/P1/P2/P3**: Phase 2 내부 sub-project의 우선순위 라벨. 이 스펙은 **P0**.
- **Plan**: spec을 TDD task로 쪼갠 실행 문서. 이 스펙 이후 Plan 6이 나옴.

---

## 1. 목표와 스코프

### 1.1 목표
Phase 1 interaction 엔진의 "realism 부족" 이슈를 해결한다. 구체 증상:
- AI가 생성한 것 같은 정돈된 문장 (특히 마침표 100%, 완벽한 문법)
- 모든 Clone 조합이 비슷한 톤으로 수렴
- 외부 맥락 부재 (그날그날의 뉴스/날씨/밈/증시 등)
- 세션마다 같은 Clone이 같은 톤

### 1.2 Realism 기여도 순위 (설계 우선순위)
1. **메시지 텍스처 (A)** — 1등 시민. 한국인 실제 카톡 표면 (파편화된 문장, 마침표 없음, ㅋ/ㅠ, 줄임말)
2. **메모리** — 모든 modulator의 input. 유저가 수동 입력한 메모리는 realism의 핵심 연료
3. **Session-start mood roll (B)**
4. **페르소나별 말투 차별화 (C)** — A+B의 자연스러운 부산물
5. **외부 세계 반응성 (D)** — 수동 큐레이션으로 시작
6. **대화 리듬 (E)** — 최소 포함 (연속 발화 허용만)

### 1.3 포함
- 메시지 텍스처 규칙 (`lib/prompts/texture.ts`)
- 스타일 카드 리빙 아카이브 (`lib/styles/cards/*.ts`)
- Style card matcher (순수 함수, 4-tier 가중 점수)
- Session-start mood roll (Haiku 호출 + Zod 검증 + 코드 fallback)
- World context DB 테이블 + 주입 로직
- `/admin/world` 관리 페이지
- Dev CLI 스크립트 (`scripts/dev-interaction.ts`) — 튜닝 루프 지원
- 튜닝 루프 2~3회 반복 (Plan 6의 명시적 task)
- P2 matching 대비 persona 메타데이터 구멍 점검 (결론: 추가 불필요)

### 1.4 제외 (defer / 다른 phase)
- Memory compaction — defer. 토큰 실측 후 이슈 생기면 재논의.
- Realtime 채널 안정화 — 관망 (재현 안 됨).
- 2-pass 리라이터 — 미래. 비용 2배, 효과 marginal.
- 뉴스/기상청/거래소 API 자동 수집 — 미래. 인터페이스만 열어둠.
- 시간축 대화 리듬 (읽씹, 지연) — Phase 2 이후.
- Turn-by-turn emotion tracking — 과잉. Session-start에 끝.

---

## 2. 아키텍처 오버뷰

### 2.1 기존 Phase 1 run 흐름
```
/api/interactions/[id]/run
  → interaction + clones + memories 로드
  → 각 clone의 system prompt 생성 (persona + memories)
  → 20턴 루프: stateless Claude 호출, role 재매핑, <continue/> / <end/>
  → 종료
```

### 2.2 P0 변경 후 run 흐름
```
/api/interactions/[id]/run
  → interaction + clones + memories 로드
  → [NEW] loadWorldContext(today, persona[0..n], memory[0..n])
  → [NEW] 각 clone에 대해:
      rollMood(persona, memories, worldCtx, seed) → MoodState   (Haiku 호출)
      pickStyleCards(persona, memories, mood)    → StyleCard[]  (순수 함수)
  → [NEW] buildSystemPrompt({
        persona, memories,
        textureRules,   // 전역 baseline
        styleCards,     // Clone별 top-2
        mood,           // 짧은 자연어 힌트 1~2줄
        worldSnippet    // "자연스럽게 써도 되고 안 써도 된다" 주의 포함
     })
  → 20턴 루프 (엔진 불변)
  → 종료
```

### 2.3 핵심 원칙
1. **20턴 루프/`<continue/>`/`<end/>` 엔진은 손대지 않는다.** 변경은 system prompt 조립 단계에만.
2. **Modulator는 모두 순수 함수 또는 단일 책임.** 독립 테스트 가능.
   - `rollMood(…): Promise<MoodState>` (Haiku, async)
   - `pickStyleCards(…): StyleCard[]` (동기, 순수)
   - `selectWorldContext(…): WorldSnippet` (동기, 순수)
3. **Prompt builder가 조립.** `buildSystemPrompt` 한 곳이 모든 소스를 합친다.
4. **Modulator 호출은 session-start에 1회.** 턴 루프 내부로 내리지 않는다 (mood roll은 session-start 원칙).
5. **Collection vs Injection 분리.** `lib/world/collect.ts` (DB 조회 — 미래 API 교체 가능) vs `lib/world/inject.ts` (snippet 조립).

### 2.4 파일 추가/수정 목록

**신규**:
- `lib/mood/roll.ts` · `lib/mood/types.ts` · `lib/mood/parse.ts`
- `lib/styles/types.ts` · `lib/styles/index.ts` (glob 수집) · `lib/styles/match.ts`
- `lib/styles/cards/*.ts` (시드 5~8장)
- `lib/world/collect.ts` · `lib/world/inject.ts` · `lib/world/types.ts`
- `lib/prompts/texture.ts`
- `app/admin/world/page.tsx`
- `app/api/world-context/route.ts` · `app/api/world-context/[id]/route.ts` · `app/api/world-context/copy/route.ts`
- `scripts/dev-interaction.ts`
- `supabase/migrations/2026041300000X_world_context.sql`

**수정**:
- `lib/prompts/persona.ts` — `buildSystemPrompt` 시그니처 확장
- `lib/interaction/engine.ts` — run 앞단에 modulator orchestration 삽입
- `middleware.ts` (또는 server helper) — `/admin/*` 보호

**변경 없음**:
- `lib/constants/personaFields.ts` — 기존 필드로 style card 매칭 충분
- `clones` / `interaction_events` / `analyses` 테이블 스키마 — mood는 stateless

---

## 3. Style Card System

### 3.1 아카이브 구조 (pre-authored, 리빙)
- 카드 하나당 TS 파일 하나: `lib/styles/cards/<id>.ts`
- `lib/styles/index.ts` 가 glob으로 자동 수집
- 추가 = 파일 추가 + commit. 빌드 시 번들.
- 시드 **5~8장** (register 다양성 확보: formal 2~3장, casual 2~3장, mixed 1~2장)
- 유저(너)의 지속적 관리 대상. DB 이관은 Phase 3에서 재검토.

### 3.2 카드 스키마

```ts
interface StyleCard {
  id: string                  // e.g. 'formal_polite_young'
  label: string               // 사람이 읽는 한 줄 설명
  match: {
    age_range?: [number, number]
    gender?: Array<'여성' | '남성' | '중립'>
    register?: 'formal' | 'casual' | 'mixed'
    energy?: 'low' | 'mid' | 'high'
    humor?: 'dry' | 'playful' | 'warm' | 'none'
    mbti_like?: string[]      // ['E*F*']
    tags?: string[]           // 보조 키워드
  }
  sample: string              // 실제 카톡 4~6턴 예시 (multiline)
  texture_notes?: string      // 카드 특이사항 ("마침표 종종 씀")
}
```

### 3.3 매칭 기준 (4-tier 가중 점수)

| Tier | Weight | Persona 필드 → Card 필드 |
|---|---|---|
| 1 | 1.0 | `texting_style`, `communication_style`, `humor_style`, `emotional_expression` → `register`, `humor`, `energy`, `texture_notes` 키워드 overlap |
| 2 | 0.7 | `age` → `age_range`, `gender` → `gender`, `occupation`/`location` → `register` 보강 |
| 3 | 0.5 | `mbti` → `mbti_like` loose match, `personality_traits`/`core_values` → `tags` overlap |
| 4 | 0.3 | `hobbies`, `tags` → `tags` overlap |

**Runtime modifier (mood)**:
- `energy: low` 카드는 mood.energy 낮을 때 score +boost
- `energy: high` 카드는 mood.energy 높을 때 score +boost
- Mood가 "같은 Clone이 세션마다 다른 카드 조합"을 생성하는 핵심

### 3.4 매칭 규칙
- **Null-tolerant**: persona 필드가 null이면 0점 기여 (negative 아님)
- **Score normalization**: non-null 필드 수로 나눠 공정 비교
- **결정론적 base + 작은 jitter**: 같은 (persona, mood)는 같은 결과, interaction_id 기반 tie-breaker jitter 허용
- **Top-K = 2**: 프롬프트 예산 고려 (sample 4~6턴 × 2장 ≈ 500토큰)
- **Fallback**: 아카이브가 1장뿐이거나 점수 전부 0이어도 **최고점 1장은 항상 선택**. 최종 보험으로 `default_casual` 카드 reserved.

### 3.5 Persona 필드 점검 (P2 matching 대비)
현재 `PERSONA_SECTIONS`에 `communication_style`, `texting_style`, `humor_style`, `emotional_expression`, `mbti`, `age`, `gender`, `occupation`, `hobbies`, `tags`가 이미 존재. **추가 필드 불필요**. P2 matching도 동일 필드 재활용 가능.

---

## 4. Mood Roll

### 4.1 원칙: Mood는 **tint**, not **driver**
> 유저 피드백: 대화 진행이 moodstate에 과하게 의존하면 안 됨.

- Mood는 system prompt에 **짧게 주입**: 한두 줄짜리 자연어 힌트
  - 예: `지금 너의 기분: 약간 피곤하고 말수가 적음. 대화 열심히 참여하고 싶지는 않음.`
- ❌ 금지: 수치 룰 강요, 하드코딩된 표현 강제, 턴마다 반복 주입
- ✅ 허용: 세션 시작 1회 주입, 대화 흐름 중 drift 허용 ("mood fixed"가 아니라 "mood baseline")
- **`MoodState` 수치는 prompt에 숫자로 안 들어간다.** 내부 계산(style card modifier) + 자연어 1~2줄 힌트 생성에만 사용.

### 4.2 MoodState 스키마
```ts
interface MoodState {
  primary: '평온' | '설렘' | '짜증' | '우울' | '활기' | '피곤' | '긴장'
  energy: number           // 0.0 ~ 1.0
  openness: number         // 0.0 ~ 1.0 (대화 참여 의지)
  warmth: number           // 0.0 ~ 1.0 (상대 태도)
  reason_hint: string      // 디버그/로그용. prompt에는 요약 또는 생략
}
```

### 4.3 생성 방식: Haiku 한 번 호출 (primary)
- 세션 시작 시 각 clone별 1회 (보통 2회/세션)
- `claude-haiku-4-5-20251001` 사용 (기존 memory 추출 파이프라인 재사용)
- Temperature 낮게, JSON 출력
- **Zod 검증 필수**. 파싱 실패 시 fallback으로 전환.
- Input: persona core + 최근 memories (event/mood kind 우선) + today's world context
- Output: 위 `MoodState` JSON

### 4.4 Fallback: 코드 기반 휴리스틱 (보험)
- Haiku 호출 실패/파싱 실패 시 사용
- persona 기본치 + memory 키워드 스코어 + world 키워드 스코어 + seed 난수
- Primary enum 분류 후 MoodState 조립
- reason_hint는 템플릿 조립 (예: `"최근 메모리가 짜증 톤이 많음"`)

### 4.5 Entropy / 재현성
- Seed = `hash(interaction_id + clone_id + date)`
- 같은 세션 재실행은 같은 mood (디버깅 목적)
- 다른 세션은 다른 mood (자연 변주)
- Temperature 0 + seed 해시 기반 tie-breaker

---

## 5. World Context

### 5.1 데이터 소스: 수동 큐레이션 (v1)
> 유저 결정: "일단 (5) 수동으로 구현. 언젠가 (1) 자동 API로 간다."

- v1은 DB에 수동 입력된 row
- 수집 레이어(`lib/world/collect.ts`)가 DB 조회만 수행
- 미래에 네이버/기상청/거래소 API로 교체해도 주입 로직 불변
- 인터페이스 안정성이 핵심 설계 목표

### 5.2 DB 스키마

```sql
-- 2026041300000X_world_context.sql
create table world_context (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  category text not null check (category in (
    'news','weather','meme','market','politics','sports','other'
  )),
  headline text not null,
  details text,
  weight smallint not null default 5 check (weight between 1 and 10),
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index world_context_date_category_idx on world_context (date, category);
```

### 5.3 RLS & Admin
- **Admin 판별 주체는 Next.js 서버** (Postgres RLS가 아님). 이유: env var는 Postgres policy에서 직접 못 읽음.
- `.env`에 `ADMIN_USER_IDS=uuid1,uuid2` (유저 결정: 간단함 우선)
- `/api/world-context/*` 라우트 공통 가드: `session.user.id ∈ ADMIN_USER_IDS` 아니면 403
- `/admin/*` 페이지도 동일 가드 (middleware 또는 server component)
- **RLS 정책**:
  - `select`: 인증된 모든 사용자 (`using (auth.uid() is not null)`)
  - `insert/update/delete`: **service role만** (`using (false)` + 서버가 service-role client 사용)
- 즉 일반 사용자는 읽기만 가능, 쓰기는 서버가 admin 체크 후 service-role로 수행

### 5.4 Selection logic (`selectWorldContext`)
1. 오늘 날짜의 row 전부 로드 → category별 weight 내림차순
2. persona.hobbies/tags + memories의 preference kind와 headline 키워드 overlap 시 score bonus
3. Top **N = 5** 선택
4. Fallback: 오늘 날짜 row 없음 → 최근 7일 중 가장 가까운 날짜
5. 그것도 없음 → world 주입 **skip** (엔진은 살아있음, 다른 축만으로 운영)

### 5.5 Prompt snippet 형식
```
[오늘 대략 이런 것들이 화제야 — 자연스럽게 언급해도 되고 안 해도 돼:]
- (market) 코스피 3200 돌파했대
- (weather) 서울 오후에 비 온다고 함
- (meme) '~~하는 부장님' 밈이 트위터에서 퍼지는 중
- (news) 강남역 사고 뉴스
- (sports) KBO 개막전

[어색하게 뉴스 브리핑하지 말 것. 대화 흐름에 자연스러우면 섞고, 아니면 무시.]
```

두 번째 문단(명시적 "써도 되고 안 써도 된다") 필수. 없으면 LLM이 어색한 브리핑 오프닝을 날림.

### 5.6 `/admin/world` 페이지

**기능 (minimal)**:
- 날짜 picker (기본 오늘)
- 해당 날짜 row 테이블 (category, headline, details, weight)
- Inline add row form
- Row 삭제
- "어제 복사" 버튼 → 전날 row 복제

**보호**:
- Middleware에서 `ADMIN_USER_IDS` 체크, 비-admin은 `/clones` 리다이렉트
- API 라우트도 서버 쪽 재검증

**UI**: 기존 shadcn/ui 프리미티브만. 새 primitive 만들지 않음.

**API**:
- `GET  /api/world-context?date=YYYY-MM-DD`
- `POST /api/world-context`
- `DELETE /api/world-context/[id]`
- `POST /api/world-context/copy?from=YYYY-MM-DD&to=YYYY-MM-DD`

---

## 6. Message Texture Rules

### 6.1 파일: `lib/prompts/texture.ts`
모든 Clone 공통 baseline. 개별 persona는 스타일 카드로 override.

### 6.2 규칙 (초안)

```
[한국인 카톡 리얼리즘 규칙 — 모든 메시지에 적용]

1. 마침표 규칙
   - 평소 문장 끝에 '.' 쓰지 마. 감정 강조나 단호함 필요할 때만 가끔.
   - '...' 은 망설임/말줄임에만. 남발 금지.
   - '!' 와 '?' 는 자연스럽게 써.

2. 한 메시지 = 한 호흡
   - 긴 문장 하나로 쓰지 말고 짧게 쪼개서 여러 메시지로 보내.
   - 2~4개로 나눠서 보내는 게 보통. 연속 발화 태그를 쓸 것.

3. 줄임말/구어체
   - ㅇㅇ, ㄴㄴ, ㅇㅋ, ㄱㄱ, ㄹㅇ, ㅁㅊ 같은 자음 축약 자연스럽게 써.
   - "음...", "아 ㄹㅇ", "그치", "ㅋㅋㅋ" 같은 필러 써도 돼.

4. 감정 표현
   - ㅋㅋ, ㅠㅠ, ㅜㅜ, ㅎㅎ, ㅇ... 을 자연스럽게. 과하지도 부족하지도 않게.
   - 이모지는 쓰는 사람만 써 (persona.texting_style 참조). 안 쓰는 사람한테 강제하지 마.

5. 완벽한 문법 금지
   - 조사 생략, 어순 자유롭게, 오타 있어도 자연스러우면 둬.
   - "아 그거 나도 봄", "오늘 날씨 개춥네" 같은 파편화된 문장 OK.
   - 존댓말과 반말은 persona에 맞게. 혼용하는 사람도 있음.

6. 리액션
   - "ㅇㅇ", "ㄹㅇ?", "와 진짜?", "헐" 같은 짧은 반응도 유효한 턴이야.
   - 항상 2~3줄짜리 의견을 낼 필요 없음.

7. "AI스러움"이란 무엇인가 — 표현이 아니라 패턴의 문제
   - 금지 대상은 특정 문구가 아니라, 교과서 같은 정돈성이다.
   - register 존중:
     · 처음 만난 사이/예의 필요: "~하는 것 같아요", "~인 듯해요", "괜찮으시면" 자연스러움
     · 친한 사이/반말: "~인 듯", "~같아", "~일걸"
     · 단, register 안에서도 리듬을 다양하게
   - 진짜 AI스러운 패턴 (register 무관하게 피해):
     · 모든 메시지가 완결된 문장으로만 구성
     · "또한", "그러므로", "따라서" 같은 문어체 접속사
     · 문장마다 주어-목적어-술어가 모두 있는 설명문체
     · 감정 표현 자음 (ㅋ/ㅠ/ㅎ) 이 하나도 없이 여러 턴 이어짐
     · 상대 말에 항상 새로운 정보를 추가해서 응답 (실제는 공감-only 턴이 많음)
     · 이모지 나열 (🥺✨💕)
     · 영어 불필요 섞기 ("It's like 뭐랄까")
   - 핵심: "이 사람의 register 안에서 실제 한국인이 메시지를 쓰는 방식을 따라라"
     · 정중함 ≠ 완벽한 문장
     · 예의 있는 사이에서도 "아 그쵸", "오 정말요?", "음... 조금 애매하네요" 같이 작고 부서진 반응 존재
```

### 6.3 규칙 설계 원칙
1. **규칙은 baseline, persona가 override.** 마침표 좋아하는 캐릭터면 쓰게 둠.
2. **계층 조립 순서**: `texture → persona → memories → mood → style card → world`. 뒤가 앞을 override.
3. **Negative examples는 명시적**. positive-only 룰은 약함.
4. **리빙 문서**. 튜닝 루프 돌며 수정하는 게 정상.

### 6.4 프롬프트 조립 순서 (buildSystemPrompt 내부)
```
1. texture rules (전역 baseline)
2. persona (identity, values, communication_style, ...)
3. memories (clone_memories 전체 — compaction 없음 v1)
4. mood (1~2줄 자연어 힌트)
5. style cards (top-2 sample + texture_notes)
6. world snippet (optional, 없으면 skip)
```

---

## 7. Dev CLI & 튜닝 루프

### 7.1 `scripts/dev-interaction.ts`
Phase 1 이슈 #4 ("realism 튜닝 루프 미수행") 해결 도구.

**기능**:
- 인자: `--pair=<clone1_id>,<clone2_id>`, `--scenario=first_date`, `--mood-seed=<int>`, `--dry-run`
- interaction run 실행 후 전체 대화를 터미널에 컬러 프린트
- 옵션: 체크리스트 8항목 자동 통계 (마침표 비율, ㅋㅋ 출현율, 연속 발화 횟수, AI스런 접속사 개수)
- `--help` 에 유저 워크플로우 주석 포함

### 7.2 튜닝 루프 (Plan 6의 명시적 task)
1. 시드 5~8 스타일 카드 작성
2. NPC pair로 interaction run (CLI)
3. 체크리스트 8항목 평가
4. 실패 항목 기반 `texture.ts` 또는 카드 수정
5. 2~3회 반복 & 각 회차 결과 로그 남김

### 7.3 체크리스트 8항목
1. 마침표 발생률 < 10% (전체 메시지 대비)
2. 연속 메시지 비율 > 30% (한 턴에 2+ 메시지)
3. ㅋㅋ/ㅠㅠ 등 감정 자음 등장률 > 15%
4. 문어체 접속사 ("또한", "그러므로") 0회
5. 수동 체감: "사람이 쓴 것 같다"
6. 같은 Clone × 2 세션이 서로 다른 톤
7. 두 Clone이 서로 구별되는 말투
8. 외부 맥락이 자연스럽게 섞이거나 완전히 무시 (어색 브리핑 금지)

항목 1~4는 CLI 자동 측정, 5~8은 매뉴얼 평가. 자동화(LLM judge)는 Phase 2 후반 또는 P3에서 재검토.

---

## 8. 데이터 모델 변경 요약

| 테이블 | 변경 |
|---|---|
| `world_context` | **신규**. 위 5.2 스키마 |
| `profiles` | 변경 없음 (env var 기반 admin) |
| `clones` | 변경 없음 |
| `clone_memories` | 변경 없음 |
| `interactions` | 변경 없음 |
| `interaction_participants` | 변경 없음 (mood stateless) |
| `interaction_events` | 변경 없음 |
| `analyses` | 변경 없음 |

**Persona 필드**: 추가 없음. 기존 `PERSONA_SECTIONS`로 충분.

---

## 9. 출시 순서 (Plan 6 세부 task 소스)

1. **Foundation types** — `lib/styles/types.ts`, `lib/mood/types.ts`, `lib/world/types.ts`
2. **Pure functions (TDD)** — `lib/styles/match.ts`, `lib/world/inject.ts`, `lib/mood/parse.ts`, Zod 스키마
3. **Texture + Cards** — `lib/prompts/texture.ts`, `lib/styles/cards/` 시드 5~8장, `lib/styles/index.ts` glob 수집
4. **DB 마이그레이션** — `world_context` 테이블 + RLS. Supabase Cloud 적용.
5. **Orchestration** — `buildSystemPrompt` 확장, `/api/interactions/[id]/run` 앞단에 modulator 조립
6. **Haiku mood roll** — `lib/mood/roll.ts` (호출 + Zod + fallback α)
7. **Admin UI** — `/admin/world` + API routes + middleware 보호
8. **Dev CLI** — `scripts/dev-interaction.ts` 완성 (체크리스트 통계 포함)
9. **튜닝 루프** — **명시적 task로 박음**. 2~3회 반복, 회차별 결과 로그 남김
10. **Smoke + deploy** — vitest 통과, 프로덕션 push, 실제 세션 검증

---

## 10. 테스트 전략

### 10.1 유닛 (Vitest)
- `lib/styles/match.test.ts` — 다양한 persona × 카드로 top-K 결정 검증, null-tolerant 케이스
- `lib/world/inject.test.ts` — snippet 조립, fallback 로직
- `lib/mood/parse.test.ts` — Haiku 출력 JSON 파싱 + Zod + fallback 트리거
- `lib/prompts/texture.test.ts` — 규칙 문자열이 핵심 키워드 포함 (regression)

### 10.2 통합
- `/api/interactions/[id]/run` 기존 테스트 확장. Modulator hook 검증.
- `/api/world-context` CRUD + admin 보호 테스트

### 10.3 수동 (Dev CLI)
- 체크리스트 8항목
- 같은 pair × 3회 → mood 변주 확인
- Formal / Casual 시나리오 각각 register 유지 확인

### 10.4 회귀 방지
- 기존 vitest 53개 passing 유지
- run endpoint 계약 불변 → 클라이언트 재작업 0

---

## 11. 리스크 & 완화

| 리스크 | 완화 |
|---|---|
| Haiku JSON 파싱 실패 | Zod 검증 + 코드 fallback α 항상 구현 |
| 프롬프트 토큰 폭증 | 튜닝 루프에서 실측. 500 초과 시 카드 sample 축소 또는 top-K=1 |
| 카드/규칙 충돌로 카드 무효화 | 조립 순서 고정: texture → persona → memory → mood → card → world. 뒤가 앞을 override |
| Realism 체감 개선 안 됨 | 튜닝 루프 명시적 task화, 8항목 체크리스트 통과 기준 설정 |
| 카드 매칭 편향 (다 같은 카드) | 첫 튜닝 루프에서 NPC 5명 전원 매칭 결과 검사, 다양성 부족 시 카드 추가 |
| Mood 과의존 → 대화 경직 | Mood는 짧은 자연어 힌트 1~2줄, 수치는 prompt에 금지, 대화 중 drift 허용 |
| Admin env var 오남용 | `ADMIN_USER_IDS` 누출 시 최악 = world context 조작. Clone/memory 건드리지 못함. 허용 범위 |
| World context 없는 날 run | Fallback: 최근 7일 → 그래도 없으면 snippet skip. 엔진 계속 동작 |

---

## 12. Out of scope 재확인 (다른 phase로 미룸)

- Memory compaction
- Realtime 채널 안정화
- 2-pass 리라이터
- 실시간 뉴스/기상/거래소 API 자동 수집
- 시간축 대화 리듬 (읽씹, 지연)
- Turn-by-turn emotion tracking
- 매칭 자동화 (LLM judge 체크리스트 평가)
- 카드/규칙 admin UI (TS 파일로 유지)
- 스타일 카드 DB 이관

---

## 13. 오픈 질문 (Plan 6 작성 시 결정)

- 시드 5~8장 카드 목록 구체안 (register 다양성 기준 초안은 내가 작성 → 유저 리뷰 루프)
- Service-role client 호출 위치 (route handler 내부 vs 별도 service layer) — 기존 `lib/supabase/service.ts` 재사용
- Dev CLI 출력 컬러링 라이브러리 선택 (`picocolors` 추천)
- 튜닝 루프 결과 로그를 어디에 저장할지 (`docs/phase2/tuning-log.md` 제안)

---

## 14. 승인 상태

- [x] Section 1 Scope — 승인 (2026-04-12)
- [x] Section 2 Architecture — 승인
- [x] Section 3 Style Card Matching — 승인
- [x] Section 4 Mood Roll — 승인 (+ "mood는 tint not driver" 원칙 추가)
- [x] Section 5 World Context + Admin — 승인 (env var 기반 admin)
- [x] Section 6 Message Texture Rules — 승인 (+ register-aware 규칙 7 수정)
- [x] Section 7 Dev CLI & 튜닝 루프 — 승인
- [ ] 유저 전체 스펙 리뷰 — **pending**
